import { Injectable } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

// Build connection map from env: REDIS_<NAME>_URL → name
function buildRedisMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^REDIS_(.+)_URL$/i);
    if (match && value) {
      map[match[1].toLowerCase()] = value;
    }
  }
  return map;
}

const REDIS_MAP = buildRedisMap();
const clients: Record<string, Redis | Cluster> = {};

function getClient(name: string): Redis | Cluster {
  if (clients[name]) return clients[name];
  const url = REDIS_MAP[name.toLowerCase()];
  if (!url) {
    throw new Error(
      `Redis connection "${name}" not found. Available: ${Object.keys(REDIS_MAP).join(', ')}`,
    );
  }

  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = parseInt(parsed.port || '6379', 10);

  // Use Cluster for all named cloud connections (all our envs are clustered)
  const client = new Cluster([{ host, port }], {
    redisOptions: { connectTimeout: 8000 },
    clusterRetryStrategy: (times) => (times > 2 ? null : 300),
  });

  clients[name] = client;
  return client;
}

@Injectable()
export class RedisCommand implements ICommand {
  type = 'redis';
  supportedActions = ['get', 'set', 'del', 'exists', 'keys', 'hget', 'hgetall', 'llen', 'ttl', 'zcard', 'zrange', 'zrangebyscore', 'zscore'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);
    const expect = definition.expect
      ? this.interpolation.interpolate(definition.expect, context)
      : {};

    try {
      const connectionName: string = config.connection || 'link_clustered';
      const client = getClient(connectionName);
      const evidence = await this.runAction(definition.action, config, client);
      const errors = this.validateExpect(definition.action, expect, evidence);

      const finishedAt = new Date();
      return {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status: errors.length === 0 ? 'passed' : 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        evidence: { ...evidence, connection: connectionName },
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      };
    } catch (err: any) {
      const finishedAt = new Date();
      return {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status: 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        evidence: {},
        errorMessage: err.message,
      };
    }
  }

  private async runAction(action: string, config: any, client: Redis | Cluster): Promise<Record<string, any>> {
    switch (action) {
      case 'get': {
        const value = await client.get(config.key);
        return { key: config.key, value, exists: value !== null };
      }
      case 'set': {
        const args: [string, string, ...any[]] = [config.key, String(config.value)];
        if (config.ttlSeconds) args.push('EX', config.ttlSeconds);
        await (client as Redis).set(...args);
        return { key: config.key, set: true };
      }
      case 'del': {
        const count = await client.del(config.key);
        return { key: config.key, deleted: count };
      }
      case 'exists': {
        const count = await client.exists(config.key);
        return { key: config.key, exists: count > 0 };
      }
      case 'keys': {
        // Use SCAN for safety — never KEYS in production
        const pattern = config.pattern || '*';
        const keys: string[] = [];
        let cursor = '0';
        let iterations = 0;
        const maxIterations = 200; // cap iterations to avoid scanning entire large keyspaces
        do {
          const [nextCursor, batch] = await (client as Redis).scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          keys.push(...batch);
          iterations++;
          if (keys.length > 500) break; // safety cap on results
          if (iterations >= maxIterations) break; // safety cap on scan depth
        } while (cursor !== '0');
        return { pattern, keys, count: keys.length };
      }
      case 'hget': {
        const value = await client.hget(config.key, config.field);
        return { key: config.key, field: config.field, value, exists: value !== null };
      }
      case 'hgetall': {
        const hash = await client.hgetall(config.key);
        return { key: config.key, hash, fieldCount: Object.keys(hash || {}).length };
      }
      case 'llen': {
        const length = await client.llen(config.key);
        return { key: config.key, length };
      }
      case 'ttl': {
        const ttl = await client.ttl(config.key);
        return { key: config.key, ttl };
      }
      // ── Sorted Set operations ──────────────────────────────────────────────
      case 'zcard': {
        const count = await client.zcard(config.key);
        return { key: config.key, count, hasMembers: count > 0 };
      }
      case 'zrange': {
        const min = config.min ?? 0;
        const max = config.max ?? -1;
        const members = await client.zrange(config.key, min, max);
        return { key: config.key, members, count: members.length };
      }
      case 'zrangebyscore': {
        const min = config.min ?? '-inf';
        const max = config.max ?? '+inf';
        const members = await (client as Redis).zrangebyscore(config.key, min, max);
        return { key: config.key, members, count: members.length };
      }
      case 'zscore': {
        const score = await client.zscore(config.key, config.member);
        return { key: config.key, member: config.member, score, exists: score !== null };
      }
      default:
        throw new Error(`Unsupported Redis action: ${action}`);
    }
  }

  private validateExpect(action: string, expect: any, evidence: any): string[] {
    const errors: string[] = [];
    if (!expect || Object.keys(expect).length === 0) return errors;

    if (expect.exists !== undefined) {
      if (expect.exists && !evidence.exists) errors.push(`Expected key to exist but it does not`);
      if (!expect.exists && evidence.exists) errors.push(`Expected key to NOT exist but it does`);
    }
    if (expect.value !== undefined && evidence.value !== String(expect.value)) {
      errors.push(`Expected value "${expect.value}", got "${evidence.value}"`);
    }
    if (expect.minKeys !== undefined && evidence.count < expect.minKeys) {
      errors.push(`Expected at least ${expect.minKeys} keys, found ${evidence.count}`);
    }
    if (expect.minLength !== undefined && evidence.length < expect.minLength) {
      errors.push(`Expected list length >= ${expect.minLength}, got ${evidence.length}`);
    }
    if (expect.minFields !== undefined && evidence.fieldCount < expect.minFields) {
      errors.push(`Expected hash to have >= ${expect.minFields} fields, got ${evidence.fieldCount}`);
    }
    if (expect.minCount !== undefined && evidence.count < expect.minCount) {
      errors.push(`Expected count >= ${expect.minCount}, got ${evidence.count}`);
    }
    if (expect.maxCount !== undefined && evidence.count > expect.maxCount) {
      errors.push(`Expected count <= ${expect.maxCount}, got ${evidence.count}`);
    }
    if (expect.hasMembers !== undefined) {
      if (expect.hasMembers && !evidence.hasMembers) errors.push(`Expected sorted set to have members but it is empty`);
      if (!expect.hasMembers && evidence.hasMembers) errors.push(`Expected sorted set to be empty but has ${evidence.count} members`);
    }
    return errors;
  }
}
