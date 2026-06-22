import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const SANDBOX_PAYMENT_STATUSES = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
  'REJECTED',
  'CANCELLED',
] as const;

export type SandboxPaymentStatus = (typeof SANDBOX_PAYMENT_STATUSES)[number];

export class SandboxHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SANDBOX_PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(SANDBOX_PAYMENT_STATUSES)
  status?: SandboxPaymentStatus;

  @ApiPropertyOptional({ example: 'MTN_MOMO' })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'amount', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'amount', 'status'])
  sortBy?: 'createdAt' | 'amount' | 'status' = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class SimulateWebhookDto {
  @ApiPropertyOptional({ example: 'payment.success' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  amount?: number;
}
