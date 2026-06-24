import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeUnitEntity } from './entities/administrative-unit.entity';
import { CacheService } from '../../common/cache/cache.service';
import {
  buildPaginationMeta,
  paginateOffset,
} from '../../common/utils/pagination.util';

const NORMALIZE_CACHE_TTL = 600;

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(AdministrativeUnitEntity)
    private readonly locationRepo: Repository<AdministrativeUnitEntity>,
    private readonly cacheService: CacheService,
  ) {}

  async getRootProvinces() {
    return this.locationRepo.find({
      where: { level: 'PROVINCE', isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getChildrenByParentId(parentId: string, page = 1, limit = 50) {
    const offset = paginateOffset(page, limit);

    const [items, total] = await this.locationRepo.findAndCount({
      where: { parent: { id: parentId }, isActive: true },
      order: { name: 'ASC' },
      skip: offset,
      take: limit,
    });

    return {
      items,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async normalizeAddress(rawAddress: string): Promise<Record<string, unknown>> {
    const cacheKey = `locations:normalize:${rawAddress.toLowerCase().trim()}`;
    const cached =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await this.performNormalization(rawAddress);
    await this.cacheService.set(cacheKey, result, NORMALIZE_CACHE_TTL);
    return { ...result, cached: false };
  }

  private async performNormalization(
    rawAddress: string,
  ): Promise<Record<string, unknown>> {
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
