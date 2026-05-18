import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// When running in cloud (GKE), DATABASE_URL is constructed from individual
// postgres secret parts + PG_DB_NAME env var (same cluster as link-api,
// different database: validation_platform).
function resolveDATABASE_URL() {
  if (process.env.DATABASE_URL) return; // already set (local dev)
  const host = process.env.DB_POSTGRES_DATA_ENDPOINT;
  const port = process.env.DB_POSTGRES_DATA_PORT || '5432';
  const user = process.env.DB_POSTGRES_DATA_USERNAME;
  const pass = process.env.DB_POSTGRES_DATA_PASSWORD;
  const db   = process.env.PG_DB_NAME || 'validation_platform';
  if (host && user && pass) {
    process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${db}?sslmode=require`;
  }
}

// Construct REDIS_*_URL from individual GCP secret parts when not set locally
function resolveRedisURLs() {
  const pairs: [string, string, string][] = [
    ['REDIS_LINK_CLUSTERED_URL',        'DB_REDIS_LINK-CLUSTERED_ENDPOINT',        'DB_REDIS_LINK-CLUSTERED_PORT'],
    ['REDIS_BLACK_WIDOW_CLUSTERED_URL', 'DB_REDIS_BLACK-WIDOW-CLUSTERED_ENDPOINT', 'DB_REDIS_BLACK-WIDOW-CLUSTERED_PORT'],
  ];
  for (const [urlKey, hostKey, portKey] of pairs) {
    if (!process.env[urlKey]) {
      const host = process.env[hostKey];
      const port = process.env[portKey] || '6379';
      if (host) process.env[urlKey] = `redis://${host}:${port}`;
    }
  }
}

// Must run before Prisma initialises
resolveDATABASE_URL();
resolveRedisURLs();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://bringits-validation-platform.dev-data.lsports-gcp.cloud',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Bringits Validation Platform API running on http://localhost:${port}/api`);
}

bootstrap();
