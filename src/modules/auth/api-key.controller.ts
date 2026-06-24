import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  ParseUUIDPipe,
  Query,
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
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  ApiKeyResponseDto,
  CreateApiKeyResponseDto,
  RotateApiKeyResponseDto,
} from './dto/api-key-response.dto';

@ApiTags('Developer API Keys')
@ApiBearerAuth('bearer')
@ApiBearerAuth('jwt')
@Controller('v1/developer/api-keys')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: 201,
    description: 'API key created. Raw token is returned once only.',
    type: CreateApiKeyResponseDto,
  })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    return this.apiKeyService.create(req.developer, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all API keys for the authenticated developer',
    description:
      'Accepts JWT (paste only accessToken) or developer API key (kp_test_...).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys (hashes are never exposed)',
    type: [ApiKeyResponseDto],
  })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    return this.apiKeyService.listByDeveloper(
      req.developer.developerName,
      query,
    );
  }

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'API key revoked',
    type: ApiKeyResponseDto,
  })
  async revoke(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.revoke(req.developer, id);
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate an API key',
    description:
      'Revokes the existing key and issues a replacement with the same environment and tier. Raw token is returned once only.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'API key rotated. New raw token is returned once only.',
    type: RotateApiKeyResponseDto,
  })
  async rotate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RotateApiKeyResponseDto> {
    return this.apiKeyService.rotate(req.developer, id);
  }
}
