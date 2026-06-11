import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiKeyEnvironment } from '../enums/api-key.enum';

export class CreateApiKeyDto {
  @ApiPropertyOptional({
    example: 'Production Mobile App',
    description: 'Human-readable label for this API key',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    enum: ApiKeyEnvironment,
    example: ApiKeyEnvironment.TEST,
    description: 'Key environment scope',
  })
  @IsNotEmpty()
  @IsEnum(ApiKeyEnvironment)
  environment!: ApiKeyEnvironment;

  @ApiPropertyOptional({
    example: '2027-12-31T23:59:59.000Z',
    description: 'Optional expiration timestamp (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
