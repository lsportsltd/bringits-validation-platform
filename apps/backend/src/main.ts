import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Client } from 'pg';
import { execSync } from 'child_process';

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

// Construct CONN_LINK_API_URL / CONN_LINK_API_RO_URL from parts (cloud deployment)
function resolveConnURLs() {
  if (!process.env.CONN_LINK_API_URL) {
    const host = process.env.DB_POSTGRES_DATA_ENDPOINT;
    const port = process.env['DB_POSTGRES_DATA_PORT'] || '5432';
    const user = process.env.DB_POSTGRES_DATA_USERNAME;
    const pass = process.env.DB_POSTGRES_DATA_PASSWORD;
    if (host && user && pass) {
      process.env.CONN_LINK_API_URL = `postgresql://${user}:${pass}@${host}:${port}/link?sslmode=require`;
    }
  }
  if (!process.env.CONN_LINK_API_RO_URL) {
    const host = process.env['DB_POSTGRES_DATA_ENDPOINT-RO'];
    const port = process.env['DB_POSTGRES_DATA_PORT-RO'] || '5432';
    const user = process.env.DB_POSTGRES_DATA_USERNAME_READ;
    const pass = process.env.DB_POSTGRES_DATA_PASSWORD_READ;
    if (host && user && pass) {
      process.env.CONN_LINK_API_RO_URL = `postgresql://${user}:${pass}@${host}:${port}/link?sslmode=require`;
    }
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
resolveConnURLs();
resolveRedisURLs();

/**
 * Creates the validation_platform database on the link-postgres cluster if it
 * does not yet exist, then runs prisma migrate deploy.
 * Connects to the `postgres` default maintenance DB to issue CREATE DATABASE —
 * this never touches the `link` database.
 */
async function ensureDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[bootstrap] DATABASE_URL not set — skipping DB bootstrap');
    return;
  }

  // Parse the target DB name from DATABASE_URL
  const match = dbUrl.match(/\/([^/?]+)(\?|$)/);
  const dbName = match?.[1] ?? 'validation_platform';

  // Build a connection string to the maintenance DB (postgres) on the same host
  const adminUrl = dbUrl.replace(`/${dbName}`, '/postgres');

  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    if (res.rowCount === 0) {
      console.log(`[bootstrap] Creating database "${dbName}"...`);
      // CREATE DATABASE cannot run inside a transaction — use simple query
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[bootstrap] Database "${dbName}" created ✅`);
    } else {
      console.log(`[bootstrap] Database "${dbName}" already exists ✅`);
    }
  } catch (err: any) {
    console.error('[bootstrap] Failed to ensure database:', err.message);
    // Non-fatal — Prisma migrate will surface a clearer error if DB is missing
  } finally {
    await client.end();
  }

  // Run migrations against the target DB
  try {
    console.log('[bootstrap] Running prisma migrate deploy...');
    execSync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('[bootstrap] Migrations complete ✅');
  } catch (err: any) {
    console.error('[bootstrap] Migration failed:', err.message);
  }
}

async function bootstrap() {
  await ensureDatabase();

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
