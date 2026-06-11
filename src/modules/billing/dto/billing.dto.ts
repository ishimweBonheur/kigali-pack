import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ example: 'PRO', enum: ['FREE', 'PRO', 'ENTERPRISE'] })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  planCode!: string;
}
