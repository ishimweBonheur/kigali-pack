import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OrganizationRole } from '../entities/organization-member.entity';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Rwanda Ltd' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'owner@acme.rw' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  ownerPassword!: string;
}

export class AddMemberDto {
  @ApiProperty({ example: 'dev@acme.rw' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'DevPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: OrganizationRole, default: OrganizationRole.DEVELOPER })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}

export class LoginDto {
  @ApiProperty({ example: 'owner@acme.rw' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  memberId!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;
}
