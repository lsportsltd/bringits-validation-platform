import { Injectable } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

// Named connections loaded from env at startup.
// Add entries like: CONN_<NAME>_URL=postgresql://user:pass@host:5432/db
// e.g. CONN_LINK_API_URL=postgresql://...
function buildConnectionMap(): Record<string, PoolConfig> {
  const map: Record<string, PoolConfig> = {};
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^CONN_(.+)_URL$/i);
    if (match && value) {
      map[match[1].toLowerCase()] = { connectionString: value, ssl: { rejectUnauthorized: false } };
    }
  }
  return map;
}

const CONNECTION_MAP = buildConnectionMap();
const pools: Record<string, Pool> = {};

function getPool(name: string): Pool {
  const key = name.toLowerCase();
  if (!pools[key]) {
    const config = CONNECTION_MAP[key];
    if (!config) {
      throw new Error(
        `Unknown connection "${name}". Available: ${Object.keys(CONNECTION_MAP).join(', ') || '(none configured)'}. Add CONN_${name.toUpperCase()}_URL to .env`,
      );
    }
    pools[key] = new Pool(config);
  }
  return pools[key];
}

const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|UPSERT)\b/i;
const BLOCKED_KEYWORDS = /\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;

@Injectable()
export class PostgresCommand implements ICommand {
  type = 'postgres';
  supportedActions = ['query', 'execute'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);
    const expect = definition.expect
      ? this.interpolation.interpolate(definition.expect, context)
      : {};

    try {
      const sql: string = config.query || '';
      const connectionName: string = config.connection || 'default';
      const isExecuteAction = definition.action === 'execute';

      if (BLOCKED_KEYWORDS.test(sql)) {
        throw new Error(`Blocked SQL keyword detected. DROP/ALTER/TRUNCATE/CREATE are not allowed.`);
      }

      if (!isExecuteAction && WRITE_KEYWORDS.test(sql)) {
        throw new Error(`Write query (INSERT/UPDATE/DELETE) requires action "execute", not "query".`);
      }

      const pool = getPool(connectionName);
      const result = await pool.query(sql);

      const evidence: Record<string, any> = {
        connection: connectionName,
        query: sql,
        rowCount: result.rowCount ?? 0,
        rows: result.rows,
      };

      const errors = this.validateExpect(expect, evidence);
      const finishedAt = new Date();

      return {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status: errors.length === 0 ? 'passed' : 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        evidence,
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
        evidence: { query: config.query, connection: config.connection },
        errorMessage: err.message,
      };
    }
  }

  private validateExpect(expect: any, evidence: any): string[] {
    const errors: string[] = [];
    if (!expect) return errors;

    if (expect.rows !== undefined && evidence.rowCount !== expect.rows) {
      errors.push(`Expected ${expect.rows} rows affected, got ${evidence.rowCount}`);
    }
    if (expect.minRows !== undefined && evidence.rows.length < expect.minRows) {
      errors.push(`Expected at least ${expect.minRows} rows, got ${evidence.rows.length}`);
    }
    if (expect.firstRow && evidence.rows.length > 0) {
      const first = evidence.rows[0];
      for (const [key, value] of Object.entries(expect.firstRow)) {
        if (String(first[key]) !== String(value)) {
          errors.push(`Row field "${key}": expected "${value}", got "${first[key]}"`);
        }
      }
    }
    if (expect.notNull && Array.isArray(expect.notNull)) {
      for (const field of expect.notNull) {
        if (evidence.rows.length === 0 || evidence.rows[0][field] == null) {
          errors.push(`Field "${field}" should not be null`);
        }
      }
    }
    return errors;
  }
}
