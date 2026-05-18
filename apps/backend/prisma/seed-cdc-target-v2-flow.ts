import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const old = await prisma.flow.findFirst({ where: { name: 'Link Sync – Target V2 CDC Simulation' } });
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
      name: 'Link Sync – Target V2 CDC Simulation',
      description:
        'Simulates the full CDC lifecycle for a v2 target:\n' +
        '1. Health checks (link-api + link-sync)\n' +
        '2. Create v2 target via link-api\n' +
        '3. Simulate CDC "create" event via link-sync /debug/cdc\n' +
        '4. Verify Redis pool was built (GET /v2/proxyTargets/valid)\n' +
        '5. Simulate CDC "delete" event\n' +
        '6. Cleanup target from DB',
      env: 'local',
      tags: ['link-sync', 'cdc', 'targets', 'v2'],
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

  // After create_target runs, we pull its ID via output interpolation
  const TARGET_ID = '{{outputs.create_target.responseBody.id}}';

  // The domain is fixed per correlation_id so it matches across CDC events
  const DOMAIN = 'v2-validation-{{correlation_id}}.local';
  const TARGET_NAME = 'test-target-v2-{{correlation_id}}';
  const TENANT_ID = '{{variables.tenant_id}}';

  // Build the CDC "create" message.value — a stringified Debezium CDC payload.
  // configurations is itself a stringified JSON (Debezium sends JSON columns as strings).
  const configurationsStr = JSON.stringify({ proxyClientConcurrency: true, rotatorType: 'validation', version: 2 });

  // These template literals leave {{...}} tokens as-is so the interpolation
  // service replaces them at runtime, not at seed time.
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
    } else {
      return `{"before":${entity},"after":null,"source":{"db":"link","table":"targets"},"op":"d"}`;
    }
  };

  const CDC_HEADERS = { 'Content-Type': 'application/json' };

  const commands = [
    // 1 ─ link-api health
    {
      id: randomUUID(), name: 'link_api_health', type: 'http', action: 'get',
      config: { url: `${API}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 0, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 2 ─ link-sync health
    {
      id: randomUUID(), name: 'link_sync_health', type: 'http', action: 'get',
      config: { url: `${SYNC}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 1, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 3 ─ Create v2 target in link-api DB
    {
      id: randomUUID(), name: 'create_target', type: 'http', action: 'post',
      config: {
        url: `${API}/targets`,
        headers: CDC_HEADERS,
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

    // 4 ─ Simulate CDC "create" → link-sync builds Redis pool for this target
    {
      id: randomUUID(), name: 'cdc_target_create', type: 'http', action: 'post',
      config: {
        url: `${SYNC}/debug/cdc`,
        headers: CDC_HEADERS,
        body: {
          topic: 'targets',
          message: { value: buildCdcValue('c') },
        },
      },
      expect: { statusCode: 201 },
      orderIndex: 3, timeoutSeconds: 15, continueOnFailure: false,
    },

    // 5 ─ Verify Redis pool was created — GET /v2/proxyTargets/valid
    // Expected: 503 (pool_creating — pool key exists, no matching proxies for tenant yet)
    // or 404 (no_match — pool exists but no countries) — both mean link-sync processed the event.
    // NOT expected: 500 (proxy_not_found — internal error).
    {
      id: randomUUID(), name: 'verify_pool_created', type: 'http', action: 'get',
      config: {
        url: `{{variables.link_api_url}}/api/v2/proxyTargets/valid`,
        headers: {},
        query: {
          tenantId: TENANT_ID,
          domain: DOMAIN,
        },
      },
      // 503 = pool_creating (empty pool, CDC was processed)
      // 404 = no_match (no proxies for this country — also means CDC was processed)
      expect: { statusCode: 503 },
      orderIndex: 4, timeoutSeconds: 15, continueOnFailure: true,
    },

    // 6 ─ Simulate CDC "delete" → link-sync removes Redis pool keys
    {
      id: randomUUID(), name: 'cdc_target_delete', type: 'http', action: 'post',
      config: {
        url: `${SYNC}/debug/cdc`,
        headers: CDC_HEADERS,
        body: {
          topic: 'targets',
          message: { value: buildCdcValue('d') },
        },
      },
      expect: { statusCode: 201 },
      orderIndex: 5, timeoutSeconds: 15, continueOnFailure: false,
    },

    // 7 ─ Cleanup: hard-delete target from DB (link-api has no DELETE on /targets)
    {
      id: randomUUID(), name: 'cleanup_target_from_db', type: 'postgres', action: 'execute',
      config: {
        connection: 'link_api',
        query: `DELETE FROM targets WHERE id = '${TARGET_ID}'`,
      },
      expect: { rows: 1 },
      orderIndex: 6, timeoutSeconds: 15, continueOnFailure: false,
    },
  ];

  await prisma.flowCommand.createMany({ data: commands.map((c) => ({ ...c, flowId })) });
  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
  console.log('⚠️   Requires link-sync running on port 3009 (npm run start:dev in link-repo/link-synchronizer)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
