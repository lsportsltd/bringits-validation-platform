import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Link API command templates...');

  // ── link-api: Health ───────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-health',
      name: 'link_api_health',
      description: 'Health check for link-api service',
      type: 'http',
      action: 'get',
      config: { url: '{{env.link_api_url}}/health', headers: {} },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'health'],
    },
  });

  // ── link-api: Proxies ──────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-proxy',
      name: 'get_proxy_by_id',
      description: 'GET /proxies — get proxy by id (query param)',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/proxies',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: { id: '{{variables.proxy_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxies'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-proxies',
      name: 'get_proxies',
      description: 'GET /proxies/proxies — list proxies',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/proxies/proxies',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: {},
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxies'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-create-proxies-bulk',
      name: 'create_proxies_bulk',
      description: 'POST /proxies/bulk — create jobs for new proxies',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/proxies/bulk',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: {
          proxies: '{{variables.proxies}}',
        },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 15,
      tags: ['link-api', 'proxies'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-delete-proxies-bulk',
      name: 'delete_proxies_bulk',
      description: 'DELETE /proxies/deleteBulk — delete proxies in bulk',
      type: 'http',
      action: 'delete',
      config: {
        url: '{{env.link_api_url}}/proxies/deleteBulk',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { ids: '{{variables.proxy_ids}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 15,
      tags: ['link-api', 'proxies'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-delete-proxies-by-source',
      name: 'delete_proxies_by_source',
      description: 'DELETE /proxies/source — remove appender proxies by source',
      type: 'http',
      action: 'delete',
      config: {
        url: '{{env.link_api_url}}/proxies/source',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: { source: '{{variables.source}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxies'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-delete-proxies-by-ip-prefix',
      name: 'delete_proxies_by_ip_prefix',
      description: 'DELETE /proxies/ipPrefix — remove proxies by IP prefix',
      type: 'http',
      action: 'delete',
      config: {
        url: '{{env.link_api_url}}/proxies/ipPrefix',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: { ipPrefix: '{{variables.ip_prefix}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxies'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-trigger-reenrichment',
      name: 'trigger_manual_re_enrichment',
      description: 'POST /proxies/re-enrichment/manual — trigger manual re-enrichment',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/proxies/re-enrichment/manual',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { proxyIds: '{{variables.proxy_ids}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 15,
      tags: ['link-api', 'proxies', 'enrichment'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-update-proxies-bulk',
      name: 'update_proxies_bulk',
      description: 'PATCH /proxies/bulk — update fields on multiple proxies',
      type: 'http',
      action: 'patch',
      config: {
        url: '{{env.link_api_url}}/proxies/bulk',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { ids: '{{variables.proxy_ids}}', fields: '{{variables.fields}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 15,
      tags: ['link-api', 'proxies'],
    },
  });

  // ── link-api: Targets ──────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-create-target',
      name: 'create_target',
      description: 'POST /targets — create a new target',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/targets',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: {
          name: '{{variables.target_name}}',
          type: '{{variables.target_type}}',
        },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-resolve-target',
      name: 'resolve_target',
      description: 'POST /targets/resolve — resolve a target',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/targets/resolve',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { targetId: '{{variables.target_id}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-targets',
      name: 'get_targets',
      description: 'GET /targets — list all targets',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/targets',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: {},
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-target-by-id',
      name: 'get_target_by_id',
      description: 'GET /targets/:id — get a single target',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/targets/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-activate-target',
      name: 'activate_target',
      description: 'PUT /targets/activate/:id — activate a target',
      type: 'http',
      action: 'put',
      config: {
        url: '{{env.link_api_url}}/targets/activate/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: {},
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-deactivate-target',
      name: 'deactivate_target',
      description: 'PUT /targets/deactivate/:id — deactivate a target',
      type: 'http',
      action: 'put',
      config: {
        url: '{{env.link_api_url}}/targets/deactivate/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: {},
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-update-target',
      name: 'update_target',
      description: 'PATCH /targets/:id — update a target',
      type: 'http',
      action: 'patch',
      config: {
        url: '{{env.link_api_url}}/targets/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: '{{variables.target_fields}}',
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-delete-target',
      name: 'delete_target',
      description: 'DELETE /targets/:id — delete a target',
      type: 'http',
      action: 'delete',
      config: {
        url: '{{env.link_api_url}}/targets/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-target-add-countries',
      name: 'target_add_countries',
      description: 'PUT /targets/addCountries/:id — add countries to target',
      type: 'http',
      action: 'put',
      config: {
        url: '{{env.link_api_url}}/targets/addCountries/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { countries: '{{variables.countries}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-target-delete-countries',
      name: 'target_delete_countries',
      description: 'PUT /targets/deleteCountries/:id — remove countries from target',
      type: 'http',
      action: 'put',
      config: {
        url: '{{env.link_api_url}}/targets/deleteCountries/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { countries: '{{variables.countries}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-target-edit-configurations',
      name: 'target_edit_configurations',
      description: 'PUT /targets/editConfigurations/:id — edit target configurations',
      type: 'http',
      action: 'put',
      config: {
        url: '{{env.link_api_url}}/targets/editConfigurations/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { configurations: '{{variables.configurations}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'targets'],
    },
  });

  // ── link-api: ProxyTargets ─────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-valid-proxy',
      name: 'get_valid_proxy',
      description: 'GET /proxyTargets/valid — get a valid proxy for a target',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/proxyTargets/valid',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: { targetId: '{{variables.target_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxy-targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-proxies-for-validation',
      name: 'get_proxies_for_validation',
      description: 'GET /proxyTargets/validations/:targetId — list proxies for validation',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/proxyTargets/validations/{{variables.target_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxy-targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-burn-proxy-target',
      name: 'burn_proxy_target',
      description: 'POST /proxyTargets/burn — burn a proxy-target assignment',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/proxyTargets/burn',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { proxyId: '{{variables.proxy_id}}', targetId: '{{variables.target_id}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxy-targets'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-unassign-proxy-target',
      name: 'unassign_proxy_target',
      description: 'POST /proxyTargets/unassign — unassign a proxy from a target',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/proxyTargets/unassign',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { proxyId: '{{variables.proxy_id}}', targetId: '{{variables.target_id}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'proxy-targets'],
    },
  });

  // ── link-api: Providers ────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-providers',
      name: 'get_providers',
      description: 'GET /providers — list all providers',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/providers',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'providers'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-provider-lists',
      name: 'get_provider_lists',
      description: 'GET /providers/:providerId/lists — get lists for a provider',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/providers/{{variables.provider_id}}/lists',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'providers'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-create-provider',
      name: 'create_provider',
      description: 'POST /providers — create a new provider',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/providers',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { name: '{{variables.provider_name}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'providers'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-update-provider',
      name: 'update_provider',
      description: 'PATCH /providers/:providerId — update a provider',
      type: 'http',
      action: 'patch',
      config: {
        url: '{{env.link_api_url}}/providers/{{variables.provider_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: '{{variables.provider_fields}}',
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'providers'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-create-provider-list',
      name: 'create_provider_list',
      description: 'POST /providers/:providerId/lists — create a list for a provider',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/providers/{{variables.provider_id}}/lists',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { name: '{{variables.list_name}}', cost: '{{variables.list_cost}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'providers'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-update-list-cost',
      name: 'update_list_cost',
      description: 'PATCH /providers/lists/:listId — update list cost',
      type: 'http',
      action: 'patch',
      config: {
        url: '{{env.link_api_url}}/providers/lists/{{variables.list_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { cost: '{{variables.list_cost}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'providers'],
    },
  });

  // ── link-api: Tenants ──────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-create-tenant',
      name: 'create_tenant',
      description: 'POST /tenants — create a new tenant',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/tenants',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { name: '{{variables.tenant_name}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'tenants'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-tenants',
      name: 'get_tenants',
      description: 'GET /tenants — list all tenants',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/tenants',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'tenants'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-tenant-by-id',
      name: 'get_tenant_by_id',
      description: 'GET /tenants/:id — get a single tenant',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/tenants/{{variables.tenant_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'tenants'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-update-tenant',
      name: 'update_tenant',
      description: 'PUT /tenants/:id — update a tenant',
      type: 'http',
      action: 'put',
      config: {
        url: '{{env.link_api_url}}/tenants/{{variables.tenant_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: '{{variables.tenant_fields}}',
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'tenants'],
    },
  });

  // ── link-api: Target Fingerprint ───────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-create-fingerprint',
      name: 'create_target_fingerprint',
      description: 'POST /target-fingerprint — create a fingerprint for a target',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_api_url}}/target-fingerprint',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { targetId: '{{variables.target_id}}', fingerprint: '{{variables.fingerprint}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 10,
      tags: ['link-api', 'fingerprint'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-get-fingerprint',
      name: 'get_target_fingerprint',
      description: 'GET /target-fingerprint — read fingerprints',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/target-fingerprint',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        query: { targetId: '{{variables.target_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'fingerprint'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-update-fingerprint',
      name: 'update_target_fingerprint',
      description: 'PATCH /target-fingerprint/:targetId/:fingerprintId — update fingerprint',
      type: 'http',
      action: 'patch',
      config: {
        url: '{{env.link_api_url}}/target-fingerprint/{{variables.target_id}}/{{variables.fingerprint_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: '{{variables.fingerprint_fields}}',
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'fingerprint'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-delete-fingerprint',
      name: 'delete_target_fingerprint',
      description: 'DELETE /target-fingerprint/:targetId/:fingerprintId — delete fingerprint',
      type: 'http',
      action: 'delete',
      config: {
        url: '{{env.link_api_url}}/target-fingerprint/{{variables.target_id}}/{{variables.fingerprint_id}}',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'fingerprint'],
    },
  });

  // ── link-api: BullMQ ───────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-bullmq-active',
      name: 'bullmq_get_active_jobs',
      description: 'GET /bullMQ/getActiveJobs — list active BullMQ jobs',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/bullMQ/getActiveJobs',
        headers: {},
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'bullmq'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-api-bullmq-waiting',
      name: 'bullmq_get_waiting_jobs',
      description: 'GET /bullMQ/getWaitingJobs — list waiting BullMQ jobs',
      type: 'http',
      action: 'get',
      config: {
        url: '{{env.link_api_url}}/bullMQ/getWaitingJobs',
        headers: {},
      },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-api', 'bullmq'],
    },
  });

  // ── link-enrichment ────────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-enrichment-health',
      name: 'link_enrichment_health',
      description: 'Health check for link-enrichment service',
      type: 'http',
      action: 'get',
      config: { url: '{{env.link_enrichment_url}}/health', headers: {} },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-enrichment', 'health'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-enrichment-enrich-proxy',
      name: 'debug_enrich_proxy',
      description: 'POST /debug/enrich-proxy — trigger proxy enrichment (debug)',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_enrichment_url}}/debug/enrich-proxy',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { proxyId: '{{variables.proxy_id}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 30,
      tags: ['link-enrichment', 'debug'],
    },
  });

  // ── link-synchronizer ─────────────────────────────────────────────────────

  await prisma.commandTemplate.create({
    data: {
      id: 'link-synchronizer-health',
      name: 'link_synchronizer_health',
      description: 'Health check for link-synchronizer service',
      type: 'http',
      action: 'get',
      config: { url: '{{env.link_synchronizer_url}}/health', headers: {} },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-synchronizer', 'health'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-synchronizer-readiness',
      name: 'link_synchronizer_readiness',
      description: 'GET /health/readiness — readiness check for link-synchronizer',
      type: 'http',
      action: 'get',
      config: { url: '{{env.link_synchronizer_url}}/health/readiness', headers: {} },
      expect: { statusCode: 200 },
      timeoutSeconds: 10,
      tags: ['link-synchronizer', 'health'],
    },
  });

  await prisma.commandTemplate.create({
    data: {
      id: 'link-synchronizer-trigger-cdc',
      name: 'debug_trigger_cdc',
      description: 'POST /debug/cdc — trigger CDC event (debug)',
      type: 'http',
      action: 'post',
      config: {
        url: '{{env.link_synchronizer_url}}/debug/cdc',
        headers: { 'x-correlation-id': '{{correlation_id}}' },
        body: { event: '{{variables.cdc_event}}' },
      },
      expect: { statusCode: 201 },
      timeoutSeconds: 15,
      tags: ['link-synchronizer', 'debug'],
    },
  });

  const count = await prisma.commandTemplate.count();
  console.log(`✓ Seeded ${count} command templates.`);
  console.log('');
  console.log('Services covered:');
  console.log('  link-api        — health, proxies (8), targets (11), proxy-targets (4), providers (6), tenants (4), fingerprint (4), bullmq (2)');
  console.log('  link-enrichment — health, debug/enrich-proxy');
  console.log('  link-synchronizer — health, readiness, debug/cdc');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
