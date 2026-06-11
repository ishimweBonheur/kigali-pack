import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiLogEntity } from '../analytics/entities/api-log.entity';
import {
  AdministrativeUnitEntity,
  AdministrativeUnitLevel,
} from '../locations/entities/administrative-unit.entity';
import { MockTransactionEntity } from '../sandbox/entities/mock-transaction.entity';

interface AuthenticatedRequest {
  developer: ApiKeyEntity;
}

interface LocationTreeNode {
  id: string;
  name: string;
  level: AdministrativeUnitLevel;
  code: string | null;
  children: LocationTreeNode[];
}

interface LocationLevelBuckets {
  PROVINCE: AdministrativeUnitEntity[];
  DISTRICT: AdministrativeUnitEntity[];
  SECTOR: AdministrativeUnitEntity[];
  CELL: AdministrativeUnitEntity[];
  VILLAGE: AdministrativeUnitEntity[];
}

interface TrafficAggregateRow {
  totalRequests: string;
  averageResponseTimeMs: string;
}

interface TransactionBucket {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  count: number;
  entries: MockTransactionEntity[];
}

const ADMINISTRATIVE_LEVELS: AdministrativeUnitLevel[] = [
  'PROVINCE',
  'DISTRICT',
  'SECTOR',
  'CELL',
  'VILLAGE',
];

const TERMINAL_TRANSACTION_STATES = ['SUCCESS', 'PENDING', 'FAILED'] as const;

type TerminalTransactionState = (typeof TERMINAL_TRANSACTION_STATES)[number];

const NIDA_SIXTEEN_DIGIT_PATTERN = /^1(19|20)\d{2}[78]\d{7}\d{2}$/;

const RRA_PAYE_PROGRESSIVE_LAYERS = [
  {
    bracketLabel: 'EXEMPT',
    minGrossSalaryRwf: 0,
    maxGrossSalaryRwf: 60_000,
    marginalRate: 0,
    cumulativeBaseTaxRwf: 0,
    formula: 'PAYE = 0',
  },
  {
    bracketLabel: 'LOWER',
    minGrossSalaryRwf: 60_001,
    maxGrossSalaryRwf: 100_000,
    marginalRate: 0.1,
    cumulativeBaseTaxRwf: 0,
    formula: 'PAYE = (grossSalary - 60000) * 0.10',
  },
  {
    bracketLabel: 'MIDDLE',
    minGrossSalaryRwf: 100_001,
    maxGrossSalaryRwf: 200_000,
    marginalRate: 0.2,
    cumulativeBaseTaxRwf: 4_000,
    formula: 'PAYE = 4000 + (grossSalary - 100000) * 0.20',
  },
  {
    bracketLabel: 'UPPER',
    minGrossSalaryRwf: 200_001,
    maxGrossSalaryRwf: null,
    marginalRate: 0.3,
    cumulativeBaseTaxRwf: 24_000,
    formula: 'PAYE = 4000 + 20000 + (grossSalary - 200000) * 0.30',
  },
] as const;

const STATUTORY_VAT_RULE = {
  rate: 0.18,
  label: 'STANDARD_VAT_EIGHTEEN_PERCENT',
  description:
    'Rwanda Revenue Authority statutory value-added tax applied at eighteen percent.',
  formula: 'vatAmount = taxableBase * 0.18',
} as const;

@ApiTags('Developer Workspace')
@ApiBearerAuth()
@Controller('v1/developer/workspace')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class MasterCoreSnapshotController {
  constructor(
    @InjectRepository(AdministrativeUnitEntity)
    private readonly administrativeUnitRepo: Repository<AdministrativeUnitEntity>,
    @InjectRepository(ApiLogEntity)
    private readonly apiLogRepo: Repository<ApiLogEntity>,
    @InjectRepository(MockTransactionEntity)
    private readonly mockTransactionRepo: Repository<MockTransactionEntity>,
  ) {}

  @Get('complete-core-snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Aggregate location graph, developer analytics, sandbox history, and compliance references in one optimized call',
  })
  @ApiResponse({
    status: 200,
    description: 'Complete developer workspace core snapshot returned',
  })
  async getCompleteCoreSnapshot(@Req() req: AuthenticatedRequest) {
    const developer = req.developer;

    const [
      administrativeUnits,
      trafficAggregate,
      telemetryFootprints,
      recentTransactions,
    ] = await Promise.all([
      this.fetchAllActiveAdministrativeUnits(),
      this.fetchDeveloperTrafficAggregate(developer.id),
      this.fetchRecentTelemetryFootprints(developer.id),
      this.fetchRecentSandboxTransactions(developer.id),
    ]);

    const locationGraph = this.buildLocationTreeGraph(administrativeUnits);
    const transactionBuckets =
      this.bucketTransactionsByTerminalState(recentTransactions);

    return {
      snapshotGeneratedAt: new Date().toISOString(),
      developer: {
        id: developer.id,
        developerName: developer.developerName,
        tier: developer.tier,
      },
      locationGraph,
      developerAnalytics: {
        totalRequestCount: Number(trafficAggregate.totalRequests),
        averageResponseTimeMs: Math.round(
          Number(trafficAggregate.averageResponseTimeMs),
        ),
      },
      backgroundTelemetryFootprints: telemetryFootprints.map((footprint) => ({
        id: footprint.id,
        endpoint: footprint.endpoint,
        method: footprint.method,
        statusCode: footprint.statusCode,
        responseTimeMs: footprint.responseTimeMs,
        timestamp: footprint.timestamp,
      })),
      sandboxTransactionHistory: {
        totalFetched: recentTransactions.length,
        counters: {
          SUCCESS: transactionBuckets.SUCCESS.count,
          PENDING: transactionBuckets.PENDING.count,
          FAILED: transactionBuckets.FAILED.count,
        },
        buckets: {
          SUCCESS: this.serializeTransactionEntries(
            transactionBuckets.SUCCESS.entries,
          ),
          PENDING: this.serializeTransactionEntries(
            transactionBuckets.PENDING.entries,
          ),
          FAILED: this.serializeTransactionEntries(
            transactionBuckets.FAILED.entries,
          ),
        },
      },
      complianceReferenceTables: {
        nidaIdValidation: {
          registry: 'NIDA_RWANDA',
          digitLength: 16,
          pattern: NIDA_SIXTEEN_DIGIT_PATTERN.source,
          description:
            'Standard Rwandan National ID: leading 1, birth century 19 or 20, four-digit birth year, sex indicator 7 or 8, seven identity digits, two check digits.',
          exampleValidId: '1199780123456789',
          validationRule:
            'nationalId must satisfy /^1(19|20)\\d{2}[78]\\d{7}\\d{2}$/',
        },
        rraPayeTaxBrackets: {
          currency: 'RWF',
          authority: 'RRA',
          taxType: 'PAYE_PROGRESSIVE',
          progressiveLayers: RRA_PAYE_PROGRESSIVE_LAYERS,
        },
        vatRule: STATUTORY_VAT_RULE,
      },
    };
  }

  private async fetchAllActiveAdministrativeUnits(): Promise<
    AdministrativeUnitEntity[]
  > {
    return this.administrativeUnitRepo
      .createQueryBuilder('unit')
      .leftJoinAndSelect('unit.parent', 'parent')
      .where('unit.is_active = :isActive', { isActive: true })
      .orderBy('unit.level', 'ASC')
      .addOrderBy('unit.name', 'ASC')
      .getMany();
  }

  private async fetchDeveloperTrafficAggregate(
    apiKeyId: string,
  ): Promise<TrafficAggregateRow> {
    const aggregate = await this.apiLogRepo
      .createQueryBuilder('log')
      .select('COUNT(log.id)', 'totalRequests')
      .addSelect(
        'COALESCE(AVG(log.response_time_ms), 0)',
        'averageResponseTimeMs',
      )
      .where('log.api_key_id = :apiKeyId', { apiKeyId })
      .getRawOne<TrafficAggregateRow>();

    return (
      aggregate ?? {
        totalRequests: '0',
        averageResponseTimeMs: '0',
      }
    );
  }

  private async fetchRecentTelemetryFootprints(
    apiKeyId: string,
  ): Promise<ApiLogEntity[]> {
    return this.apiLogRepo
      .createQueryBuilder('log')
      .where('log.api_key_id = :apiKeyId', { apiKeyId })
      .orderBy('log.timestamp', 'DESC')
      .limit(10)
      .getMany();
  }

  private async fetchRecentSandboxTransactions(
    apiKeyId: string,
  ): Promise<MockTransactionEntity[]> {
    return this.mockTransactionRepo
      .createQueryBuilder('tx')
      .where('tx.api_key_id = :apiKeyId', { apiKeyId })
      .orderBy('tx.created_at', 'DESC')
      .limit(50)
      .getMany();
  }

  private buildLocationTreeGraph(units: AdministrativeUnitEntity[]) {
    const levelBuckets = this.partitionUnitsIntoLevelBuckets(units);
    const nodeLookup = new Map<string, LocationTreeNode>();
    const provinceRoots: LocationTreeNode[] = [];

    for (const unit of units) {
      nodeLookup.set(unit.id, {
        id: unit.id,
        name: unit.name,
        level: unit.level,
        code: unit.code ?? null,
        children: [],
      });
    }

    for (const unit of units) {
      const currentNode = nodeLookup.get(unit.id);
      if (!currentNode) {
        continue;
      }

      const parentId = unit.parent?.id;
      if (parentId) {
        const parentNode = nodeLookup.get(parentId);
        if (parentNode) {
          parentNode.children.push(currentNode);
        }
      } else if (unit.level === 'PROVINCE') {
        provinceRoots.push(currentNode);
      }
    }

    for (const root of provinceRoots) {
      this.sortLocationTreeChildren(root);
    }

    provinceRoots.sort((left, right) => left.name.localeCompare(right.name));

    return {
      totalActiveUnits: units.length,
      levelCounts: {
        PROVINCE: levelBuckets.PROVINCE.length,
        DISTRICT: levelBuckets.DISTRICT.length,
        SECTOR: levelBuckets.SECTOR.length,
        CELL: levelBuckets.CELL.length,
        VILLAGE: levelBuckets.VILLAGE.length,
      },
      tree: provinceRoots,
    };
  }

  private partitionUnitsIntoLevelBuckets(
    units: AdministrativeUnitEntity[],
  ): LocationLevelBuckets {
    const buckets: LocationLevelBuckets = {
      PROVINCE: [],
      DISTRICT: [],
      SECTOR: [],
      CELL: [],
      VILLAGE: [],
    };

    for (const unit of units) {
      buckets[unit.level].push(unit);
    }

    for (const level of ADMINISTRATIVE_LEVELS) {
      buckets[level].sort((left, right) => left.name.localeCompare(right.name));
    }

    return buckets;
  }

  private sortLocationTreeChildren(node: LocationTreeNode): void {
    node.children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of node.children) {
      this.sortLocationTreeChildren(child);
    }
  }

  private bucketTransactionsByTerminalState(
    transactions: MockTransactionEntity[],
  ): Record<TerminalTransactionState, TransactionBucket> {
    const buckets: Record<TerminalTransactionState, TransactionBucket> = {
      SUCCESS: { status: 'SUCCESS', count: 0, entries: [] },
      PENDING: { status: 'PENDING', count: 0, entries: [] },
      FAILED: { status: 'FAILED', count: 0, entries: [] },
    };

    const sortedTransactions = [...transactions].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    for (const transaction of sortedTransactions) {
      const normalizedStatus = transaction.status.toUpperCase();
      const bucketKey = TERMINAL_TRANSACTION_STATES.includes(
        normalizedStatus as TerminalTransactionState,
      )
        ? (normalizedStatus as TerminalTransactionState)
        : 'FAILED';

      buckets[bucketKey].entries.push(transaction);
      buckets[bucketKey].count += 1;
    }

    return buckets;
  }

  private serializeTransactionEntries(transactions: MockTransactionEntity[]) {
    return transactions.map((transaction) => ({
      id: transaction.id,
      phoneNumber: transaction.phoneNumber,
      amount: Number(transaction.amount),
      gateway: transaction.gateway,
      status: transaction.status,
      failureReason: transaction.failureReason,
      clientReference: transaction.clientReference,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    }));
  }
}
