import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ApiLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'GET' })
  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  @ApiPropertyOptional({ example: 400, description: 'Filter by HTTP status code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;
}

export interface ApiLogListItem {
  id: string;
  method: string;
  routePath: string;
  httpStatusCode: number;
  executionTimeMs: number;
  clientIp: string | null;
  maskedPayloadSnapshot: {
    request: string;
    response: string;
  };
  createdAt: Date;
}

export interface ApiLogDetail extends ApiLogListItem {
  apiKeyId: string;
}
