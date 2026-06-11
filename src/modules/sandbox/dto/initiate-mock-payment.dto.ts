import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

export class InitiateMockPaymentDto {
  @ApiProperty({
    example: '0781234567',
    description: 'Rwandan mobile number (MTN or Airtel)',
  })
  @IsNotEmpty()
  @Matches(/^(?:\+250|0)?7[2389]\d{7}$/, {
    message: 'Invalid Rwandan network telephone format standard.',
  })
  phoneNumber!: string;

  @ApiProperty({
    example: 1001,
    description: 'Amount in RWF (1001=success, 3003=insufficient funds)',
  })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ example: 'https://your-server.com/webhook' })
  @IsUrl()
  @IsNotEmpty()
  webhookUrl!: string;

  @ApiProperty({ example: 'order-ref-001' })
  @IsString()
  @IsNotEmpty()
  clientReference!: string;
}
