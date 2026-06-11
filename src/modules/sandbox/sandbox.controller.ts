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
  NotFoundException,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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
  })
  async runMockChargeEngine(
    @Body() dto: InitiateMockPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const activeDeveloper = req.developer;

    const normalizedDigits = dto.phoneNumber.replace(/\s+/g, '');
    const isMtn = /(?:\+250|0)?7[89]/.test(normalizedDigits);
    const targetGateway = isMtn ? 'MTN_MOMO' : 'AIRTEL_MONEY';

    let targetStatus = 'SUCCESS';
    let negativeCode: string | null = null;

    if (dto.amount === 3003) {
      targetStatus = 'FAILED';
      negativeCode = 'ERR_INSUFFICIENT_FUNDS';
    } else if (dto.amount === 4004) {
      targetStatus = 'FAILED';
      negativeCode = 'ERR_USER_CANCELLATION_REJECT';
    } else if (dto.amount === 5005) {
      targetStatus = 'FAILED';
      negativeCode = 'ERR_TIMEOUT_EXPIRED';
    }

    const transactionRecord = this.txRepo.create({
      apiKey: activeDeveloper,
      phoneNumber: dto.phoneNumber,
      amount: dto.amount,
      gateway: targetGateway,
      status: targetStatus === 'SUCCESS' ? 'PENDING' : 'FAILED',
      failureReason: negativeCode,
      webhookUrl: dto.webhookUrl,
      clientReference: dto.clientReference,
      completedAt: targetStatus === 'FAILED' ? new Date() : null,
    });

    const savedTx = await this.txRepo.save(transactionRecord);

    if (targetStatus === 'FAILED') {
      void this.webhookService
        .dispatchEventForDeveloper(activeDeveloper.id, 'payment.failed', {
          transactionId: savedTx.id,
          amount: Number(savedTx.amount),
          status: targetStatus,
          error: negativeCode,
        })
        .catch(() => undefined);
    }

    setTimeout(async () => {
      const payloadDelivery = {
        transactionId: savedTx.id,
        clientReference: savedTx.clientReference,
        amount: Number(savedTx.amount),
        gateway: savedTx.gateway,
        status: targetStatus,
        error: negativeCode,
        timestamp: new Date().toISOString(),
      };

      try {
        await firstValueFrom(
          this.httpService.post(savedTx.webhookUrl, payloadDelivery, {
            timeout: 4000,
          }),
        );

        if (targetStatus === 'SUCCESS') {
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
        }
      } catch {
        await this.txRepo.update(savedTx.id, {
          status: 'FAILED',
          failureReason: 'ERR_WEBHOOK_DELIVERY_FAILED',
          completedAt: new Date(),
        });
      }
    }, 3000);

    return {
      message:
        'Transaction request successfully accepted. Processing simulation underway.',
      transactionId: savedTx.id,
      simulatedGateway: targetGateway,
      checkStatusEndpoint: `/v1/sandbox/payments/status/${savedTx.id}`,
    };
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List sandbox payment transaction history' })
  async listHistory(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
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
  async getTransactionStatus(@Param('transactionId') transactionId: string) {
    const tx = await this.txRepo.findOne({ where: { id: transactionId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found.');
    }
    return tx;
  }
}
