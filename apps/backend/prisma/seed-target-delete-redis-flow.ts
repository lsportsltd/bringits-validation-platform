import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const FLOW_NAME = 'Target Delete – Redis Cleanup Verification';

async function main() {
  const old = await prisma.flow.findFirst({ where: { name: FLOW_NAME } });
  if (old) {
    await prisma.flowRun.deleteMany({ where: { flowId: old.id } });
    await prisma.flowCommand.deleteMany({ where: { flowId: old.id } });
    await prisma.flow.delete({ where: { id: old.id } });
  }
  console.log('Cleared old flow');

  const flowId = randomUUID();
  const flow = await prisma.flow.create({
    data: {
      id: flowId,
      name: FLOW_NAME,
      description:
        'Verifies that deleting a v2 target triggers link-synchronizer to remove ALL Redis keys.\n\n' +
        'Redis keys cleaned up by link-sync on target delete (op:"d"):\n' +
        '  {tenantId:domain}:pool          — pool existence marker\n' +
        '  {tenantId:domain}:countries     — sorted set of country codes\n' +
        '  {tenantId:domain}:{cc}:proxies  — sorted set of proxy IDs per country\n' +
        '  {tenantId:domain}:{cc}:failures — failure count hash per country\n\n' +
        'Steps:\n' +
        '1. Health checks\n' +
        '2. Create v2 target\n' +
        '3. CDC create → link-sync builds Redis pool\n' +
        '4. Verify pool + countries keys EXIST in Redis\n' +
        '5. CDC delete → link-sync removes all Redis keys\n' +
        '6. Verify pool + countries keys are GONE from Redis\n' +
        '7. Verify API returns 500 (no pool marker)\n' +
        '8. Cleanup target from Postgres',
      env: 'local',
      tags: ['cdc', 'redis', 'targets', 'v2', 'delete', 'link-sync'],
      variables: {
        link_api_url: 'http://localhost:3001',
        link_sync_url: 'http://localhost:3009',
        tenant_id: '96626a4f-5789-43eb-bf99-51a76f14cd5d',
      },
    },
  });

  const API = '{{variables.link_api_url}}/api/v1';
  const SYNC = '{{variables.link_sync_url}}';
  const TENANT_ID = '{{variables.tenant_id}}';
  const TARGET_ID = '{{outputs.create_target.responseBody.id}}';

  const DOMAIN = 'del-validation-{{correlation_id}}.local';
  const TARGET_NAME = 'test-del-{{correlation_id}}';

  const configurationsStr = JSON.stringify({
    proxyClientConcurrency: true,
    rotatorType: 'validation',
    version: 2,
  });

  const buildCdcValue = (op: 'c' | 'd') => {
    const entity = JSON.stringify({
      id: TARGET_ID,
      tenant_id: TENANT_ID,
      domain: DOMAIN,
      name: TARGET_NAME,
      is_active: true,
      countries: [],
      configurations: configurationsStr,
    });
    if (op === 'c') {
      return `{"before":null,"after":${entity},"source":{"db":"link","table":"targets"},"op":"c"}`;
    }
    return `{"before":${entity},"after":null,"source":{"db":"link","table":"targets"},"op":"d"}`;
  };

  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  // Redis key patterns — match link-synchronizer's utils.ts key schema
  // getTenantTargetPoolKey      → {tenantId:domain}:pool
  // getTenantTargetCountriesKey → {tenantId:domain}:countries
  const POOL_KEY = `{${TENANT_ID}:${DOMAIN}}:pool`;
  const COUNTRIES_KEY = `{${TENANT_ID}:${DOMAIN}}:countries`;
  // Wildcard catches pool + countries + all per-country proxies/failures keys
  const ALL_KEYS_PATTERN = `{${TENANT_ID}:${DOMAIN}}:*`;

  const commands = [
    // ── 1. Health: link-api ────────────────────────────────────────────────
    {
      id: randomUUID(), name: 'link_api_health', type: 'http', action: 'get',
      config: { url: `${API}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 0, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 2. Health: link-sync ───────────────────────────────────────────────
    {
      id: randomUUID(), name: 'link_sync_health', type: 'http', action: 'get',
      config: { url: `${SYNC}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 1, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 3. Create v2 target ────────────────────────────────────────────────
    {
      id: randomUUID(), name: 'create_target', type: 'http', action: 'post',
      config: {
        url: `${API}/targets`,
        headers: JSON_HEADERS,
        body: {
          name: TARGET_NAME,
          isActive: true,
          countries: [],
          configurations: { proxyClientConcurrency: true, rotatorType: 'validation', version: 2 },
          tenantId: TENANT_ID,
          domain: DOMAIN,
        },
      },
      expect: { statusCode: 201 },
      orderIndex: 2, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 4. CDC "create" → link-sync builds Redis pool ──────────────────────
    {
      id: randomUUID(), name: 'cdc_create', type: 'http', action: 'post',
      config: {
        url: `${SYNC}/debug/cdc`,
        headers: JSON_HEADERS,
        body: { topic: 'targets', message: { value: buildCdcValue('c') } },
      },
      expect: { statusCode: 201 },
      orderIndex: 3, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 5a. Verify: pool key EXISTS ────────────────────────────────────────
    // link-sync writes {tenantId:domain}:pool as an empty string after handling CDC create
    {
      id: randomUUID(), name: 'redis_pool_exists', type: 'redis', action: 'keys',
      config: { connection: 'link_clustered', pattern: POOL_KEY },
      expect: { minKeys: 1 },
      orderIndex: 4, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 5b. Verify: countries key EXISTS ──────────────────────────────────
    // link-sync writes {tenantId:domain}:countries as a sorted set (ZADD) per country
    {
      id: randomUUID(), name: 'redis_countries_exists', type: 'redis', action: 'keys',
      config: { connection: 'link_clustered', pattern: COUNTRIES_KEY },
      expect: { minKeys: 1 },
      orderIndex: 5, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 5c. Count ALL keys under the hash tag ─────────────────────────────
    // Gives visibility into how many keys total were built (pool + countries + N×proxies)
    {
      id: randomUUID(), name: 'redis_all_keys_before_delete', type: 'redis', action: 'keys',
      config: { connection: 'link_clustered', pattern: ALL_KEYS_PATTERN },
      expect: { minKeys: 1 },
      orderIndex: 6, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 6. Verify via API: 503 pool_creating (pool exists, no proxies) ──────
    {
      id: randomUUID(), name: 'api_pool_creating', type: 'http', action: 'get',
      config: {
        url: `{{variables.link_api_url}}/api/v2/proxyTargets/valid`,
        headers: {},
        query: { tenantId: TENANT_ID, domain: DOMAIN },
      },
      expect: { statusCode: 503 },
      orderIndex: 7, timeoutSeconds: 15, continueOnFailure: true,
    },

    // ── 7. CDC "delete" → link-sync removes all Redis keys ─────────────────
    // handleDelete reads countries zrange then DELs:
    //   countriesKey, poolKey, + per-country proxiesKey + failureCountKey
    {
      id: randomUUID(), name: 'cdc_delete', type: 'http', action: 'post',
      config: {
        url: `${SYNC}/debug/cdc`,
        headers: JSON_HEADERS,
        body: { topic: 'targets', message: { value: buildCdcValue('d') } },
      },
      expect: { statusCode: 201 },
      orderIndex: 8, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 8a. Verify: pool key is GONE ───────────────────────────────────────
    {
      id: randomUUID(), name: 'redis_pool_deleted', type: 'redis', action: 'keys',
      config: { connection: 'link_clustered', pattern: POOL_KEY },
      expect: { minKeys: 0 },
      orderIndex: 9, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 8b. Verify: countries key is GONE ─────────────────────────────────
    {
      id: randomUUID(), name: 'redis_countries_deleted', type: 'redis', action: 'keys',
      config: { connection: 'link_clustered', pattern: COUNTRIES_KEY },
      expect: { minKeys: 0 },
      orderIndex: 10, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 8c. Verify: ALL hash-tag keys are GONE ─────────────────────────────
    {
      id: randomUUID(), name: 'redis_all_keys_after_delete', type: 'redis', action: 'keys',
      config: { connection: 'link_clustered', pattern: ALL_KEYS_PATTERN },
      expect: { minKeys: 0 },
      orderIndex: 11, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 9. Verify via API: 500 (no pool marker → proxy_not_found) ──────────
    // After delete the pool key is gone → link-api returns 500 proxy_not_found
    {
      id: randomUUID(), name: 'api_no_pool_after_delete', type: 'http', action: 'get',
      config: {
        url: `{{variables.link_api_url}}/api/v2/proxyTargets/valid`,
        headers: {},
        query: { tenantId: TENANT_ID, domain: DOMAIN },
      },
      expect: { statusCode: 500 },
      orderIndex: 12, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 10. Cleanup: delete target from Postgres ───────────────────────────
    {
      id: randomUUID(), name: 'cleanup_target_from_db', type: 'postgres', action: 'execute',
      config: {
        connection: 'link_api',
        query: `DELETE FROM targets WHERE id = '${TARGET_ID}'`,
      },
      expect: { rows: 1 },
      orderIndex: 13, timeoutSeconds: 15, continueOnFailure: false,
    },
  ];

  await prisma.flowCommand.createMany({ data: commands.map((c) => ({ ...c, flowId })) });
  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
  console.log('⚠️   Requires link-sync running on port 3009 and link_clustered Redis configured in .env');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
