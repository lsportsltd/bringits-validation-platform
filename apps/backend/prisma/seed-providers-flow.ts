import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const old = await prisma.flow.findFirst({ where: { name: 'Link API – Providers CRUD' } });
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
      name: 'Link API – Providers CRUD',
      description:
        'Full lifecycle for /api/v1/providers: ' +
        'health → get all → create → get lists → create list → patch provider → patch list cost → DB cleanup',
      env: 'local',
      tags: ['link-api', 'providers', 'crud'],
      variables: { link_api_url: 'http://localhost:3001' },
    },
  });

  const BASE = '{{variables.link_api_url}}/api/v1';
  const PROVIDER_ID = '{{outputs.create_provider.responseBody.id}}';
  const LIST_ID = '{{outputs.create_list.responseBody.id}}';

  const commands = [
    // 1 ─ Health
    {
      id: randomUUID(), name: 'health_check', type: 'http', action: 'get',
      config: { url: `${BASE}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 0, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 2 ─ Get all providers
    {
      id: randomUUID(), name: 'get_all_providers', type: 'http', action: 'get',
      config: { url: `${BASE}/providers`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 1, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 3 ─ Create provider → returns { id, name, createdAt, updatedAt }
    {
      id: randomUUID(), name: 'create_provider', type: 'http', action: 'post',
      config: {
        url: `${BASE}/providers`,
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'test-provider-{{correlation_id}}' },
      },
      expect: { statusCode: 201 },
      orderIndex: 2, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 4 ─ Get lists for the new provider (empty initially)
    {
      id: randomUUID(), name: 'get_provider_lists', type: 'http', action: 'get',
      config: { url: `${BASE}/providers/${PROVIDER_ID}/lists`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 3, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 5 ─ Create list for provider → returns { id, providerId, name, model, ... }
    {
      id: randomUUID(), name: 'create_list', type: 'http', action: 'post',
      config: {
        url: `${BASE}/providers/${PROVIDER_ID}/lists`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          name: 'test-list-{{correlation_id}}',
          model: 'PER_GB',
          price: 1.5,
          unit: 'USD',
          amount: 100,
        },
      },
      expect: { statusCode: 201 },
      orderIndex: 4, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 6 ─ Patch provider name
    {
      id: randomUUID(), name: 'patch_provider', type: 'http', action: 'patch',
      config: {
        url: `${BASE}/providers/${PROVIDER_ID}`,
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'updated-provider-{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      orderIndex: 5, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 7 ─ Patch list cost
    {
      id: randomUUID(), name: 'patch_list_cost', type: 'http', action: 'patch',
      config: {
        url: `${BASE}/providers/lists/${LIST_ID}`,
        headers: { 'Content-Type': 'application/json' },
        body: { model: 'UNLIMITED', price: 0, unit: 'USD', amount: 0 },
      },
      expect: { statusCode: 200 },
      orderIndex: 6, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 8 ─ Cleanup: delete test provider from DB (cascades lists)
    {
      id: randomUUID(), name: 'cleanup_provider_from_db', type: 'postgres', action: 'execute',
      config: {
        connection: 'link_api',
        query: `DELETE FROM proxy_providers WHERE id = '{{outputs.create_provider.responseBody.id}}'`,
      },
      expect: { rows: 1 },
      orderIndex: 7, timeoutSeconds: 15, continueOnFailure: false,
    },
  ];

  await prisma.flowCommand.createMany({ data: commands.map((c) => ({ ...c, flowId })) });
  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
