import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { MockTransactionEntity } from './entities/mock-transaction.entity';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { InitiateMockPaymentDto } from './dto/initiate-mock-payment.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { SandboxHistoryService } from './sandbox-history.service';
import { WebhookService } from '../webhooks/webhook.service';
import {
  SandboxHistoryQueryDto,
  SimulateWebhookDto,
} from './dto/sandbox-query.dto';
import {
  resolvePaymentSimulation,
  SANDBOX_TEST_ACCOUNTS,
} from './payment-simulation';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';

@ApiTags('Sandbox Payments')
@ApiBearerAuth()
@Controller('v1/sandbox/payments')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class SandboxController {
  constructor(
    @InjectRepository(MockTransactionEntity)
    private readonly txRepo: Repository<MockTransactionEntity>,
    private readonly httpService: HttpService,
    private readonly historyService: SandboxHistoryService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post('charge')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Initiate a mock telecom payment charge' })
  @ApiResponse({
    status: 202,
    description: 'Transaction accepted for async processing',
    type: ApiSuccessResponseDto,
  })
  async runMockChargeEngine(
    @Body() dto: InitiateMockPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const activeDeveloper = req.developer;

    const normalizedDigits = dto.phoneNumber.replace(/\s+/g, '');
    const isMtn = /(?:\+250|0)?7[89]/.test(normalizedDigits);
    const targetGateway = isMtn ? 'MTN_MOMO' : 'AIRTEL_MONEY';

    const simulation = resolvePaymentSimulation(dto.amount);
    const isImmediateFailure = simulation.status !== 'SUCCESS';

    const initialStatus =
      simulation.status === 'SUCCESS' ? 'PENDING' : simulation.status;

    const transactionRecord = this.txRepo.create({
      apiKey: activeDeveloper,
      phoneNumber: dto.phoneNumber,
      amount: dto.amount,
      gateway: targetGateway,
      status: initialStatus,
      failureReason: simulation.failureReason,
      webhookUrl: dto.webhookUrl,
      clientReference: dto.clientReference,
      completedAt: isImmediateFailure ? new Date() : null,
    });

    const savedTx = await this.txRepo.save(transactionRecord);

    if (isImmediateFailure) {
      void this.webhookService
        .dispatchEventForDeveloper(activeDeveloper.id, 'payment.failed', {
          transactionId: savedTx.id,
          amount: Number(savedTx.amount),
          status: savedTx.status,
          error: simulation.failureReason,
        })
        .catch(() => undefined);
    }

    if (simulation.status === 'SUCCESS') {
      setTimeout(async () => {
        const payloadDelivery = {
          transactionId: savedTx.id,
          clientReference: savedTx.clientReference,
          amount: Number(savedTx.amount),
          gateway: savedTx.gateway,
          status: 'SUCCESS',
          error: null,
          timestamp: new Date().toISOString(),
        };

        try {
          await firstValueFrom(
            this.httpService.post(savedTx.webhookUrl, payloadDelivery, {
              timeout: 4000,
            }),
          );

          await this.txRepo.update(savedTx.id, {
            status: 'SUCCESS',
            completedAt: new Date(),
          });
          void this.webhookService
            .dispatchEventForDeveloper(
              activeDeveloper.id,
              'payment.success',
              payloadDelivery,
            )
            .catch(() => undefined);
        } catch {
          await this.txRepo.update(savedTx.id, {
            status: 'FAILED',
            failureReason: 'ERR_WEBHOOK_DELIVERY_FAILED',
            completedAt: new Date(),
          });
        }
      }, 3000);
    }

    return {
      message:
        'Transaction request successfully accepted. Processing simulation underway.',
      transactionId: savedTx.id,
      simulatedGateway: targetGateway,
      simulatedStatus: initialStatus,
      checkStatusEndpoint: `/v1/sandbox/payments/status/${savedTx.id}`,
    };
  }

  @Post('webhook/simulate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Simulate a payment webhook delivery to registered endpoints',
  })
  @ApiResponse({ status: 202, type: ApiSuccessResponseDto })
  async simulateWebhook(
    @Body() dto: SimulateWebhookDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const eventType = dto.eventType ?? 'payment.success';
    const payload = {
      transactionId: dto.transactionId ?? `sim_${Date.now()}`,
      amount: dto.amount ?? 5000,
      status: eventType.includes('failed') ? 'FAILED' : 'SUCCESS',
      simulated: true,
      timestamp: new Date().toISOString(),
    };

    await this.webhookService.dispatchEventForDeveloper(
      req.developer.id,
      eventType,
      payload,
    );

    return {
      message: 'Webhook simulation queued for delivery',
      eventType,
      payload,
    };
  }

  @Get('test-accounts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List sandbox test accounts and amount triggers for payment simulation',
  })
  async listTestAccounts() {
    return {
      accounts: SANDBOX_TEST_ACCOUNTS,
      rules: {
        success: 'amount < 100000 (unless magic amount triggered)',
        insufficientFunds: 'amount = 111111',
        timeout: 'amount = 222222',
        rejected: 'amount = 333333',
        networkError: 'amount = 444444',
      },
      statuses: [
        'PENDING',
        'SUCCESS',
        'FAILED',
        'TIMEOUT',
        'REJECTED',
        'CANCELLED',
      ],
    };
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List sandbox payment transaction history with filtering and sorting',
  })
  async listHistory(
    @Req() req: AuthenticatedRequest,
    @Query() query: SandboxHistoryQueryDto,
  ) {
    return this.historyService.listHistory(req.developer.id, query);
  }

  @Get('history/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single sandbox transaction by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getHistoryItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.historyService.getById(req.developer.id, id);
  }

  @Get('status/:transactionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check mock transaction status' })
  @ApiParam({ name: 'transactionId', type: 'string' })
  async getTransactionStatus(
    @Param('transactionId') transactionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.historyService.getById(req.developer.id, transactionId);
  }
}
