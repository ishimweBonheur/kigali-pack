import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DeprecatedEndpoint } from '../../common/decorators/deprecated-endpoint.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { LocationsCacheInterceptor } from '../../common/cache/locations-cache.interceptor';
import { LocationsService } from './locations.service';
import {
  LocationChildrenQueryDto,
  NormalizeAddressDto,
} from './dto/locations.dto';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';

@ApiTags('Locations')
@Controller('v1/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('root-provinces')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(LocationsCacheInterceptor)
  @ApiOperation({
    summary: 'List all active root provinces',
    description: 'Public endpoint — no authentication required.',
  })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  async getProvinces() {
    const provinces = await this.locationsService.getRootProvinces();
    return {
      data: provinces,
      message: 'Root provinces retrieved successfully',
    };
  }

  @Get('children')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @DeprecatedEndpoint({
    link: '/v1/locations/:parentId/children',
    sunset: process.env.API_SUNSET_DATE ?? '2026-12-31',
  })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List child administrative units by parent ID (deprecated)',
    description:
      'Deprecated — use GET /v1/locations/:parentId/children instead.',
    deprecated: true,
  })
  @ApiQuery({ name: 'parentId', required: true, type: String })
  async getChildrenNodesLegacy(
    @Query('parentId', ParseUUIDPipe) parentId: string,
    @Query() query: LocationChildrenQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { items, pagination } =
      await this.locationsService.getChildrenByParentId(parentId, page, limit);
    return {
      data: items,
      pagination,
      message: 'Child locations retrieved successfully (deprecated endpoint)',
    };
  }

  @Post('normalize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiBearerAuth('bearer')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Normalize a raw address string against NISR hierarchy',
    description:
      'Accepts a developer API key (kp_test_...) or JWT access token from POST /v1/auth/login.',
  })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async normalizeAddress(@Body() dto: NormalizeAddressDto) {
    const result = await this.locationsService.normalizeAddress(dto.address);
    return {
      data: result,
      message:
        'matchFound' in result && result.matchFound
          ? 'Address normalized successfully'
          : 'No matching location found',
    };
  }

  @Get('normalize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @DeprecatedEndpoint({
    link: '/v1/locations/normalize',
    sunset: process.env.API_SUNSET_DATE ?? '2026-12-31',
  })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Normalize address via query string (deprecated)',
    description:
      'Deprecated — use POST /v1/locations/normalize with JSON body.',
    deprecated: true,
  })
  @ApiQuery({ name: 'rawAddress', required: false, type: String })
  async normalizeInputAddressLegacy(@Query('rawAddress') rawAddress?: string) {
    if (!rawAddress) {
      return {
        data: { matchFound: false, cleanText: '' },
        message: 'No address provided',
      };
    }
    const result = await this.locationsService.normalizeAddress(rawAddress);
    return {
      data: result,
      message:
        'matchFound' in result && result.matchFound
          ? 'Address normalized successfully'
          : 'No matching location found',
    };
  }

  @Get(':parentId/children')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard, TierThrottlerGuard)
  @ApiBearerAuth('bearer')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'List child administrative units by parent ID (RESTful)',
  })
  @ApiParam({ name: 'parentId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async getChildrenByParentId(
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Query() query: LocationChildrenQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { items, pagination } =
      await this.locationsService.getChildrenByParentId(parentId, page, limit);
    return {
      data: items,
      pagination,
      message: 'Child locations retrieved successfully',
    };
  }
}
