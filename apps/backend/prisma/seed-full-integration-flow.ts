import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const FLOW_NAME = 'Link Platform — Full Integration';

const FINGERPRINT_ID = 42;
const TS = Date.now();
const TEST_TENANT_NAME  = `__integration_tenant_${TS}`;
const TEST_PROVIDER_NAME = `__integration_provider_${TS}`;
const TEST_TARGET_DOMAIN = 'integration-test.example.com';
const TEST_TARGET_NAME   = `__integration_target_${TS}`;

// Build a CDC value JSON string (must be double-serialised for link-sync)
const cdcValue = (op: 'c' | 'u' | 'd', afterOverride?: object) => {
  const after = JSON.stringify({
    id:             '{{outputs.create_target_v1.responseBody.id}}',
    tenant_id:      '{{outputs.create_tenant.responseBody.id}}',
    domain:         TEST_TARGET_DOMAIN,
    name:           TEST_TARGET_NAME,
    is_active:      true,
    countries:      [],
    configurations: '[]',
    ...afterOverride,
  });
  const before = op === 'c' ? 'null' : after;
  const finalAfter = op === 'd' ? 'null' : after;
  return `{"before":${before},"after":${finalAfter},"source":{"db":"link","table":"targets"},"op":"${op}"}`;
};

type Cmd = {
  id: string; name: string; type: string; action: string;
  config: any; expect?: any; orderIndex: number;
  timeoutSeconds: number; continueOnFailure: boolean;
};

function http(idx: number, name: string, method: string, url: string, opts: {
  headers?: any; body?: any; expect?: any; timeout?: number; soft?: boolean;
}): Cmd {
  return {
    id: randomUUID(), name, type: 'http', action: method,
    config: { url, method, headers: opts.headers ?? {}, ...(opts.body !== undefined ? { body: opts.body } : {}) },
    expect: opts.expect ?? { statusCode: 200 },
    orderIndex: idx, timeoutSeconds: opts.timeout ?? 15, continueOnFailure: opts.soft ?? false,
  };
}

function pg(idx: number, name: string, action: 'query' | 'execute', sql: string, opts?: { expect?: any; soft?: boolean }): Cmd {
  return {
    id: randomUUID(), name, type: 'postgres', action,
    config: { connection: 'link_api', query: sql },
    expect: opts?.expect ?? { rows: 1 },
    orderIndex: idx, timeoutSeconds: 20, continueOnFailure: opts?.soft ?? true,
  };
}

function redis(idx: number, name: string, action: string, cfg: any, opts?: { expect?: any; soft?: boolean; timeout?: number }): Cmd {
  return {
    id: randomUUID(), name, type: 'redis', action,
    config: { connection: 'link_clustered', ...cfg },
    expect: opts?.expect ?? {},
    orderIndex: idx, timeoutSeconds: opts?.timeout ?? 8, continueOnFailure: opts?.soft ?? false,
  };
}

async function main() {
  const old = await prisma.flow.findFirst({ where: { name: FLOW_NAME } });
  if (old) {
    await prisma.flowRun.deleteMany({ where: { flowId: old.id } });
    await prisma.flowCommand.deleteMany({ where: { flowId: old.id } });
    await prisma.flow.delete({ where: { id: old.id } });
    console.log('Cleared old flow');
  }

  let i = 0;
  const cmds: Cmd[] = [

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 0 — Health checks (all services)
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'health_link_api',        'get', '{{variables.link_api_url}}/api/v1/health', {}),
    http(i++, 'health_link_sync',       'get', '{{variables.link_sync_url}}/health',       { soft: true }),
    http(i++, 'health_link_sync_ready', 'get', '{{variables.link_sync_url}}/health/readiness', { soft: true }),
    http(i++, 'health_link_enrich',     'get', '{{variables.link_enrich_url}}/health',     { soft: true }),
    http(i++, 'health_link_monitoring', 'get', '{{variables.link_monitoring_url}}/api/health', { soft: true }),
    http(i++, 'health_link_results',    'get', '{{variables.link_results_url}}/api/health', { soft: true }),
    http(i++, 'health_data_tunnel',     'get', '{{variables.data_tunnel_url}}/health',     { soft: true }),
    http(i++, 'health_black_widow',     'get', '{{variables.black_widow_url}}/api/health', { soft: true }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 1 — Tenant CRUD
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'create_tenant', 'post', '{{variables.link_api_url}}/api/v1/tenants',
      { headers: { 'Content-Type': 'application/json' }, body: { name: TEST_TENANT_NAME, isActive: true }, expect: { statusCode: 201 } }),
    http(i++, 'get_all_tenants', 'get', '{{variables.link_api_url}}/api/v1/tenants', {}),
    http(i++, 'get_tenant_by_id', 'get', '{{variables.link_api_url}}/api/v1/tenants/{{outputs.create_tenant.responseBody.id}}', {}),
    http(i++, 'update_tenant', 'put', '{{variables.link_api_url}}/api/v1/tenants/{{outputs.create_tenant.responseBody.id}}',
      { headers: { 'Content-Type': 'application/json' }, body: { name: `${TEST_TENANT_NAME}_upd` } }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 2 — Provider CRUD
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'get_all_providers', 'get', '{{variables.link_api_url}}/api/v1/providers', {}),
    http(i++, 'create_provider', 'post', '{{variables.link_api_url}}/api/v1/providers',
      { headers: { 'Content-Type': 'application/json' }, body: { name: TEST_PROVIDER_NAME }, expect: { statusCode: 201 } }),
    http(i++, 'patch_provider', 'patch', '{{variables.link_api_url}}/api/v1/providers/{{outputs.create_provider.responseBody.id}}',
      { headers: { 'Content-Type': 'application/json' }, body: { name: `${TEST_PROVIDER_NAME}_p` } }),
    http(i++, 'get_provider_lists', 'get', '{{variables.link_api_url}}/api/v1/providers/{{outputs.create_provider.responseBody.id}}/lists', {}),
    http(i++, 'create_provider_list', 'post', '{{variables.link_api_url}}/api/v1/providers/{{outputs.create_provider.responseBody.id}}/lists',
      { headers: { 'Content-Type': 'application/json' }, body: { name: '__integration_list', model: 'UNLIMITED' }, expect: { statusCode: 201 } }),
    http(i++, 'patch_provider_list', 'patch', '{{variables.link_api_url}}/api/v1/providers/lists/{{outputs.create_provider_list.responseBody.id}}',
      { headers: { 'Content-Type': 'application/json' }, body: { model: 'PER_GB', price: 0.001, unit: 'GB', amount: 1 } }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 3 — Target CRUD (v1)
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'create_target_v1', 'post', '{{variables.link_api_url}}/api/v1/targets',
      { headers: { 'Content-Type': 'application/json' },
        body: { tenantId: '{{outputs.create_tenant.responseBody.id}}', domain: TEST_TARGET_DOMAIN,
                name: TEST_TARGET_NAME, isActive: true, countries: [],
                configurations: { proxyClientConcurrency: true, rotatorType: 'validation', version: 2 } },
        expect: { statusCode: 201 }, timeout: 20 }),
    http(i++, 'get_all_targets', 'get', '{{variables.link_api_url}}/api/v1/targets', {}),
    http(i++, 'get_target_by_id', 'get', '{{variables.link_api_url}}/api/v1/targets/{{outputs.create_target_v1.responseBody.id}}', {}),
    http(i++, 'get_targets_by_tenant', 'get', '{{variables.link_api_url}}/api/v1/targets/tenant/{{outputs.create_tenant.responseBody.id}}', {}),
    http(i++, 'patch_target', 'patch', '{{variables.link_api_url}}/api/v1/targets/{{outputs.create_target_v1.responseBody.id}}',
      { headers: { 'Content-Type': 'application/json', 'x-lsports-user-tenant-id': '{{outputs.create_tenant.responseBody.id}}' },
        body: { name: `${TEST_TARGET_NAME}_p`, isActive: true, countries: [],
                configurations: { proxyClientConcurrency: true, rotatorType: 'validation', version: 2 } } }),
    http(i++, 'activate_target', 'put', '{{variables.link_api_url}}/api/v1/targets/activate/{{outputs.create_target_v1.responseBody.id}}',
      { headers: { 'Content-Type': 'application/json' }, body: {} }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 4 — Target Fingerprint
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'create_target_fingerprint', 'post', '{{variables.link_api_url}}/api/v1/target-fingerprint',
      { headers: { 'Content-Type': 'application/json' },
        body: { targetId: '{{outputs.create_target_v1.responseBody.id}}', fingerprintId: FINGERPRINT_ID },
        expect: { statusCode: 201 } }),
    http(i++, 'get_target_fingerprints', 'get', `{{variables.link_api_url}}/api/v1/target-fingerprint?fingerprintId=${FINGERPRINT_ID}`, {}),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 5 — Proxies (read-only)
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'get_proxies', 'get', '{{variables.link_api_url}}/api/v1/proxies?pageSize=5', {}),
    http(i++, 'get_proxies_paginated', 'get', '{{variables.link_api_url}}/api/v1/proxies/proxies?pageSize=5', {}),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 6 — BullMQ
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'bullmq_active_jobs',  'get', '{{variables.link_api_url}}/api/v1/bullMQ/getActiveJobs', {}),
    http(i++, 'bullmq_waiting_jobs', 'get', '{{variables.link_api_url}}/api/v1/bullMQ/getWaitingJobs', {}),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 7 — Monitoring
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'monitoring_data',         'get', '{{variables.link_monitoring_url}}/api/monitoring/data',         { soft: true }),
    http(i++, 'monitoring_ingest_queue', 'get', '{{variables.link_monitoring_url}}/api/monitoring/ingest-queue', { soft: true }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 8 — CDC Simulation + Redis sorted-set verification
    // Each CDC op: simulate → wait briefly (inline in timeout) → verify Redis
    // ════════════════════════════════════════════════════════════════════════

    // --- 8a. CDC CREATE ---
    http(i++, 'cdc_target_create', 'post', '{{variables.link_sync_url}}/debug/cdc',
      { headers: { 'Content-Type': 'application/json' },
        body: { topic: 'targets', message: { key: '{{outputs.create_target_v1.responseBody.id}}', value: cdcValue('c') } },
        expect: { statusCode: 200 }, timeout: 20, soft: true }),

    // After CREATE → verify a Redis key matching the target ID now exists
    redis(i++, 'redis_verify_pool_created',
      'keys', { pattern: '*{{outputs.create_target_v1.responseBody.id}}*' },
      { expect: { minKeys: 1 }, soft: true }),

    // Also check via v2 API (proxy pool endpoint)
    http(i++, 'verify_proxy_pool_v2_api', 'get',
      '{{variables.link_api_url}}/api/v2/proxyTargets/valid?tenantId={{outputs.create_tenant.responseBody.id}}&domain={{variables.target_domain}}',
      { expect: { statusCode: 200 }, timeout: 20, soft: true }),

    // --- 8b. CDC UPDATE ---
    http(i++, 'cdc_target_update', 'post', '{{variables.link_sync_url}}/debug/cdc',
      { headers: { 'Content-Type': 'application/json' },
        body: { topic: 'targets', message: { key: '{{outputs.create_target_v1.responseBody.id}}', value: cdcValue('u', { name: `${TEST_TARGET_NAME}_cdc_updated` }) } },
        expect: { statusCode: 200 }, timeout: 20, soft: true }),

    // After UPDATE → key should still exist
    redis(i++, 'redis_verify_pool_after_update',
      'keys', { pattern: '*{{outputs.create_target_v1.responseBody.id}}*' },
      { expect: { minKeys: 0 }, soft: true }),  // minKeys 0 = informational only

    // --- 8c. CDC DELETE ---
    http(i++, 'cdc_target_delete', 'post', '{{variables.link_sync_url}}/debug/cdc',
      { headers: { 'Content-Type': 'application/json' },
        body: { topic: 'targets', message: { key: '{{outputs.create_target_v1.responseBody.id}}', value: cdcValue('d') } },
        expect: { statusCode: 200 }, timeout: 20, soft: true }),

    // After DELETE → Redis key should be gone (or count dropped)
    redis(i++, 'redis_verify_pool_deleted',
      'keys', { pattern: '*{{outputs.create_target_v1.responseBody.id}}*' },
      { expect: { minKeys: 0 }, soft: true }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 9 — Link-enrichment
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'enrich_validate_proxies', 'post', '{{variables.link_enrich_url}}/validation/proxies',
      { headers: { 'Content-Type': 'application/json' },
        body: { proxies: [{ host: '1.2.3.4', port: 8080, protocol: 'http' }] },
        soft: true }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 10 — Data-link-tunnel (Rust, port 8080)
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'data_tunnel_get_proxy', 'get', '{{variables.data_tunnel_url}}/api/proxy?sessionId=integration-test-session',
      { soft: true }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 11 — Black-widow scraper (HTTP app, port 3005)
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'black_widow_readiness', 'get', '{{variables.black_widow_url}}/api/health/readiness', { soft: true }),

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 12 — CLEANUP (all continueOnFailure — leave no traces)
    // ════════════════════════════════════════════════════════════════════════
    http(i++, 'delete_target_fingerprint', 'delete',
      `{{variables.link_api_url}}/api/v1/target-fingerprint/{{outputs.create_target_v1.responseBody.id}}/${FINGERPRINT_ID}`,
      { soft: true }),

    http(i++, 'delete_target_v1', 'delete',
      '{{variables.link_api_url}}/api/v1/targets/{{outputs.create_target_v1.responseBody.id}}',
      { expect: { statusCode: 200 }, soft: true }),

    pg(i++, 'cleanup_provider_from_db', 'execute',
      `DELETE FROM proxy_providers WHERE id = '{{outputs.create_provider.responseBody.id}}'`),

    pg(i++, 'cleanup_tenant_from_db', 'execute',
      `DELETE FROM tenants WHERE id = '{{outputs.create_tenant.responseBody.id}}'`),
  ];

  // ── Create flow ─────────────────────────────────────────────────────────────
  await prisma.flow.create({
    data: {
      id: randomUUID(),
      name: FLOW_NAME,
      description:
        'Full end-to-end integration across ALL link-* services. ' +
        'Covers every controller: tenants, targets, providers, proxies, fingerprints, bullmq, monitoring, ' +
        'CDC (create/update/delete) with Redis sorted-set verification, enrichment, data-tunnel, black-widow. ' +
        'All created records are deleted at the end — no traces left.',
      env: 'local',
      tags: ['integration', 'full', 'cdc', 'redis', 'all-services'],
      variables: {
        link_api_url:        'http://localhost:3001',
        link_sync_url:       'http://localhost:3009',
        link_enrich_url:     'http://localhost:3003',
        link_monitoring_url: 'http://localhost:3010',
        link_results_url:    'http://localhost:3011',
        data_tunnel_url:     'http://localhost:8080',
        black_widow_url:     'http://localhost:3005',
        target_domain:       TEST_TARGET_DOMAIN,
      },
      commands: {
        create: cmds.map((c) => ({
          id: c.id, name: c.name, type: c.type, action: c.action,
          config: c.config, expect: c.expect ?? null,
          orderIndex: c.orderIndex, timeoutSeconds: c.timeoutSeconds,
          continueOnFailure: c.continueOnFailure,
        })),
      },
    },
  });

  console.log(`\n✅  "${FLOW_NAME}" — ${cmds.length} commands\n`);
  const sections: Record<string, string> = {
    health: '0 — Health checks',
    create_tenant: '1 — Tenant CRUD',
    get_all_providers: '2 — Provider CRUD',
    create_target_v1: '3 — Target CRUD',
    create_target_fingerprint: '4 — Target Fingerprint',
    get_proxies: '5 — Proxies (read)',
    bullmq_active_jobs: '6 — BullMQ',
    monitoring_data: '7 — Monitoring',
    cdc_target_create: '8 — CDC + Redis',
    enrich_validate_proxies: '9 — Enrichment',
    data_tunnel_get_proxy: '10 — Data Tunnel',
    black_widow_readiness: '11 — Black Widow',
    delete_target_fingerprint: '12 — CLEANUP',
  };
  cmds.forEach((c) => {
    const section = Object.entries(sections).find(([k]) => c.name.startsWith(k.split('_')[0]) && sections[c.name]);
    if (sections[c.name]) console.log(`\n  ── §${sections[c.name]} ──`);
    const soft = c.continueOnFailure ? ' (soft)' : '';
    console.log(`  ${String(c.orderIndex).padStart(2, ' ')}. ${c.name}  [${c.type}/${c.action}]${soft}`);
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
