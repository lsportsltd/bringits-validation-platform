import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const old = await prisma.flow.findFirst({ where: { name: 'Link API – BullMQ Health' } });
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
      name: 'Link API – BullMQ Health',
      description: 'Validates BullMQ queue endpoints: health → active jobs → waiting jobs',
      env: 'local',
      tags: ['link-api', 'bullmq'],
      variables: { link_api_url: 'http://localhost:3001' },
    },
  });

  const BASE = '{{variables.link_api_url}}/api/v1';

  const commands = [
    // 1 ─ Health
    {
      id: randomUUID(), name: 'health_check', type: 'http', action: 'get',
      config: { url: `${BASE}/health`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 0, timeoutSeconds: 10, continueOnFailure: false,
    },

    // 2 ─ Get active BullMQ jobs
    {
      id: randomUUID(), name: 'get_active_jobs', type: 'http', action: 'get',
      config: { url: `${BASE}/bullMQ/getActiveJobs`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 1, timeoutSeconds: 15, continueOnFailure: false,
    },

    // 3 ─ Get waiting BullMQ jobs
    {
      id: randomUUID(), name: 'get_waiting_jobs', type: 'http', action: 'get',
      config: { url: `${BASE}/bullMQ/getWaitingJobs`, headers: {} },
      expect: { statusCode: 200 },
      orderIndex: 2, timeoutSeconds: 15, continueOnFailure: false,
    },
  ];

  await prisma.flowCommand.createMany({ data: commands.map((c) => ({ ...c, flowId })) });
  console.log(`✅  Created flow "${flow.name}" (${flowId}) with ${commands.length} commands`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
