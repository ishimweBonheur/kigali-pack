import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhooks/kigali-pack' })
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url!: string;

  @ApiProperty({
    example: ['payment.success', 'payment.failed'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ example: 'Production payment webhook' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
