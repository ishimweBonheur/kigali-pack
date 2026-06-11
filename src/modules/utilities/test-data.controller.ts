import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { TestDataService } from './test-data.service';

@ApiTags('Utilities — Test Data')
@ApiBearerAuth()
@Controller('v1/utilities')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class TestDataController {
  constructor(private readonly testDataService: TestDataService) {}

  @Get('citizens/random')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a random Rwanda citizen profile' })
  async randomCitizen() {
    return this.testDataService.randomCitizen();
  }

  @Get('addresses/random')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a random Rwanda address' })
  async randomAddress() {
    return this.testDataService.randomAddress();
  }
}
