import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdministrativeUnitEntity } from './entities/administrative-unit.entity';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { LocationsCacheInterceptor } from '../../common/cache/locations-cache.interceptor';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller('v1/locations')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class LocationsController {
  constructor(
    @InjectRepository(AdministrativeUnitEntity)
    private readonly locationRepo: Repository<AdministrativeUnitEntity>,
  ) {}

  @Get('root-provinces')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(LocationsCacheInterceptor)
  @ApiOperation({ summary: 'List all active root provinces' })
  async getProvinces() {
    return await this.locationRepo.find({
      where: { level: 'PROVINCE', isActive: true },
      order: { name: 'ASC' },
    });
  }

  @Get('children')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List child administrative units by parent ID' })
  @ApiQuery({ name: 'parentId', required: true, type: String })
  async getChildrenNodes(@Query('parentId') parentId: string) {
    return await this.locationRepo.find({
      where: { parent: { id: parentId }, isActive: true },
      order: { name: 'ASC' },
    });
  }

  @Get('normalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Normalize a raw address string against NISR hierarchy',
  })
  @ApiQuery({ name: 'rawAddress', required: false, type: String })
  async normalizeInputAddress(@Query('rawAddress') rawAddress: string) {
    if (!rawAddress) return { matchFound: false, cleanText: '' };

    const cleanTokens = rawAddress
      .toLowerCase()
      .replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);

    for (const token of cleanTokens) {
      const match = await this.locationRepo
        .createQueryBuilder('unit')
        .where('LOWER(unit.name) LIKE :pattern', { pattern: `%${token}%` })
        .andWhere('unit.level IN (:...criticalLevels)', {
          criticalLevels: ['DISTRICT', 'SECTOR'],
        })
        .leftJoinAndSelect('unit.parent', 'parent')
        .getOne();

      if (match) {
        return {
          matchFound: true,
          standardizedAddress:
            `${match.name}, ${match.parent ? match.parent.name : ''}`.replace(
              /,\s*$/,
              '',
            ),
          metadata: { id: match.id, level: match.level, code: match.code },
        };
      }
    }

    return { matchFound: false, originalInput: rawAddress };
  }
}
