import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // ── Wipe any previous version of this flow (cascade via flowId FK) ────────
  const old = await prisma.flow.findFirst({ where: { name: 'Link API – Tenant CRUD' } });
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
      name: 'Link API – Tenant CRUD',
      description:
        'Full CRUD lifecycle for the /api/v1/tenants endpoints: ' +
        'health → create → list → get → update → delete → verify gone',
      env: 'local',
      tags: ['link-api', 'tenants', 'crud'],
      variables: {
        link_api_url: 'http://localhost:3001',
      },
    },
  });

  // ── Helper ────────────────────────────────────────────────────────────────
  const BASE = '{{variables.link_api_url}}/api/v1';
  const TENANT_ID = '{{outputs.create_tenant.responseBody.id}}';

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

    // 2 ─ Create tenant
    {
      id: randomUUID(),
      name: 'create_tenant',
      type: 'http',
      action: 'post',
      config: {
        url: `${BASE}/tenants`,
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'test-tenant-{{correlation_id}}' },
      },
      expect: { statusCode: 201 },
      orderIndex: 1,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 3 ─ List all tenants
    {
      id: randomUUID(),
      name: 'get_all_tenants',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/tenants`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 2,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 4 ─ Get by ID
    {
      id: randomUUID(),
      name: 'get_tenant_by_id',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/tenants/${TENANT_ID}`, headers: {} },
      expect: { statusCode: 200, body: { id: TENANT_ID } },
      orderIndex: 3,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 5 ─ Update
    {
      id: randomUUID(),
      name: 'update_tenant',
      type: 'http',
      action: 'put',
      config: {
        url: `${BASE}/tenants/${TENANT_ID}`,
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'updated-tenant-{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      orderIndex: 4,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 6 ─ Verify update persisted — GET again and check name changed
    {
      id: randomUUID(),
      name: 'verify_tenant_updated',
      type: 'http',
      action: 'get',
      config: { url: `${BASE}/tenants/${TENANT_ID}`, headers: {} },
      expect: {
        statusCode: 200,
        body: { name: 'updated-tenant-{{correlation_id}}' },
      },
      orderIndex: 5,
      timeoutSeconds: 10,
      continueOnFailure: false,
    },

    // 7 ─ Cleanup — hard-delete the test tenant directly via Postgres
    {
      id: randomUUID(),
      name: 'delete_tenant_from_db',
      type: 'postgres',
      action: 'execute',
      config: {
        connection: 'link_api',
        query: `DELETE FROM tenants WHERE id = '{{outputs.create_tenant.responseBody.id}}'`,
      },
      expect: { rows: 1 },
      orderIndex: 6,
      timeoutSeconds: 15,
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
