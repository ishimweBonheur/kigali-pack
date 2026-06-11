import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('System Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full system health check' })
  async health(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.getHealth();
    if (result.status === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.getReady();
    if (!result.ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return this.healthService.getLive();
  }

  @Get('version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Application version metadata' })
  version() {
    return this.healthService.getVersion();
  }
}
