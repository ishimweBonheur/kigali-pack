import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
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
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@ApiTags('Developer Webhooks')
@ApiBearerAuth()
@Controller('v1/developer/webhooks')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhookService.create(req.developer, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List registered webhooks' })
  async list(@Req() req: AuthenticatedRequest) {
    return this.webhookService.list(req.developer);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a webhook' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(req.developer, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhookService.remove(req.developer, id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a test webhook delivery' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async test(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhookService.test(req.developer, id);
  }
}
