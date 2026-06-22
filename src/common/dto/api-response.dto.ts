import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}

export class ApiSuccessResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Operation completed successfully' })
  message!: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional({ example: {} })
  meta?: Record<string, unknown>;
}

export interface ApiSuccessPayload<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function successResponse<T>(
  data: T,
  message = 'Operation completed successfully',
  meta: Record<string, unknown> = {},
): ApiSuccessPayload<T> {
  return { success: true, message, data, meta };
}
