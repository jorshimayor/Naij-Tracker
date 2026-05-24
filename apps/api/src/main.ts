import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

// Load env from repo root before anything else.
dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Comma-separated allow-list. Defaults cover localhost dev + the production domain.
  const corsOrigins = (
    process.env.CORS_ORIGIN ??
    'http://localhost:3000,https://naijabilltracker.com.ng,https://www.naijabilltracker.com.ng'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow same-origin / curl (no Origin header) and any explicit listed origin.
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      // Allow any Vercel preview URL (deploys end in .vercel.app).
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['health', 'docs'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Naija Bill Tracker API')
    .setDescription('Public read API for Nigerian legislative bills.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Render / Railway / Fly inject PORT automatically. Fall back to API_PORT for local dev.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  Logger.log(`API listening on http://${host}:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs at http://${host}:${port}/docs`, 'Bootstrap');
}

bootstrap();
