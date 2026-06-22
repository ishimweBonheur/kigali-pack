import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { ApiLogEntity } from '../../modules/analytics/entities/api-log.entity';
import { ApiKeyService } from '../../modules/auth/api-key.service';
import { UsageMeteringService } from '../../modules/analytics/usage-metering.service';
import { OrganizationEntity } from '../../modules/organizations/entities/organization.entity';
import { JwtPayload } from '../../modules/organizations/organization.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  extractBearerToken,
  isDeveloperApiKey,
} from '../utils/bearer-token.util';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiLogEntity)
    private readonly apiLogRepo: Repository<ApiLogEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    private readonly apiKeyService: ApiKeyService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const rawToken = extractBearerToken(authHeader);

    if (!rawToken) {
      throw new UnauthorizedException(
        'Access Denied: Missing or malformed credentials. Paste only your accessToken (JWT) or API key (kp_test_...) — not the full login JSON.',
      );
    }

    if (isDeveloperApiKey(rawToken)) {
      return this.authenticateWithApiKey(context, rawToken);
    }

    return this.authenticateWithJwt(context, rawToken);
  }

  private async authenticateWithApiKey(
    context: ExecutionContext,
    rawToken: string,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const trackingStartTime = Date.now();

    const keyRecord = await this.apiKeyRepo.findOne({
      where: { hashedKey: hashedToken, isActive: true },
    });

    if (!keyRecord || !this.apiKeyService.isKeyValid(keyRecord)) {
      throw new UnauthorizedException(
        'Access Denied: Invalid, expired, or revoked developer token credentials.',
      );
    }

    return this.attachDeveloperContext(
      request,
      response,
      keyRecord,
      trackingStartTime,
    );
  }

  private async authenticateWithJwt(
    context: ExecutionContext,
    rawToken: string,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const trackingStartTime = Date.now();

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawToken);
    } catch {
      throw new UnauthorizedException(
        'Access Denied: Invalid or expired JWT. Paste only the accessToken value from login — not refreshToken or the full JSON response.',
      );
    }

    request.member = payload;

    const org = await this.orgRepo.findOne({ where: { id: payload.orgId } });
    if (!org) {
      throw new UnauthorizedException('Access Denied: Organization not found.');
    }

    const keyRecord = await this.apiKeyService.ensureDefaultKeyForOrganization(
      org.slug,
      `${org.name} — default`,
    );

    return this.attachDeveloperContext(
      request,
      response,
      keyRecord,
      trackingStartTime,
    );
  }

  private attachDeveloperContext(
    request: {
      route?: { path: string };
      url: string;
      method: string;
      developer?: ApiKeyEntity;
    },
    response: {
      statusCode: number;
      on: (event: string, listener: () => void) => void;
    },
    keyRecord: ApiKeyEntity,
    trackingStartTime: number,
  ): boolean {
    request.developer = keyRecord;

    void this.apiKeyService.touchLastUsed(keyRecord.id).catch(() => {
      /* non-blocking last-used update */
    });

    response.on('finish', async () => {
      const executionDurationMs = Date.now() - trackingStartTime;
      const endpoint = request.route ? request.route.path : request.url;
      try {
        const logMetricsRecord = this.apiLogRepo.create({
          apiKey: keyRecord,
          endpoint,
          method: request.method,
          statusCode: response.statusCode,
          responseTimeMs: executionDurationMs,
        });
        await this.apiLogRepo.save(logMetricsRecord);
        void this.usageMeteringService
          .recordRequest(
            keyRecord.id,
            endpoint,
            executionDurationMs,
            response.statusCode,
          )
          .catch(() => {
            /* non-blocking usage metering */
          });
      } catch {
        /* telemetry failures must not affect the request */
      }
    });

    return true;
  }
}
