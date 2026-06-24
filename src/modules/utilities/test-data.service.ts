import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeUnitEntity } from '../locations/entities/administrative-unit.entity';

const RWANDAN_FIRST_NAMES = [
  'Jean',
  'Marie',
  'Patrick',
  'Grace',
  'Emmanuel',
  'Alice',
  'Eric',
  'Divine',
  'Fabrice',
  'Claudine',
  'Olivier',
  'Sandrine',
  'Didier',
  'Immaculee',
  'Moise',
];

const RWANDAN_LAST_NAMES = [
  'Mugisha',
  'Uwimana',
  'Habimana',
  'Nyirahabimana',
  'Niyonsenga',
  'Mukamana',
  'Bizimana',
  'Uwineza',
  'Nshimiyimana',
  'Murekatete',
  'Iradukunda',
  'Kamanzi',
];

const GENDERS = ['MALE', 'FEMALE'] as const;

@Injectable()
export class TestDataService {
  constructor(
    @InjectRepository(AdministrativeUnitEntity)
    private readonly locationRepo: Repository<AdministrativeUnitEntity>,
  ) {}

  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomItem<T>(items: T[]): T {
    return items[this.randomInt(0, items.length - 1)];
  }

  generateNationalId(): string {
    const birthYear = this.randomInt(1985, 2004);
    const genderDigit = this.randomItem(['7', '8']);
    const serial = String(this.randomInt(0, 9999999)).padStart(7, '0');
    const checksum = String(this.randomInt(10, 99));
    return `1${birthYear}${genderDigit}${serial}${checksum}`;
  }

  async randomCitizen() {
    const gender = this.randomItem([...GENDERS]);
    const birthYear = this.randomInt(1985, 2004);
    const nationalId = this.generateNationalId();

    return {
      nationalId,
      firstName: this.randomItem(RWANDAN_FIRST_NAMES),
      lastName: this.randomItem(RWANDAN_LAST_NAMES),
      gender,
      birthYear,
      phoneNumber: `+2507${gender === 'MALE' ? '8' : '2'}${String(this.randomInt(1000000, 9999999))}`,
      civilStatus: this.randomItem(['SINGLE', 'MARRIED', 'DIVORCED']),
      province: this.randomItem([
        'Kigali City',
        'Eastern Province',
        'Southern Province',
        'Western Province',
        'Northern Province',
      ]),
    };
  }

  async randomAddress() {
    const sector = await this.locationRepo
      .createQueryBuilder('unit')
      .where('unit.level = :level', { level: 'SECTOR' })
      .andWhere('unit.is_active = true')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();

    const cell = sector
      ? await this.locationRepo
          .createQueryBuilder('unit')
          .where('unit.level = :level', { level: 'CELL' })
          .andWhere('unit.parent_id = :parentId', { parentId: sector.id })
          .orderBy('RANDOM()')
          .limit(1)
          .getOne()
      : null;

    const village = cell
      ? await this.locationRepo
          .createQueryBuilder('unit')
          .where('unit.level = :level', { level: 'VILLAGE' })
          .andWhere('unit.parent_id = :parentId', { parentId: cell.id })
          .orderBy('RANDOM()')
          .limit(1)
          .getOne()
      : null;

    const streetNumber = this.randomInt(1, 250);
    const landmark = this.randomItem([
      'Near Amahoro Stadium',
      'Close to bus park',
      'Behind market',
      'Opposite health center',
    ]);

    return {
      formattedAddress: [
        village?.name ?? 'Umucyo',
        cell?.name ?? 'Kabeza',
        sector?.name ?? 'Remera',
        'Kigali City',
        'Rwanda',
      ].join(', '),
      components: {
        village: village?.name ?? 'Umucyo',
        cell: cell?.name ?? 'Kabeza',
        sector: sector?.name ?? 'Remera',
        district: 'Gasabo',
        province: 'Kigali City',
        country: 'Rwanda',
      },
      streetNumber,
      landmark,
      coordinates: {
        latitude: -1.94 + Math.random() * 0.08,
        longitude: 30.06 + Math.random() * 0.08,
      },
    };
  }
}
