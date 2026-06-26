import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrganizationMemberEntity,
  OrganizationRole,
} from '../organizations/entities/organization-member.entity';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/me.dto';
import { JwtPayload } from '../organizations/organization.service';

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    private readonly authService: AuthService,
  ) {}

  async getProfile(memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId },
      relations: { organization: true },
    });

    if (!member) {
      throw new NotFoundException('Profile not found');
    }

    return this.toProfile(member);
  }

  async updateProfile(memberId: string, dto: UpdateProfileDto) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId },
      relations: { organization: true },
    });

    if (!member) {
      throw new NotFoundException('Profile not found');
    }

    if (dto.email) {
      const existing = await this.memberRepo.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing && existing.id !== memberId) {
        throw new ConflictException('Email is already in use');
      }
      member.email = dto.email.toLowerCase();
    }

    if (dto.password) {
      member.passwordHash = this.authService.hashPassword(dto.password);
    }

    const saved = await this.memberRepo.save(member);
    return this.toProfile(saved);
  }

  async deleteProfile(memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Profile not found');
    }

    if (
      member.role === OrganizationRole.OWNER ||
      member.role === OrganizationRole.ORG_OWNER
    ) {
      throw new UnauthorizedException(
        'Organization owners cannot delete their own account. Transfer ownership first.',
      );
    }

    await this.memberRepo.remove(member);
    return { deleted: true, memberId };
  }

  private toProfile(member: OrganizationMemberEntity) {
    return {
      id: member.id,
      email: member.email,
      emailVerified: member.emailVerified,
      role: this.authService.normalizeRole(member.role),
      organization: {
        id: member.organization.id,
        name: member.organization.name,
        slug: member.organization.slug,
      },
      createdAt: member.createdAt,
    };
  }
}

export type { JwtPayload };
