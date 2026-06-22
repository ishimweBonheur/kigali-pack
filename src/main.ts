import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/audit/audit-log.interceptor';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(reflector),
    app.get(AuditLogInterceptor),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kigali-Pack Cloud Engine')
    .setDescription(
      'Commercial SaaS Developer Infrastructure Platform for Rwanda — locations, sandbox payments, compliance, analytics, webhooks, billing, and utilities.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Developer API key (kp_test_..., kp_live_..., kp_sandbox_...)',
      },
      'bearer',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from POST /v1/auth/login',
      },
      'jwt',
    )
    .addTag('System Health', 'Health, readiness, liveness, and version probes')
    .addTag('Authentication', 'JWT login, register, refresh, and logout')
    .addTag('Profile', 'Authenticated member profile (/v1/me)')
    .addTag('Locations', 'Rwanda administrative location hierarchy')
    .addTag('Sandbox Payments', 'Mock telecom payment simulation')
    .addTag('Compliance', 'NIDA mock and RRA tax tooling')
    .addTag('Developer Workspace', 'Aggregated developer snapshot')
    .addTag('Developer API Keys', 'API key lifecycle management')
    .addTag('Developer Analytics', 'Usage metering and statistics')
    .addTag('Developer Webhooks', 'Webhook registration and delivery')
    .addTag('Billing', 'Plans, subscriptions, and invoices')
    .addTag('Organizations', 'Teams, members, and RBAC')
    .addTag('Utilities — Phone Intelligence', 'Rwanda phone validation and carrier detection')
    .addTag('Utilities — Test Data', 'Sandbox test data generators')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  if (process.env.GENERATE_OPENAPI === 'true') {
    const outputPath = path.join(process.cwd(), 'openapi', 'openapi.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
    console.log(`OpenAPI spec written to ${outputPath}`);
    await app.close();
    return;
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Kigali-Pack engine running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  console.log(`OpenAPI JSON at http://localhost:${port}/api/docs-json`);
}

bootstrap();
