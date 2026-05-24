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

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
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

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  Logger.log(`API listening on http://${host}:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs at http://${host}:${port}/docs`, 'Bootstrap');
}

bootstrap();
