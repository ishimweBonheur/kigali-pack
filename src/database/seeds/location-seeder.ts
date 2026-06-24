import { DataSource, EntityManager } from 'typeorm';
import rwandaDataset from '../raw-data/rwanda-hierarchy.json';
import {
  AdministrativeUnitEntity,
  AdministrativeUnitLevel,
} from '../../modules/locations/entities/administrative-unit.entity';

const VILLAGE_BATCH_SIZE = 1000;

const CHILD_LEVEL: Record<
  Exclude<AdministrativeUnitLevel, 'VILLAGE'>,
  AdministrativeUnitLevel
> = {
  PROVINCE: 'DISTRICT',
  DISTRICT: 'SECTOR',
  SECTOR: 'CELL',
  CELL: 'VILLAGE',
};

const NESTED_CHILD_KEYS: Record<
  Exclude<AdministrativeUnitLevel, 'VILLAGE'>,
  string
> = {
  PROVINCE: 'districts',
  DISTRICT: 'sectors',
  SECTOR: 'cells',
  CELL: 'villages',
};

interface FlatRwandaRecord {
  province_code?: number | string;
  province_name?: string;
  district_code?: number | string;
  district_name?: string;
  sector_code?: number | string;
  sector_name?: string;
  cell_code?: number | string;
  cell_name?: string;
  village_code?: number | string;
  village_name?: string;
}

interface RawNestedNode {
  name?: string;
  code?: string | number;
  level?: AdministrativeUnitLevel;
  children?: RawNestedNode[];
  districts?: RawNestedNode[];
  sectors?: RawNestedNode[];
  cells?: RawNestedNode[];
  villages?: RawNestedNode[];
}

export interface LocationTreeNode {
  name: string;
  code: string;
  level: AdministrativeUnitLevel;
  children: LocationTreeNode[];
}

type RwandaDatasetRoot =
  | RawNestedNode[]
  | FlatRwandaRecord[]
  | { provinces: RawNestedNode[] };

function trimValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function isFlatRecord(value: unknown): value is FlatRwandaRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as FlatRwandaRecord;
  return (
    record.province_name !== undefined ||
    record.district_name !== undefined ||
    record.village_name !== undefined
  );
}

function isProvincesWrapper(
  value: unknown,
): value is { provinces: RawNestedNode[] } {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { provinces?: unknown }).provinces)
  );
}

function resolveRootProvinces(
  dataset: unknown,
): RawNestedNode[] | FlatRwandaRecord[] {
  if (Array.isArray(dataset)) {
    return dataset;
  }

  if (isProvincesWrapper(dataset)) {
    return dataset.provinces;
  }

  throw new Error(
    'Unsupported Rwanda hierarchy dataset shape. Expected a root array or { provinces: [...] }.',
  );
}

function resolveNestedChildren(
  node: RawNestedNode,
  level: Exclude<AdministrativeUnitLevel, 'VILLAGE'>,
): RawNestedNode[] {
  const keyed = node[NESTED_CHILD_KEYS[level] as keyof RawNestedNode];
  if (Array.isArray(keyed)) {
    return keyed;
  }

  if (Array.isArray(node.children)) {
    return node.children;
  }

  return [];
}

function normalizeNestedNode(
  node: RawNestedNode,
  level: AdministrativeUnitLevel,
): LocationTreeNode {
  const name = trimValue(node.name);
  const code = trimValue(node.code);

  if (!name) {
    throw new Error(
      `Encountered ${level} node without a name during normalization.`,
    );
  }

  if (!code) {
    throw new Error(
      `Encountered ${level} node "${name}" without a code during normalization.`,
    );
  }

  const normalized: LocationTreeNode = {
    name,
    code,
    level,
    children: [],
  };

  if (level === 'VILLAGE') {
    return normalized;
  }

  const childLevel = CHILD_LEVEL[level];
  const rawChildren = resolveNestedChildren(node, level);

  normalized.children = rawChildren.map((child) =>
    normalizeNestedNode(child, childLevel),
  );

  return normalized;
}

function buildTreeFromFlatRecords(
  records: FlatRwandaRecord[],
): LocationTreeNode[] {
  const provinceMap = new Map<string, LocationTreeNode>();

  for (const row of records) {
    const provinceCode = trimValue(row.province_code);
    const provinceName = trimValue(row.province_name);
    const districtCode = trimValue(row.district_code);
    const districtName = trimValue(row.district_name);
    const sectorCode = trimValue(row.sector_code);
    const sectorName = trimValue(row.sector_name);
    const cellCode = trimValue(row.cell_code);
    const cellName = trimValue(row.cell_name);
    const villageCode = trimValue(row.village_code);
    const villageName = trimValue(row.village_name);

    if (
      !provinceCode ||
      !provinceName ||
      !districtCode ||
      !districtName ||
      !sectorCode ||
      !sectorName ||
      !cellCode ||
      !cellName ||
      !villageCode ||
      !villageName
    ) {
      continue;
    }

    let province = provinceMap.get(provinceCode);
    if (!province) {
      province = {
        name: provinceName,
        code: provinceCode,
        level: 'PROVINCE',
        children: [],
      };
      provinceMap.set(provinceCode, province);
    }

    let district = province.children.find((node) => node.code === districtCode);
    if (!district) {
      district = {
        name: districtName,
        code: districtCode,
        level: 'DISTRICT',
        children: [],
      };
      province.children.push(district);
    }

    let sector = district.children.find((node) => node.code === sectorCode);
    if (!sector) {
      sector = {
        name: sectorName,
        code: sectorCode,
        level: 'SECTOR',
        children: [],
      };
      district.children.push(sector);
    }

    let cell = sector.children.find((node) => node.code === cellCode);
    if (!cell) {
      cell = {
        name: cellName,
        code: cellCode,
        level: 'CELL',
        children: [],
      };
      sector.children.push(cell);
    }

    if (!cell.children.some((node) => node.code === villageCode)) {
      cell.children.push({
        name: villageName,
        code: villageCode,
        level: 'VILLAGE',
        children: [],
      });
    }
  }

  return Array.from(provinceMap.values());
}

function buildLocationTree(dataset: unknown): LocationTreeNode[] {
  const root = resolveRootProvinces(dataset);

  if (root.length === 0) {
    return [];
  }

  if (isFlatRecord(root[0])) {
    console.log(
      `[LocationSeeder] Detected flat Rwanda hierarchy records (${root.length} rows). Building 5-tier tree in memory...`,
    );
    return buildTreeFromFlatRecords(root as FlatRwandaRecord[]);
  }

  console.log(
    `[LocationSeeder] Detected nested Rwanda hierarchy graph (${root.length} root provinces).`,
  );

  return (root as RawNestedNode[]).map((province) =>
    normalizeNestedNode(province, province.level ?? 'PROVINCE'),
  );
}

function countNodesByLevel(
  nodes: LocationTreeNode[],
  accumulator: Record<AdministrativeUnitLevel, number>,
): void {
  for (const node of nodes) {
    accumulator[node.level] += 1;
    if (node.children.length > 0) {
      countNodesByLevel(node.children, accumulator);
    }
  }
}

export class LocationSeeder {
  static async run(dataSource: DataSource): Promise<void> {
    const tree = buildLocationTree(rwandaDataset);

    if (tree.length === 0) {
      console.warn(
        '[LocationSeeder] No administrative units resolved from dataset.',
      );
      return;
    }

    const levelCounts: Record<AdministrativeUnitLevel, number> = {
      PROVINCE: 0,
      DISTRICT: 0,
      SECTOR: 0,
      CELL: 0,
      VILLAGE: 0,
    };
    countNodesByLevel(tree, levelCounts);

    console.log('[LocationSeeder] Resolved hierarchy footprint:');
    console.log(`  Provinces: ${levelCounts.PROVINCE}`);
    console.log(`  Districts: ${levelCounts.DISTRICT}`);
    console.log(`  Sectors:  ${levelCounts.SECTOR}`);
    console.log(`  Cells:    ${levelCounts.CELL}`);
    console.log(`  Villages: ${levelCounts.VILLAGE}`);

    await dataSource.transaction(async (transactionalEntityManager) => {
      console.log('[LocationSeeder] Starting atomic transaction...');

      const deleteResult = await transactionalEntityManager
        .createQueryBuilder()
        .delete()
        .from(AdministrativeUnitEntity)
        .execute();
      console.log(
        `[LocationSeeder] Cleared ${deleteResult.affected ?? 0} existing administrative unit rows.`,
      );

      const villageBatch: Partial<AdministrativeUnitEntity>[] = [];
      let persistedVillages = 0;

      const flushVillageBatch = async (): Promise<void> => {
        if (villageBatch.length === 0) {
          return;
        }

        await transactionalEntityManager.save(
          AdministrativeUnitEntity,
          villageBatch,
        );
        persistedVillages += villageBatch.length;
        console.log(
          `[LocationSeeder] Persisted village batch (${villageBatch.length} nodes, ${persistedVillages} total villages).`,
        );
        villageBatch.length = 0;
      };

      await LocationSeeder.processNodesRecursively(
        tree,
        null,
        transactionalEntityManager,
        villageBatch,
        flushVillageBatch,
      );

      await flushVillageBatch();

      const totalPersisted = await transactionalEntityManager.count(
        AdministrativeUnitEntity,
      );
      console.log(
        `[LocationSeeder] Transaction commit scope prepared with ${totalPersisted} administrative units.`,
      );
    });

    console.log(
      '[LocationSeeder] Atomic seeding transaction committed successfully.',
    );
  }

  private static async processNodesRecursively(
    nodes: LocationTreeNode[],
    parentId: string | null,
    transactionalEntityManager: EntityManager,
    villageBatch: Partial<AdministrativeUnitEntity>[],
    flushVillageBatch: () => Promise<void>,
  ): Promise<void> {
    for (const node of nodes) {
      if (node.level === 'VILLAGE') {
        villageBatch.push({
          name: trimValue(node.name),
          code: trimValue(node.code),
          level: 'VILLAGE',
          isActive: true,
          parentId,
        });

        if (villageBatch.length >= VILLAGE_BATCH_SIZE) {
          await flushVillageBatch();
        }

        continue;
      }

      const savedNode = await transactionalEntityManager.save(
        AdministrativeUnitEntity,
        {
          name: trimValue(node.name),
          code: trimValue(node.code),
          level: node.level,
          isActive: true,
          parentId,
        },
      );

      if (node.children.length > 0) {
        await LocationSeeder.processNodesRecursively(
          node.children,
          savedNode.id,
          transactionalEntityManager,
          villageBatch,
          flushVillageBatch,
        );
      }
    }
  }
}
