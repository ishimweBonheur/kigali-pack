import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SubscriptionStatus } from '../../billing/entities/subscription.entity';
import { InvoiceStatus } from '../../billing/entities/invoice.entity';

export class AdminSubscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['FREE', 'PRO', 'ENTERPRISE'] })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class TierOverrideDto {
  @ApiPropertyOptional({ example: 'PRO' })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Custom hourly API limit' })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerHour?: number;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class InvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;
}

export class RestrictDeveloperDto {
  @ApiPropertyOptional({ example: 'Abuse of sandbox payment endpoints' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminTelemetryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsInt()
  statusCode?: number;
}

export class AdminDevelopersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export interface AdminOverviewMetrics {
  totalOrganizations: number;
  totalActiveApiKeys: number;
  totalMrrRwf: number;
  globalAverageLatencyMs: number;
  globalErrorRate: number;
}
