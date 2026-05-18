import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const FLOW_NAME = 'Proxy Bulk Ingest – BullMQ + Enrichment + Redis + DB';

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
        'Full proxy ingest lifecycle:\n' +
        '1. POST /api/v1/proxies/bulk → link-api queues jobs to BullMQ (queue: NewProxies)\n' +
        '2. Verify Redis BullMQ queue key exists: {NewProxies}:*\n' +
        '3. Health check link-enrichment\n' +
        '4. Wait 20 seconds for enrichment to process\n' +
        '5. Verify proxy was saved in Postgres (proxy_items table)\n' +
        '\n' +
        'Redis BullMQ key schema: {NewProxies}:waiting / {NewProxies}:active etc.\n' +
        'Proxy stored in: proxy_items table (host, port, protocol, api_location, tenant_id)',
      env: 'local',
      tags: ['proxies', 'bulk', 'bullmq', 'enrichment', 'redis'],
      variables: {
        link_api_url: 'http://localhost:3001',
        link_enrich_url: 'http://localhost:3003',
        // LSports tenant
        tenant_id: '96626a4f-5789-43eb-bf99-51a76f14cd5d',
        // Test proxy — use a dummy that's unlikely to exist
        proxy_host: '1.2.3.4',
        proxy_port: '9999',
        proxy_protocol: 'http',
        proxy_country: 'US',
        provider_name: 'validation-test',
        list_name: 'validation-list',
      },
    },
  });

  const API = '{{variables.link_api_url}}/api/v1';
  const ENRICH = '{{variables.link_enrich_url}}';
  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  const commands = [
    // ── 1. Health: link-api ────────────────────────────────────────────────
    {
      id: randomUUID(), name: 'link_api_health', type: 'http', action: 'get',
      config: { url: `${API}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 0, timeoutSeconds: 10, continueOnFailure: false,
    },

    // ── 2. POST /api/v1/proxies/bulk ───────────────────────────────────────
    // Publishes proxies to BullMQ queue "NewProxies" for link-enrichment to process.
    // Response: 201 (no body — fire-and-forget queue push)
    {
      id: randomUUID(), name: 'bulk_post_proxies', type: 'http', action: 'post',
      config: {
        url: `${API}/proxies/bulk`,
        headers: JSON_HEADERS,
        body: {
          tenantId: '{{variables.tenant_id}}',
          providerName: '{{variables.provider_name}}',
          listName: '{{variables.list_name}}',
          proxies: [
            {
              protocol: '{{variables.proxy_protocol}}',
              host: '{{variables.proxy_host}}',
              port: 9999,
              username: 'testuser',
              password: 'testpass',
              country: '{{variables.proxy_country}}',
            },
          ],
        },
      },
      // POST /bulk returns 201 with no body (fire-and-forget to BullMQ)
      expect: { statusCode: 201 },
      orderIndex: 1, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 3. Verify BullMQ queue key in Redis ────────────────────────────────
    // BullMQ stores jobs under keys prefixed with {NewProxies}:
    // e.g. {NewProxies}:waiting, {NewProxies}:active, {NewProxies}:events
    // At least the events stream or waiting list should exist immediately after POST
    {
      id: randomUUID(), name: 'redis_bullmq_queue_exists', type: 'redis', action: 'keys',
      config: {
        connection: 'link_clustered',
        pattern: '{NewProxies}:*',
      },
      expect: { minKeys: 1 },
      orderIndex: 2, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 4. Health: link-enrichment ─────────────────────────────────────────
    {
      id: randomUUID(), name: 'link_enrich_health', type: 'http', action: 'get',
      config: { url: `${ENRICH}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 3, timeoutSeconds: 10, continueOnFailure: true,
    },

    // ── 5. Wait 20 seconds for link-enrichment to process the job ──────────
    // link-enrichment: dequeues → validates proxy → resolves api_location → saves to Postgres
    {
      id: randomUUID(), name: 'wait_for_enrichment', type: 'wait', action: 'sleep',
      config: { seconds: 20 },
      expect: {},
      orderIndex: 4, timeoutSeconds: 25, continueOnFailure: false,
    },

    // ── 6. Verify proxy saved in Postgres ──────────────────────────────────
    // link-enrichment saves enriched proxy to proxy_items table.
    // We query by host to confirm it was persisted.
    {
      id: randomUUID(), name: 'db_verify_proxy_saved', type: 'postgres', action: 'query',
      config: {
        connection: 'link_api',
        query: `SELECT id, host, port, protocol, api_location, tenant_id
                FROM proxy_items
                WHERE host = '{{variables.proxy_host}}'
                  AND port = {{variables.proxy_port}}
                  AND tenant_id = '{{variables.tenant_id}}'
                LIMIT 1`,
      },
      expect: { minRows: 1 },
      orderIndex: 5, timeoutSeconds: 15, continueOnFailure: false,
    },

    // ── 7. Cleanup: delete the test proxy from Postgres ────────────────────
    {
      id: randomUUID(), name: 'cleanup_proxy_from_db', type: 'postgres', action: 'execute',
      config: {
        connection: 'link_api',
        query: `DELETE FROM proxy_items
                WHERE host = '{{variables.proxy_host}}'
                  AND port = {{variables.proxy_port}}
                  AND tenant_id = '{{variables.tenant_id}}'`,
      },
      expect: {},
      orderIndex: 6, timeoutSeconds: 15, continueOnFailure: true,
    },
  ];

  await prisma.flowCommand.createMany({ data: commands.map((c) => ({ ...c, flowId })) });
  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
  console.log('');
  console.log('Flow steps:');
  commands.forEach((c, i) => console.log(`  ${i + 1}. [${c.type}/${c.action}] ${c.name}`));
  console.log('');
  console.log('⚠️   Requires link-enrichment running on port 3003 for full test');
  console.log('⚠️   Step 3 (Redis BullMQ) requires link_clustered Redis connection');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
