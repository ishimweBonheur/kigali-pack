import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/billing.dto';
import { JwtPayload } from '../organizations/organization.service';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';

interface JwtRequest {
  member: JwtPayload;
}

@ApiTags('Billing')
@Controller('v1/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available billing plans (public)' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async listPlans() {
    const plans = await this.billingService.listPlans();
    return { data: plans, message: 'Billing plans retrieved successfully' };
  }

  @Get('subscriptions/current')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, TierThrottlerGuard)
  @ApiOperation({ summary: 'Get current subscription (JWT)' })
  async getCurrentSubscriptionJwt(@Req() req: JwtRequest) {
    const developerName = await this.billingService.resolveDeveloperNameFromJwt(
      req.member,
    );
    const subscription = await this.billingService.getSubscription(developerName);
    return {
      data: subscription,
      message: 'Current subscription retrieved successfully',
    };
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, TierThrottlerGuard)
  @ApiOperation({ summary: 'Subscribe to a billing plan (JWT)' })
  async createSubscriptionJwt(
    @Req() req: JwtRequest,
    @Body() dto: SubscribeDto,
  ) {
    const developer = await this.billingService.resolveApiKeyFromJwt(req.member);
    const result = await this.billingService.subscribe(developer, dto.planCode);
    return { data: result, message: 'Subscription created successfully' };
  }

  @Delete('subscriptions/current')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, TierThrottlerGuard)
  @ApiOperation({ summary: 'Cancel current subscription (JWT)' })
  async cancelCurrentSubscriptionJwt(@Req() req: JwtRequest) {
    const developer = await this.billingService.resolveApiKeyFromJwt(req.member);
    const result = await this.billingService.cancel(developer);
    return { data: result, message: 'Subscription cancelled successfully' };
  }

  @Get('subscription')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiOperation({
    summary: 'Get current subscription (deprecated — use GET /subscriptions/current with JWT)',
    deprecated: true,
  })
  async getSubscription(@Req() req: AuthenticatedRequest) {
    const subscription = await this.billingService.getSubscription(
      req.developer.developerName,
    );
    return {
      data: subscription,
      message: 'Current subscription retrieved successfully (deprecated endpoint)',
    };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiOperation({
    summary: 'Subscribe to a billing plan (deprecated — use POST /subscriptions with JWT)',
    deprecated: true,
  })
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubscribeDto,
  ) {
    const result = await this.billingService.subscribe(req.developer, dto.planCode);
    return {
      data: result,
      message: 'Subscription created successfully (deprecated endpoint)',
    };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiOperation({
    summary: 'Cancel active subscription (deprecated — use DELETE /subscriptions/current with JWT)',
    deprecated: true,
  })
  async cancel(@Req() req: AuthenticatedRequest) {
    const result = await this.billingService.cancel(req.developer);
    return {
      data: result,
      message: 'Subscription cancelled successfully (deprecated endpoint)',
    };
  }

  @Get('invoices')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List historical invoices for the organization (JWT)' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async listInvoices(@Req() req: JwtRequest) {
    const invoices = await this.billingService.listInvoices(req.member);
    return {
      data: invoices,
      message: 'Invoices retrieved successfully',
    };
  }

  @Get('invoices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a specific invoice by ID (JWT)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto })
  async getInvoice(
    @Req() req: JwtRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const invoice = await this.billingService.getInvoiceById(req.member, id);
    return {
      data: invoice,
      message: 'Invoice retrieved successfully',
    };
  }

  @Get('usage-counter')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current monthly API usage against plan limit (JWT)',
  })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async getUsageCounter(@Req() req: JwtRequest) {
    const counter = await this.billingService.getUsageCounter(req.member);
    return {
      data: counter,
      message: 'Usage counter retrieved successfully',
    };
  }
}
