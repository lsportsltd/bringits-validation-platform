import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // ── Wipe any previous version ────────────────────────────────────────────
  const old = await prisma.flow.findFirst({ where: { name: 'Link API – Target CRUD' } });
  if (old) {
    await prisma.flowRun.deleteMany({ where: { flowId: old.id } });
    await prisma.flowCommand.deleteMany({ where: { flowId: old.id } });
    await prisma.flow.delete({ where: { id: old.id } });
  }
  console.log('Cleared old flow');

  // ── Create the flow ───────────────────────────────────────────────────────
  const flowId = randomUUID();

  const flow = await prisma.flow.create({
    data: {
      id: flowId,
      name: 'Link API – Target CRUD',
      description:
        'Full CRUD lifecycle for /api/v1/targets: ' +
        'health → create → list → get → patch → delete → verify 404',
      env: 'local',
      tags: ['link-api', 'targets', 'crud'],
      variables: {
        link_api_url: 'http://localhost:3001',
        // LSports tenant (first real tenant in the DB)
        tenant_id: '96626a4f-5789-43eb-bf99-51a76f14cd5d',
      },
    },
  });

  const BASE = '{{variables.link_api_url}}/api/v1';
  const TARGET_ID = '{{outputs.create_target.responseBody.id}}';

  const TARGET_BODY = {
    name: 'test-target-{{correlation_id}}',
    isActive: true,
    countries: [],
    configurations: { proxyClientConcurrency: true, rotatorType: 'validation' },
    tenantId: '{{variables.tenant_id}}',
    domain: 'validation-{{correlation_id}}.local',
  };

  const PATCH_BODY = {
    name: 'updated-target-{{correlation_id}}',
    isActive: true,
    countries: [],
    configurations: { proxyClientConcurrency: false, rotatorType: 'validation' },
    domain: 'updated-{{correlation_id}}.local',
  };

  const JSON_HEADERS = {
    'Content-Type': 'application/json',
    // tenantId for PATCH goes via header
    'x-lsports-user-tenant-id': '{{variables.tenant_id}}',
  };

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

    // 2 ─ Create target
    {
      id: randomUUID(),
      name: 'create_target',
      type: 'http',
      action: 'post',
      config: {
        url: `${BASE}/targets`,
        headers: { 'Content-Type': 'application/json' },
        body: TARGET_BODY,
      },
      expect: { statusCode: 201 },
      orderIndex: 1,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 3 ─ List all targets
    {
      id: randomUUID(),
      name: 'get_all_targets',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/targets`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 2,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 4 ─ Get by ID (response is { target: { id, name, ... } } — status only)
    {
      id: randomUUID(),
      name: 'get_target_by_id',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/targets/${TARGET_ID}`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 3,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 5 ─ Patch (update name + configurations)
    {
      id: randomUUID(),
      name: 'patch_target',
      type: 'http',
      action: 'patch',
      config: {
        url: `${BASE}/targets/${TARGET_ID}`,
        headers: JSON_HEADERS,
        body: PATCH_BODY,
      },
      expect: { statusCode: 200 },
      orderIndex: 4,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 6 ─ Delete
    {
      id: randomUUID(),
      name: 'delete_target',
      type: 'http',
      action: 'delete',
      config: { url: `${BASE}/targets/${TARGET_ID}`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 5,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 7 ─ Verify deleted → 404
    {
      id: randomUUID(),
      name: 'verify_target_deleted',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/targets/${TARGET_ID}`, headers: {} },
      expect: { statusCode: 404 },
      orderIndex: 6,
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
