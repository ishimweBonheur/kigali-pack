import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MockTransactionEntity } from './entities/mock-transaction.entity';
import { SandboxHistoryQueryDto } from './dto/sandbox-query.dto';
import { buildPaginationMeta, paginateOffset } from '../../common/utils/pagination.util';

@Injectable()
export class SandboxHistoryService {
  constructor(
    @InjectRepository(MockTransactionEntity)
    private readonly txRepo: Repository<MockTransactionEntity>,
  ) {}

  async listHistory(apiKeyId: string, query: SandboxHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.api_key_id = :apiKeyId', { apiKeyId });

    if (query.status) {
      qb.andWhere('tx.status = :status', { status: query.status });
    }

    if (query.gateway) {
      qb.andWhere('tx.gateway = :gateway', { gateway: query.gateway.toUpperCase() });
    }

    const sortColumn =
      sortBy === 'amount'
        ? 'tx.amount'
        : sortBy === 'status'
          ? 'tx.status'
          : 'tx.created_at';

    qb.orderBy(sortColumn, sortOrder).skip(offset).take(limit);

    const [transactions, total] = await qb.getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      filters: {
        status: query.status ?? null,
        gateway: query.gateway ?? null,
      },
      sort: { sortBy, sortOrder },
      data: transactions.map((tx) => this.serialize(tx)),
    };
  }

  async getById(apiKeyId: string, transactionId: string) {
    const tx = await this.txRepo.findOne({
      where: { id: transactionId },
      relations: { apiKey: true },
    });

    if (!tx || tx.apiKey.id !== apiKeyId) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return this.serialize(tx);
  }

  serialize(tx: MockTransactionEntity) {
    return {
      transactionId: tx.id,
      phoneNumber: tx.phoneNumber,
      amount: Number(tx.amount),
      status: tx.status,
      provider: tx.gateway,
      failureReason: tx.failureReason,
      clientReference: tx.clientReference,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    };
  }
}
