import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Reflector } from '@nestjs/core';

describe('Kigali-Pack API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(
      new TransformInterceptor(app.get(Reflector)),
    );
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns probe payload without success envelope', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body.success).toBeUndefined();
      });
  });

  it('GET /live attaches x-request-id header', () => {
    return request(app.getHttpServer())
      .get('/live')
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-request-id']).toBeDefined();
        expect(res.body).toHaveProperty('alive', true);
      });
  });

  it('GET /version exposes API metadata', () => {
    return request(app.getHttpServer())
      .get('/version')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('version');
      });
  });

  it('GET /docs redirects to swagger UI', () => {
    return request(app.getHttpServer())
      .get('/docs')
      .expect(302)
      .expect('Location', '/api/docs');
  });

  it('GET /openapi.json redirects to OpenAPI JSON', () => {
    return request(app.getHttpServer())
      .get('/openapi.json')
      .expect(302)
      .expect('Location', '/api/docs-json');
  });

  it('GET /v1/billing/plans returns standardized success envelope', () => {
    return request(app.getHttpServer())
      .get('/v1/billing/plans')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
      });
  });

  it('POST /v1/auth/login validates request body', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });
  });
});
