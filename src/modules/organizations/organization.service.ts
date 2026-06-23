import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { OrganizationEntity } from './entities/organization.entity';
import {
  OrganizationMemberEntity,
  OrganizationRole,
} from './entities/organization-member.entity';
import {
  AddMemberDto,
  CreateOrganizationDto,
  LoginDto,
} from './dto/organization.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  buildPaginationMeta,
  paginateOffset,
} from '../../common/utils/pagination.util';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: OrganizationRole;
  email: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  slugify(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  async create(dto: CreateOrganizationDto) {
    const existing = await this.memberRepo.findOne({
      where: { email: dto.ownerEmail.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    return this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(OrganizationEntity);
      const memberRepo = manager.getRepository(OrganizationMemberEntity);

      const org = orgRepo.create({
        name: dto.name,
        slug: this.slugify(dto.name),
      });
      const savedOrg = await orgRepo.save(org);

      const owner = memberRepo.create({
        organization: savedOrg,
        email: dto.ownerEmail.toLowerCase(),
        passwordHash: this.hashPassword(dto.ownerPassword),
        role: OrganizationRole.ORG_OWNER,
      });
      const savedOwner = await memberRepo.save(owner);

      const accessToken = this.issueToken(savedOwner, savedOrg);

      return {
        organization: {
          id: savedOrg.id,
          name: savedOrg.name,
          slug: savedOrg.slug,
          createdAt: savedOrg.createdAt,
        },
        owner: {
          id: savedOwner.id,
          email: savedOwner.email,
          role: savedOwner.role,
        },
        accessToken,
      };
    });
  }

  async login(dto: LoginDto) {
    const member = await this.memberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      relations: { organization: true },
    });

    if (!member || !this.verifyPassword(dto.password, member.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: this.issueToken(member, member.organization),
      memberId: member.id,
      organizationId: member.organization.id,
      role: member.role,
    };
  }

  async listForMember(memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId },
      relations: { organization: true },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return [
      {
        id: member.organization.id,
        name: member.organization.name,
        slug: member.organization.slug,
        role: member.role,
        createdAt: member.organization.createdAt,
      },
    ];
  }

  async addMember(orgId: string, requesterId: string, dto: AddMemberDto) {
    await this.assertRole(orgId, requesterId, [
      OrganizationRole.OWNER,
      OrganizationRole.ORG_OWNER,
      OrganizationRole.ADMIN,
    ]);

    const existing = await this.memberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (
      dto.role === OrganizationRole.OWNER ||
      dto.role === OrganizationRole.ORG_OWNER
    ) {
      if (!(await this.isOwner(orgId, requesterId))) {
        throw new ConflictException('Only owners can assign the OWNER role');
      }
    }

    const member = this.memberRepo.create({
      organization: org,
      email: dto.email.toLowerCase(),
      passwordHash: this.hashPassword(dto.password),
      role: dto.role,
    });
    const saved = await this.memberRepo.save(member);

    return {
      id: saved.id,
      email: saved.email,
      role: saved.role,
      createdAt: saved.createdAt,
    };
  }

  async listMembers(orgId: string, requesterId: string, query: PaginationQueryDto) {
    await this.assertMember(orgId, requesterId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const [members, total] = await this.memberRepo.findAndCount({
      where: { organization: { id: orgId } },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
    });

    return {
      data: members.map((member) => ({
        id: member.id,
        email: member.email,
        role: member.role,
        createdAt: member.createdAt,
      })),
      pagination: buildPaginationMeta(page, limit, total),
      message: 'Organization members retrieved successfully',
    };
  }

  async removeMember(orgId: string, requesterId: string, memberId: string) {
    await this.assertRole(orgId, requesterId, [
      OrganizationRole.OWNER,
      OrganizationRole.ORG_OWNER,
      OrganizationRole.ADMIN,
    ]);

    const target = await this.memberRepo.findOne({
      where: { id: memberId, organization: { id: orgId } },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }

    if (
      target.role === OrganizationRole.OWNER ||
      target.role === OrganizationRole.ORG_OWNER
    ) {
      throw new ConflictException('Cannot remove the organization owner');
    }

    await this.memberRepo.remove(target);
    return { deleted: true, memberId };
  }

  private issueToken(
    member: OrganizationMemberEntity,
    org: OrganizationEntity,
  ): string {
    const payload: JwtPayload = {
      sub: member.id,
      orgId: org.id,
      role: member.role,
      email: member.email,
    };
    return this.jwtService.sign(payload);
  }

  private async assertMember(orgId: string, memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, organization: { id: orgId } },
    });
    if (!member) {
      throw new NotFoundException('Organization not found');
    }
    return member;
  }

  private async assertRole(
    orgId: string,
    memberId: string,
    roles: OrganizationRole[],
  ) {
    const member = await this.assertMember(orgId, memberId);
    if (!roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return member;
  }

  private async isOwner(orgId: string, memberId: string): Promise<boolean> {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, organization: { id: orgId } },
    });
    return (
      member?.role === OrganizationRole.OWNER ||
      member?.role === OrganizationRole.ORG_OWNER
    );
  }
}
