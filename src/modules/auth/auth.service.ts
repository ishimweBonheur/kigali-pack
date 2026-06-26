import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import {
  OrganizationMemberEntity,
  OrganizationRole,
} from '../organizations/entities/organization-member.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import {
  AuthLoginDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import {
  AuthActionTokenEntity,
  AuthActionTokenType,
} from './entities/auth-action-token.entity';
import { JwtPayload } from '../organizations/organization.service';
import { ApiKeyService } from './api-key.service';
import { MailService } from '../../common/mail/mail.service';

const ACCESS_TOKEN_TTL_SECONDS = 900;
const REFRESH_TOKEN_TTL_DAYS = 7;
const PASSWORD_RESET_TTL_HOURS = 1;
const EMAIL_VERIFICATION_TTL_MINUTES = 20;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(AuthActionTokenEntity)
    private readonly actionTokenRepo: Repository<AuthActionTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly apiKeyService: ApiKeyService,
    private readonly mailService: MailService,
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

  normalizeRole(role: OrganizationRole): OrganizationRole {
    if (role === OrganizationRole.OWNER) return OrganizationRole.ORG_OWNER;
    if (role === OrganizationRole.VIEWER) return OrganizationRole.ORG_MEMBER;
    return role;
  }

  async register(dto: RegisterDto) {
    const existing = await this.memberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const role = dto.role ?? OrganizationRole.ORG_OWNER;

    return this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(OrganizationEntity);
      const memberRepo = manager.getRepository(OrganizationMemberEntity);

      const org = orgRepo.create({
        name: dto.organizationName,
        slug: this.slugify(dto.organizationName),
      });
      const savedOrg = await orgRepo.save(org);

      await this.apiKeyService.ensureDefaultKeyForOrganization(
        savedOrg.slug,
        `${savedOrg.name} — default`,
      );

      const member = memberRepo.create({
        organization: savedOrg,
        email: dto.email.toLowerCase(),
        passwordHash: this.hashPassword(dto.password),
        role,
      });
      const savedMember = await memberRepo.save(member);

      const tokens = await this.issueTokenPair(savedMember, savedOrg, manager);

      const { token, expiresAt } = await this.issueActionToken(
        savedMember,
        AuthActionTokenType.EMAIL_VERIFICATION,
        manager,
      );

      const mailResult = await this.mailService.sendVerificationEmail({
        to: savedMember.email,
        token,
        expiresAt,
      });

      return {
        tokens,
        memberId: savedMember.id,
        organizationId: savedOrg.id,
        role: this.normalizeRole(savedMember.role),
        email: savedMember.email,
        emailVerified: savedMember.emailVerified,
        verificationEmailSent: mailResult.sent,
        organization: {
          id: savedOrg.id,
          name: savedOrg.name,
          slug: savedOrg.slug,
        },
      };
    });
  }

  async login(dto: AuthLoginDto) {
    const member = await this.memberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      relations: { organization: true },
    });

    if (!member || !this.verifyPassword(dto.password, member.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokenPair(member, member.organization);

    return {
      tokens,
      memberId: member.id,
      organizationId: member.organization.id,
      role: this.normalizeRole(member.role),
      email: member.email,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
      relations: { member: { organization: true } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    const tokens = await this.issueTokenPair(
      stored.member,
      stored.member.organization,
    );

    return {
      tokens,
      memberId: stored.member.id,
      organizationId: stored.member.organization.id,
      role: this.normalizeRole(stored.member.role),
      email: stored.member.email,
    };
  }

  async logout(dto: LogoutDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });

    if (!stored) {
      throw new NotFoundException('Refresh token not found or already revoked');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    return { revoked: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const member = await this.memberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (member) {
      const { token } = await this.issueActionToken(
        member,
        AuthActionTokenType.PASSWORD_RESET,
      );
      return {
        message:
          'If an account exists for this email, a password reset link has been sent.',
        resetToken: token,
        expiresInHours: PASSWORD_RESET_TTL_HOURS,
      };
    }

    return {
      message:
        'If an account exists for this email, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const stored = await this.findValidActionToken(
      dto.token,
      AuthActionTokenType.PASSWORD_RESET,
    );

    const member = stored.member;
    member.passwordHash = this.hashPassword(dto.newPassword);
    await this.memberRepo.save(member);

    stored.usedAt = new Date();
    await this.actionTokenRepo.save(stored);

    return {
      passwordUpdated: true,
      email: member.email,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const stored = await this.findValidActionToken(
      dto.token,
      AuthActionTokenType.EMAIL_VERIFICATION,
    );

    const member = stored.member;

    if (member.emailVerified) {
      stored.usedAt = new Date();
      await this.actionTokenRepo.save(stored);
      return {
        emailVerified: true,
        email: member.email,
        memberId: member.id,
        alreadyVerified: true,
      };
    }

    member.emailVerified = true;
    await this.memberRepo.save(member);

    stored.usedAt = new Date();
    await this.actionTokenRepo.save(stored);

    return {
      emailVerified: true,
      email: member.email,
      memberId: member.id,
      alreadyVerified: false,
    };
  }

  async resendVerificationEmail(memberId: string) {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });

    if (!member) {
      throw new NotFoundException('Profile not found');
    }

    if (member.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.invalidateActiveActionTokens(
      member.id,
      AuthActionTokenType.EMAIL_VERIFICATION,
    );

    const { token, expiresAt } = await this.issueActionToken(
      member,
      AuthActionTokenType.EMAIL_VERIFICATION,
    );

    const mailResult = await this.mailService.sendVerificationEmail({
      to: member.email,
      token,
      expiresAt,
    });

    if (!mailResult.sent) {
      this.logger.warn(
        `Resend verification failed for ${member.email}: ${mailResult.reason ?? 'unknown'}`,
      );
    }

    return {
      email: member.email,
      verificationEmailSent: mailResult.sent,
      expiresAt: expiresAt.toISOString(),
      message: mailResult.sent
        ? 'Verification email sent'
        : 'Could not send verification email — SMTP may not be configured',
    };
  }

  async getVerificationStatus(memberId: string) {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });

    if (!member) {
      throw new NotFoundException('Profile not found');
    }

    return {
      email: member.email,
      emailVerified: member.emailVerified,
    };
  }

  async assertEmailVerified(memberId: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });

    if (!member) {
      throw new NotFoundException('Profile not found');
    }

    if (!member.emailVerified) {
      throw new ForbiddenException(
        'Verify your email before generating API keys',
      );
    }
  }

  private async issueActionToken(
    member: OrganizationMemberEntity,
    type: AuthActionTokenType,
    manager?: DataSource['manager'],
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date();
    if (type === AuthActionTokenType.PASSWORD_RESET) {
      expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_TTL_HOURS);
    } else {
      expiresAt.setMinutes(
        expiresAt.getMinutes() + EMAIL_VERIFICATION_TTL_MINUTES,
      );
    }

    const repo = manager
      ? manager.getRepository(AuthActionTokenEntity)
      : this.actionTokenRepo;

    await repo.save(
      repo.create({
        member,
        tokenHash: this.hashToken(token),
        type,
        expiresAt,
        usedAt: null,
      }),
    );

    return { token, expiresAt };
  }

  private async findValidActionToken(
    rawToken: string,
    type: AuthActionTokenType,
  ): Promise<AuthActionTokenEntity> {
    const stored = await this.actionTokenRepo.findOne({
      where: {
        tokenHash: this.hashToken(rawToken),
        type,
        usedAt: IsNull(),
      },
      relations: { member: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return stored;
  }

  private async issueTokenPair(
    member: OrganizationMemberEntity,
    org: OrganizationEntity,
    manager?: DataSource['manager'],
  ) {
    const payload: JwtPayload = {
      sub: member.id,
      orgId: org.id,
      role: this.normalizeRole(member.role),
      email: member.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshRepo = manager
      ? manager.getRepository(RefreshTokenEntity)
      : this.refreshTokenRepo;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await refreshRepo.save(
      refreshRepo.create({
        member,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        revokedAt: null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async invalidateActiveActionTokens(
    memberId: string,
    type: AuthActionTokenType,
  ): Promise<void> {
    await this.actionTokenRepo.update(
      {
        member: { id: memberId },
        type,
        usedAt: IsNull(),
      },
      { usedAt: new Date() },
    );
  }
}
