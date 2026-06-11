import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
import { InitiateMockPaymentDto } from './dto/initiate-mock-payment.dto';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';

interface AuthenticatedRequest {
  developer: ApiKeyEntity;
}

@ApiTags('Sandbox Payments')
@ApiBearerAuth()
@Controller('v1/sandbox/payments')
@UseGuards(ApiKeyGuard)
export class SandboxController {
  constructor(
    @InjectRepository(MockTransactionEntity)
    private readonly txRepo: Repository<MockTransactionEntity>,
    private readonly httpService: HttpService,
  ) {}

  @Post('charge')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Initiate a mock telecom payment charge' })
  @ApiResponse({ status: 202, description: 'Transaction accepted for async processing' })
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
    });

    const savedTx = await this.txRepo.save(transactionRecord);

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
          await this.txRepo.update(savedTx.id, { status: 'SUCCESS' });
        }
      } catch {
        console.error(
          `Webhook pipeline delivery drop out for transaction: ${savedTx.id}. Target offline.`,
        );
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
