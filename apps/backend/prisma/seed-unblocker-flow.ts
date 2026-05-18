import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const FLOW_NAME = 'Unblocker – Proxy Request Lifecycle';

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
        'Simulates a scraper requesting a proxy for a NEW domain (no target exists yet).\n' +
        'Steps:\n' +
        '1. Health checks (link-api, link-sync)\n' +
        '2. Verify domain has NO pool yet → expect 500/404\n' +
        '3. Create v2 target via link-api POST /api/v1/targets\n' +
        '4. Simulate CDC "create" event via link-sync /debug/cdc\n' +
        '5. Verify Redis pool key exists: {tenantId:domain}:pool\n' +
        '6. Verify Redis countries key exists: {tenantId:domain}:countries\n' +
        '7. Verify via API: GET /v2/proxyTargets/valid → 503 (pool_creating)\n' +
        '8. Simulate CDC "delete" to clean up Redis\n' +
        '9. Verify Redis pool is gone\n' +
        '10. Cleanup target from Postgres',
      env: 'local',
      tags: ['unblocker', 'cdc', 'redis', 'targets', 'v2'],
      variables: {
        link_api_url: 'http://localhost:3001',
        link_sync_url: 'http://localhost:3009',
        // LSports tenant — already exists in DB
        tenant_id: '96626a4f-5789-43eb-bf99-51a76f14cd5d',
      },
    },
  });

  const API = '{{variables.link_api_url}}/api/v1';
  const SYNC = '{{variables.link_sync_url}}';
  const TENANT_ID = '{{variables.tenant_id}}';
  const TARGET_ID = '{{outputs.create_target.responseBody.id}}';

  // Unique domain per run so there's guaranteed to be no existing pool
  const DOMAIN = 'unblocker-validation-{{correlation_id}}.local';
  const TARGET_NAME = 'test-unblocker-{{correlation_id}}';

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

  // Redis key patterns produced by link-synchronizer for this tenant+domain
  // Pattern: {tenantId:domain}:pool   and   {tenantId:domain}:countries
  const REDIS_KEY_PATTERN_POOL = `{${TENANT_ID}:${DOMAIN}}:pool`;
  const REDIS_KEY_PATTERN_COUNTRIES = `{${TENANT_ID}:${DOMAIN}}:countries`;

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

    // ── 3. Verify NO pool exists yet for this brand-new domain ─────────────
    // 500 = proxy_not_found (no pool marker in Redis), 404 = no_match
    // Either way — confirms domain is fresh
    {
      id: randomUUID(), name: 'verify_no_pool_before', type: 'http', action: 'get',
      config: {
        url: `{{variables.link_api_url}}/api/v2/proxyTargets/valid`,
        headers: {},
        query: { tenantId: TENANT_ID, domain: DOMAIN },
      },
      expect: { statusCode: 500 },
      orderIndex: 2, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 4. Create v2 target via link-api ──────────────────────────────────
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
      orderIndex: 3, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 5. Simulate CDC "create" → link-sync builds Redis pool ─────────────
    {
      id: randomUUID(), name: 'cdc_target_create', type: 'http', action: 'post',
      config: {
        url: `${SYNC}/debug/cdc`,
        headers: JSON_HEADERS,
        body: {
          topic: 'targets',
          message: { value: buildCdcValue('c') },
        },
      },
      expect: { statusCode: 201 },
      orderIndex: 4, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 6. Verify Redis: pool marker key exists ─────────────────────────────
    // Key: {tenantId:domain}:pool  (written by link-sync after handling CDC create)
    {
      id: randomUUID(), name: 'redis_verify_pool_key', type: 'redis', action: 'keys',
      config: {
        connection: 'link_clustered',
        pattern: REDIS_KEY_PATTERN_POOL,
      },
      expect: { minKeys: 1 },
      orderIndex: 5, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 7. Verify Redis: countries sorted set exists ────────────────────────
    // Key: {tenantId:domain}:countries  (sorted set of country codes)
    {
      id: randomUUID(), name: 'redis_verify_countries_key', type: 'redis', action: 'keys',
      config: {
        connection: 'link_clustered',
        pattern: REDIS_KEY_PATTERN_COUNTRIES,
      },
      expect: { minKeys: 1 },
      orderIndex: 6, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 8. Verify via API: pool_creating (503) ─────────────────────────────
    // 503 = pool exists but no proxies match → request would hang/retry
    // This is the real "unblocker" trigger state
    {
      id: randomUUID(), name: 'verify_pool_creating', type: 'http', action: 'get',
      config: {
        url: `{{variables.link_api_url}}/api/v2/proxyTargets/valid`,
        headers: {},
        query: { tenantId: TENANT_ID, domain: DOMAIN },
      },
      expect: { statusCode: 503 },
      orderIndex: 7, timeoutSeconds: 15, continueOnFailure: true,
    },

    // ── 9. Simulate CDC "delete" → link-sync removes Redis keys ────────────
    {
      id: randomUUID(), name: 'cdc_target_delete', type: 'http', action: 'post',
      config: {
        url: `${SYNC}/debug/cdc`,
        headers: JSON_HEADERS,
        body: {
          topic: 'targets',
          message: { value: buildCdcValue('d') },
        },
      },
      expect: { statusCode: 201 },
      orderIndex: 8, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 10. Verify Redis: pool marker is gone ──────────────────────────────
    {
      id: randomUUID(), name: 'redis_verify_pool_deleted', type: 'redis', action: 'keys',
      config: {
        connection: 'link_clustered',
        pattern: REDIS_KEY_PATTERN_POOL,
      },
      expect: { minKeys: 0 },
      orderIndex: 9, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 11. Cleanup: hard-delete from Postgres ─────────────────────────────
    {
      id: randomUUID(), name: 'cleanup_target_from_db', type: 'postgres', action: 'execute',
      config: {
        connection: 'link_api',
        query: `DELETE FROM targets WHERE id = '${TARGET_ID}'`,
      },
      expect: { rows: 1 },
      orderIndex: 10, timeoutSeconds: 15, continueOnFailure: false,
    },
  ];

  await prisma.flowCommand.createMany({ data: commands.map((c) => ({ ...c, flowId })) });
  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
