import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';

// ─── Provider abstraction ────────────────────────────────────────────────────
// Priority: OPENAI_API_KEY → GROQ_API_KEY → Ollama (free, local)
// Set OLLAMA_URL to override Ollama endpoint (default: http://localhost:11434)
// Set OLLAMA_MODEL to pick a model (default: llama3)

interface ChatMessage { role: string; content: string }

const AI_DISABLED_MSG = JSON.stringify({
  message:
    'AI Flow Builder is not configured. Set OPENAI_API_KEY, GROQ_API_KEY, or run Ollama locally (ollama serve).',
  flow: null,
});

async function callLLM(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const openaiKey  = process.env.OPENAI_API_KEY;
  const groqKey    = process.env.GROQ_API_KEY;
  const ollamaUrl  = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';

  const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  // 1. OpenAI
  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: allMessages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    const d = await res.json() as any;
    return d.choices?.[0]?.message?.content ?? '{}';
  }

  // 2. Groq (free tier)
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama3-70b-8192', messages: allMessages, temperature: 0.1 }),
    });
    const d = await res.json() as any;
    return d.choices?.[0]?.message?.content ?? '{}';
  }

  // 3. Ollama — may not be available in cloud; fail gracefully
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: allMessages,
        stream: false,
        format: 'json',
        options: { temperature: 0.1, num_predict: 2048 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const d = await res.json() as any;
    return d.message?.content ?? '{}';
  } catch {
    return AI_DISABLED_MSG;
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert assistant that builds validation flows for the LSports Link platform.
A flow is a named sequence of commands that test APIs, databases, Redis, or Kafka.

## Command types

### http
action: GET | POST | PUT | PATCH | DELETE
config: { url, method, headers?, body? }
expect: { statusCode, body? }

### postgres
action: "query" (SELECT) | "execute" (INSERT/UPDATE/DELETE)
config: { connection: "link_api" | "link_api_ro", query: "SQL" }
expect: { rows?: number }

### redis
action: get | set | del | exists | keys | hget | hgetall | llen | ttl
config: { connection: "link_clustered" | "black_widow_clustered" | "data_clustered", key?, pattern?, field?, value?, ttlSeconds? }
expect: { exists?: boolean, value?: string, minKeys?: number }
NOTE: "keys" action uses SCAN with a pattern — use pattern like "*{targetId}*" to find proxy pool sorted sets after CDC events

### kafka
action: list_topics | topic_exists | consumer_lag | produce
config: { connection: "cdc", topic?, consumerGroup?, prefix? }
expect: { exists?: boolean, minTopics?: number, maxLag?: number }

## All Link Platform services & endpoints

### link-api  base: http://localhost:3001

Health
  GET  /health  → 200

Tenants  (prefix /api/v1/tenants)
  GET    /tenants               → tenant[]
  POST   /tenants               body:{ name(req), isActive?(bool) }  → 201 { id, name }
  GET    /tenants/:id           → { tenant:{ id, name, isActive } }
  PUT    /tenants/:id           body:{ name?, isActive? }

Targets  (prefix /api/v1/targets)
  POST   /targets               body:{ tenantId(UUID), domain?, name, isActive?, countries?[], configurations? }  → 201 { id }
  GET    /targets               query:{ isActive? }
  GET    /targets/tenant/:tenantId  query:{ domain? }
  GET    /targets/:id           → { target:{ id, name, domain, tenantId } }
  PATCH  /targets/:id           header: x-lsports-user-tenant-id(req)  body: same as POST
  DELETE /targets/:id           → 204
  PUT    /targets/activate/:id   body:{ userEmail? }
  PUT    /targets/deactivate/:id body:{ userEmail? }
  PUT    /targets/addCountries/:id     body:{ countries[], userEmail? }
  PUT    /targets/deleteCountries/:id  query:{ deleteAll? }  body:{ countries[] }
  PUT    /targets/editConfigurations/:id body:{ configurations }
  POST   /targets/resolve        body:{ domain, countries[], tenantId? }

Proxies  (prefix /api/v1/proxies)
  GET    /proxies               query:{ pageSize?,page?,source[]?,ipPrefix?,providerId[]?,tenantId? }
  GET    /proxies/proxies       same query + header x-lsports-user-tenant-id(optional)
  POST   /proxies/bulk          body:{ tenantId, proxies[]{protocol,host,port,username?,password?,country?}, source OR providerId }
  PATCH  /proxies/bulk          body:{ proxyIds[](max500), source?,providerId?,userEmail? }
  DELETE /proxies/ipPrefix      query:{ ipPrefix(req) }
  DELETE /proxies/source        query:{ name(req), subsource? }
  DELETE /proxies/deleteBulk    body:{ proxyIds[]?,source[]?,userEmail? }
  POST   /proxies/re-enrichment/manual  body:{ proxyIds[]?,source[]?,subSource[]? }

Providers  (prefix /api/v1/providers)
  GET    /providers             → { id, name, listCount, proxyCount }[]
  POST   /providers             body:{ name }  → 201 { id, name }
  PATCH  /providers/:providerId body:{ name? }
  GET    /providers/:providerId/lists  → list[]
  POST   /providers/:providerId/lists  body:{ name?, model?(PER_GB|UNLIMITED), price?, unit?, amount? }
  PATCH  /providers/lists/:listId      body:{ model?, price?, unit?, amount? }

BullMQ  (prefix /api/v1/bullMQ)
  GET    /bullMQ/getActiveJobs
  GET    /bullMQ/getWaitingJobs

Target Fingerprint  (prefix /api/v1/target-fingerprint)
  POST   /target-fingerprint          body:{ targetId(UUID), fingerprintId(number) }
  GET    /target-fingerprint          query:{ targetId?, fingerprintId? }
  PATCH  /target-fingerprint/:targetId/:fingerprintId
  DELETE /target-fingerprint/:targetId/:fingerprintId

Proxy Targets v1  (prefix /api/v1/proxyTargets)
  GET    /proxyTargets/valid          query:{ targetId(req), fingerprintId? }
  GET    /proxyTargets/validations/:targetId  query:{ fingerprintId?, limit? }
  POST   /proxyTargets/burn           body:{ proxyId, targetId, fingerprintId? }
  POST   /proxyTargets/unassign       body:{ proxyId, targetId, fingerprintId? }

Proxy Targets v2  (prefix /api/v2)
  GET    /proxyTargets/valid          query:{ tenantId(req), domain(req), countryCodes? }
  POST   /targets                     body:{ tenantId, domain, name, isActive, countries[], configurations }

### link-synchronizer  base: http://localhost:3009

  GET  /health
  GET  /health/readiness
  POST /debug/cdc   — simulate CDC Kafka message
    body: { topic: "targets"|"tenants"|etc, message: { key: "<id>", value: "<JSON-string>" } }
    value (double-serialised JSON string):
      op "c" (create): {"before":null,"after":{...entity},"source":{"db":"link","table":"targets"},"op":"c"}
      op "u" (update): {"before":{...old},"after":{...new},"source":{...},"op":"u"}
      op "d" (delete): {"before":{...entity},"after":null,"source":{...},"op":"d"}

### link-enrichment  base: http://localhost:3003

  GET  /health
  POST /debug/enrich-proxy    body: raw proxy URL string "http://user:pass@host:port"
  POST /validation/proxies    body:{ proxies[]{host,port,protocol,username?,password?,country?} }  max 100

### link-monitoring  base: http://localhost:3010  prefix: /api

  GET  /api/health
  GET  /api/monitoring/data
  GET  /api/monitoring/ingest-queue

### link-results  base: http://localhost:3011  prefix: /api

  GET  /api/health   (Terminus — Redis check)

### data-link-tunnel  base: http://localhost:8080  (Rust/Hyper, no /api prefix)

  GET  /health               → { "status": "healthy" }
  GET  /api/proxy?sessionId=<id>   → proxy session JSON
  POST /api/report           body:{ action("burn"|"unassign"|"supply"|"not supply"), sessionId, source?, sub_source? }
  POST /request              header: x-tenant-id(req)  body:{ method, url, headers?, body?, countries? }

### black-widow-scraper  base: http://localhost:3005  prefix: /api  (HTTP app)

  GET  /api/health
  GET  /api/health/readiness   (Redis + BullMQ + Kafka checks)
  POST /api/sandbox            body:{ id, projectId, stepId, tenantId?, ttl?, commands?, local_variables? }
  POST /api/sandbox/evaluate   body:{ input, contentDecision }
  POST /api/sandbox/evaluate-expression  body:{ expression, context? }

## Redis sorted-set CDC verification pattern
After CDC "create" for a target: use redis "keys" with pattern "*<targetId>*" on link_clustered to verify pool was built.
After CDC "delete": same pattern, expect minKeys: 0 to confirm pool was removed.
Always set continueOnFailure: true on Redis CDC verification steps.

## Interpolation
- {{variables.link_api_url}} — use flow variables for base URLs
- {{outputs.step_name.responseBody.id}} — reference outputs of previous steps
- {{outputs.step_name.responseBody.field}}

## Flow building rules
1. Start with health_check(s)
2. snake_case command names
3. timeoutSeconds: 15-20 for HTTP, 20 for DB/Redis/Kafka
4. Cleanup steps: continueOnFailure: true
5. Services that may not be running (enrichment, monitoring, tunnel, black-widow): continueOnFailure: true
6. Postgres cleanup: action "execute", connection "link_api"
7. Always include these variables: link_api_url, link_sync_url, and others as needed

## Response format — ONLY valid JSON, no markdown:
{
  "message": "Brief description",
  "flow": {
    "name": "...", "description": "...", "env": "dev",
    "variables": { "link_api_url": "http://localhost:3001", "link_sync_url": "http://localhost:3009" },
    "commands": [
      { "name": "...", "type": "http|postgres|redis|kafka", "action": "...", "config": {}, "expect": {}, "timeoutSeconds": 20, "continueOnFailure": false }
    ]
  }
}

If just chatting: { "message": "...", "flow": null }
ONLY JSON. No markdown fences. No extra text outside the JSON object.`;

// ─── Controller ───────────────────────────────────────────────────────────────
@Controller('chat')
export class ChatController {
  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: { messages: ChatMessage[] }) {
    let raw: string;
    try {
      raw = await callLLM(body.messages, SYSTEM_PROMPT);
    } catch (err: any) {
      return { message: `AI error: ${err.message}`, flow: null };
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { message: raw, flow: null };

    try {
      return JSON.parse(match[0]);
    } catch {
      return { message: raw, flow: null };
    }
  }
}
