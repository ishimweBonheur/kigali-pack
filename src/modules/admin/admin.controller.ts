import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';
import {
  AdminDevelopersQueryDto,
  AdminSubscriptionsQueryDto,
  AdminTelemetryQueryDto,
  InvoiceStatusDto,
  RestrictDeveloperDto,
  TierOverrideDto,
} from './dto/admin.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Master Admin')
@ApiBearerAuth('jwt')
@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System overview command center metrics' })
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('billing/subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all platform subscriptions' })
  listSubscriptions(@Query() query: AdminSubscriptionsQueryDto) {
    return this.adminService.listSubscriptions(query);
  }

  @Put('billing/subscriptions/:id/tier-override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-override subscription tier and API limits' })
  @ApiParam({ name: 'id', format: 'uuid' })
  overrideTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TierOverrideDto,
  ) {
    return this.adminService.overrideSubscriptionTier(id, dto);
  }

  @Patch('billing/invoices/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually update invoice payment status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateInvoiceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvoiceStatusDto,
  ) {
    return this.adminService.updateInvoiceStatus(id, dto);
  }

  @Get('developers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all platform developers' })
  listDevelopers(@Query() query: AdminDevelopersQueryDto) {
    return this.adminService.listDevelopers(query);
  }

  @Post('developers/:id/restrict')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend developer and revoke all API keys' })
  @ApiParam({ name: 'id', format: 'uuid' })
  restrictDeveloper(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestrictDeveloperDto,
  ) {
    return this.adminService.restrictDeveloper(id, dto);
  }

  @Get('telemetry/live-stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Live telemetry audit stream (metadata footprints)' })
  telemetryLiveStream(@Query() query: AdminTelemetryQueryDto) {
    return this.adminService.getTelemetryLiveStream(query);
  }

  @Get('webhooks/failures')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform-wide failing webhook deliveries' })
  webhookFailures(@Query() query: PaginationQueryDto) {
    return this.adminService.listWebhookFailures(query);
  }
}
