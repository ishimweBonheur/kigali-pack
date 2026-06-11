import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeyEnvironment, ApiKeyTier } from '../enums/api-key.enum';

export class ApiKeyResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiPropertyOptional({ example: 'Production Mobile App', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'kp_live_abcd1234' })
  keyPrefix!: string;

  @ApiProperty({ enum: ApiKeyEnvironment, example: ApiKeyEnvironment.LIVE })
  environment!: ApiKeyEnvironment;

  @ApiProperty({ enum: ApiKeyTier, example: ApiKeyTier.FREE })
  tier!: ApiKeyTier;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59.000Z', nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-06-10T14:30:00.000Z', nullable: true })
  lastUsedAt!: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  createdAt!: Date;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    example: 'kp_live_a1b2c3d4e5f6789012345678901234567890abcdef',
    description:
      'Raw API key token. Shown only once — store it securely. It cannot be retrieved later.',
  })
  rawToken!: string;
}

export class RotateApiKeyResponseDto extends CreateApiKeyResponseDto {
  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'ID of the newly created replacement key',
  })
  newKeyId!: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID of the revoked key that was rotated',
  })
  revokedKeyId!: string;
}
