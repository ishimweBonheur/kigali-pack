import {
  Controller,
  Get,
  Query,
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
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AnalyticsQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiLogsQueryDto } from './dto/api-logs.dto';
import { AnalyticsService } from './analytics.service';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';

@ApiTags('Developer Analytics')
@ApiBearerAuth()
@Controller('v1/developer/analytics')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get aggregated analytics dashboard summary',
    description:
      'Optimized single-call summary combining usage, errors, latency, and top endpoints.',
  })
  async getSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSummary(req.developer.id, query);
  }

  @Get('usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get aggregated API usage statistics' })
  async getUsage(
    @Req() req: AuthenticatedRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getUsage(req.developer.id, query);
  }

  @Get('errors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get API error analytics' })
  async getErrors(
    @Req() req: AuthenticatedRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getErrors(req.developer.id, query);
  }

  @Get('latency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get API latency analytics' })
  async getLatency(
    @Req() req: AuthenticatedRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getLatency(req.developer.id, query);
  }

  @Get('endpoints')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get per-endpoint usage breakdown' })
  async getEndpoints(
    @Req() req: AuthenticatedRequest,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getEndpoints(req.developer.id, query);
  }

  @Get('logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List paginated API traffic logs for debugging' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async listLogs(
    @Req() req: AuthenticatedRequest,
    @Query() query: ApiLogsQueryDto,
  ) {
    return this.analyticsService.listLogs(req.developer.id, query);
  }

  @Get('logs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single API log record by UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto })
  async getLogById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const log = await this.analyticsService.getLogById(req.developer.id, id);
    return {
      data: log,
      message: 'Log record retrieved successfully',
    };
  }
}
