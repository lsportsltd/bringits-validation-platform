import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // ── Wipe any previous version ────────────────────────────────────────────
  const old = await prisma.flow.findFirst({ where: { name: 'Link API – Proxies Read & Delete' } });
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
      name: 'Link API – Proxies Read & Delete',
      description:
        'Validates the proxies read and delete endpoints. ' +
        'Skips POST bulk, PATCH bulk, and re-enrichment. ' +
        'DELETEs use non-existent dummy values so no real data is removed.',
      env: 'local',
      tags: ['link-api', 'proxies'],
      variables: {
        link_api_url: 'http://localhost:3001',
      },
    },
  });

  const BASE = '{{variables.link_api_url}}/api/v1';

  const commands = [
    // 1 ─ Health
    {
      id: randomUUID(),
      name: 'health_check',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 0,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 2 ─ GET /proxies/proxies — paginated list with filtering
    {
      id: randomUUID(),
      name: 'get_proxies_list',
      type: 'http',
      action: 'get',
      config: {
        url: `${BASE}/proxies/proxies`,
        headers: {},
        query: { page: '1', pageSize: '5' },
      },
      expect: { statusCode: 200 },
      orderIndex: 1,
      timeoutSeconds: 15,
      continueOnFailure: false,
    },

    // 3 ─ GET /proxies — get proxy by ID (no id param = paginated empty response)
    {
      id: randomUUID(),
      name: 'get_proxies_simple',
      type: 'http',
      action: 'get',
      config: {
        url: `${BASE}/proxies`,
        headers: {},
        query: { page: '1', pageSize: '5' },
      },
      expect: { statusCode: 200 },
      orderIndex: 2,
      timeoutSeconds: 15,
      continueOnFailure: false,
    },

    // 4 ─ DELETE /ipPrefix — safe dummy IP prefix (no real data deleted)
    {
      id: randomUUID(),
      name: 'delete_by_ip_prefix',
      type: 'http',
      action: 'delete',
      config: {
        url: `${BASE}/proxies/ipPrefix`,
        headers: {},
        query: { ipPrefix: '255.255.255' },
      },
      expect: { statusCode: 200 },
      orderIndex: 3,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 5 ─ DELETE /source — safe dummy source name (no real data deleted)
    {
      id: randomUUID(),
      name: 'delete_by_source',
      type: 'http',
      action: 'delete',
      config: {
        url: `${BASE}/proxies/source`,
        headers: {},
        query: { name: '__validation_probe__' },
      },
      expect: { statusCode: 200 },
      orderIndex: 4,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 6 ─ DELETE /deleteBulk — safe dummy proxy ID (no real data deleted)
    {
      id: randomUUID(),
      name: 'delete_bulk',
      type: 'http',
      action: 'delete',
      config: {
        url: `${BASE}/proxies/deleteBulk`,
        headers: { 'Content-Type': 'application/json' },
        body: { proxyIds: ['999.999.999.999:99999'] },
      },
      expect: { statusCode: 200 },
      orderIndex: 5,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },
  ];

  await prisma.flowCommand.createMany({
    data: commands.map((c) => ({ ...c, flowId })),
  });

  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
