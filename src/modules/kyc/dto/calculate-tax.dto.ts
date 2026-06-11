import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CalculateTaxDto {
  @ApiProperty({ example: 150000, description: 'Gross salary in RWF' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  grossSalary!: number;
}
