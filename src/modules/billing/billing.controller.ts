import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/billing.dto';

@ApiTags('Billing')
@Controller('v1/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available billing plans' })
  async listPlans() {
    return this.billingService.listPlans();
  }

  @Get('subscription')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiOperation({ summary: 'Get current subscription for authenticated developer' })
  async getSubscription(@Req() req: AuthenticatedRequest) {
    return this.billingService.getSubscription(req.developer.developerName);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiOperation({ summary: 'Subscribe to a billing plan' })
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubscribeDto,
  ) {
    return this.billingService.subscribe(req.developer, dto.planCode);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiOperation({ summary: 'Cancel active subscription' })
  async cancel(@Req() req: AuthenticatedRequest) {
    return this.billingService.cancel(req.developer);
  }
}
