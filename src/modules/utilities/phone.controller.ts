import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { TransientProcessing } from '../../common/decorators/transient-processing.decorator';
import { PhoneService } from './phone.service';

@ApiTags('Utilities — Phone Intelligence')
@ApiBearerAuth()
@Controller('v1/utilities/phone')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  @Get('validate')
  @TransientProcessing()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a Rwanda phone number' })
  @ApiQuery({ name: 'phone', required: true })
  validate(@Query('phone') phone: string) {
    return this.phoneService.validate(phone);
  }

  @Get('carrier')
  @TransientProcessing()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detect MTN or Airtel carrier' })
  @ApiQuery({ name: 'phone', required: true })
  carrier(@Query('phone') phone: string) {
    return this.phoneService.detectCarrier(phone);
  }

  @Get('format')
  @TransientProcessing()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Format a Rwanda phone number' })
  @ApiQuery({ name: 'phone', required: true })
  @ApiQuery({
    name: 'style',
    required: false,
    enum: ['E164', 'INTERNATIONAL', 'NATIONAL'],
  })
  format(
    @Query('phone') phone: string,
    @Query('style') style: 'E164' | 'INTERNATIONAL' | 'NATIONAL' = 'E164',
  ) {
    return this.phoneService.format(phone, style);
  }
}
