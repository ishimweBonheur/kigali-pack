import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OrganizationRole } from '../../organizations/entities/organization-member.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Rwanda Ltd' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  organizationName!: string;

  @ApiProperty({ example: 'owner@acme.rw' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    enum: [OrganizationRole.ORG_OWNER, OrganizationRole.DEVELOPER],
    default: OrganizationRole.ORG_OWNER,
  })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}

export class AuthLoginDto {
  @ApiProperty({ example: 'owner@acme.rw' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token issued at login or register' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token to revoke' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;

  @ApiProperty()
  memberId!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty()
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'owner@acme.rw' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from forgot-password flow' })
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  @MinLength(32)
  token!: string;
}
