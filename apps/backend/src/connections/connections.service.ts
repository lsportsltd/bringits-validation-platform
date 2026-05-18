import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { Cluster } from 'ioredis';
import { Kafka, logLevel } from 'kafkajs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnStatus {
  name: string;
  type: 'postgres' | 'redis' | 'kafka';
  status: 'connected' | 'error' | 'checking';
  latencyMs?: number;
  error?: string;
  meta?: Record<string, any>;
}

// ─── Helpers — read env patterns ──────────────────────────────────────────────

function getPostgresConnections(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    const m = key.match(/^CONN_(.+)_URL$/i);
    if (m && val) map[m[1].toLowerCase()] = val;
  }
  return map;
}

function getRedisConnections(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    const m = key.match(/^REDIS_(.+)_URL$/i);
    if (m && val) map[m[1].toLowerCase()] = val;
  }
  return map;
}

interface KafkaCfg { brokers: string; username?: string; password?: string }

function getKafkaConnections(): Record<string, KafkaCfg> {
  const map: Record<string, KafkaCfg> = {};
  for (const [key, val] of Object.entries(process.env)) {
    const m = key.match(/^KAFKA_(.+)_BROKERS$/i);
    if (m && val) {
      const name = m[1].toLowerCase();
      map[name] = {
        brokers: val,
        username: process.env[`KAFKA_${m[1]}_USERNAME`],
        password: process.env[`KAFKA_${m[1]}_PASSWORD`],
      };
    }
  }
  return map;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ConnectionsService implements OnModuleInit {
  private readonly logger = new Logger(ConnectionsService.name);
  private statuses: ConnStatus[] = [];
  private lastChecked: Date | null = null;

  onModuleInit() {
    // Run checks in the background — do not block app startup
    this.logger.log('Probing all connections in background...');
    this.checkAll().catch((e) => this.logger.error('Connection probe failed', e));
  }

  getStatuses() {
    return { statuses: this.statuses, lastChecked: this.lastChecked };
  }

  async checkAll(): Promise<ConnStatus[]> {
    const monitorTopics = (process.env.KAFKA_MONITOR_TOPICS || '')
      .split(',').map(t => t.trim()).filter(Boolean);

    // Run all checks in parallel
    const checks: Promise<ConnStatus>[] = [
      ...Object.entries(getPostgresConnections()).map(([n, u]) => this.checkPostgres(n, u)),
      ...Object.entries(getRedisConnections()).map(([n, u]) => this.checkRedis(n, u)),
      ...Object.entries(getKafkaConnections()).map(([n, c]) => this.checkKafka(n, c, monitorTopics)),
    ];

    const results = await Promise.all(checks);
    this.statuses = results;
    this.lastChecked = new Date();
    return results;
  }

  // ── Postgres ────────────────────────────────────────────────────────────────
  private async checkPostgres(name: string, url: string): Promise<ConnStatus> {
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    const t0 = Date.now();
    try {
      const res = await pool.query('SELECT current_database() AS db, version() AS ver');
      const latencyMs = Date.now() - t0;
      const { db, ver } = res.rows[0];
      this.logger.log(`Postgres [${name}] connected (${latencyMs}ms) — db: ${db}`);
      return { name, type: 'postgres', status: 'connected', latencyMs, meta: { db, version: ver.split(' ').slice(0, 2).join(' ') } };
    } catch (err: any) {
      this.logger.warn(`Postgres [${name}] failed: ${err.message}`);
      return { name, type: 'postgres', status: 'error', error: err.message };
    } finally {
      await pool.end().catch(() => {});
    }
  }

  // ── Redis ───────────────────────────────────────────────────────────────────
  private async checkRedis(name: string, url: string): Promise<ConnStatus> {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parseInt(parsed.port || '6379', 10);
    const t0 = Date.now();

    return new Promise((resolve) => {
      const client = new Cluster([{ host, port }], {
        redisOptions: { connectTimeout: 5000 },
        clusterRetryStrategy: (times) => (times > 1 ? null : 200),
      });

      const done = (result: ConnStatus) => {
        client.quit().catch(() => {});
        resolve(result);
      };

      const timer = setTimeout(() => {
        this.logger.warn(`Redis [${name}] timeout`);
        done({ name, type: 'redis', status: 'error', error: 'connection timeout (5s)' });
      }, 6000);

      client.on('ready', async () => {
        clearTimeout(timer);
        try {
          const info = await client.info('server');
          const versionLine = info.split('\n').find(l => l.startsWith('redis_version'));
          const version = versionLine?.split(':')[1]?.trim() ?? 'unknown';
          const latencyMs = Date.now() - t0;
          this.logger.log(`Redis [${name}] connected (${latencyMs}ms) — v${version}`);
          done({ name, type: 'redis', status: 'connected', latencyMs, meta: { version } });
        } catch (err: any) {
          done({ name, type: 'redis', status: 'error', error: err.message });
        }
      });

      client.on('error', (err) => {
        clearTimeout(timer);
        this.logger.warn(`Redis [${name}] error: ${err.message}`);
        done({ name, type: 'redis', status: 'error', error: err.message });
      });
    });
  }

  // ── Kafka ────────────────────────────────────────────────────────────────────
  private async checkKafka(name: string, cfg: KafkaCfg, monitorTopics: string[]): Promise<ConnStatus> {
    const kafka = new Kafka({
      brokers: cfg.brokers.split(',').map(b => b.trim()),
      logLevel: logLevel.NOTHING,
      ssl: !!cfg.username,
      sasl: cfg.username
        ? { mechanism: 'plain' as any, username: cfg.username, password: cfg.password! }
        : undefined,
      connectionTimeout: 6000,
      requestTimeout: 8000,
      retry: { retries: 0 },   // fail fast — no retries on connection probe
    });

    const admin = kafka.admin();
    const t0 = Date.now();
    try {
      await admin.connect();
      const allTopics = await admin.listTopics();
      const latencyMs = Date.now() - t0;

      // Filter to monitored topics (or show all prefixed with CDC prefix)
      const prefix = process.env.KAFKA_CDC_TOPIC_PREFIX || '';
      const relevant = monitorTopics.length > 0
        ? monitorTopics.filter(t => allTopics.includes(t))
        : allTopics.filter(t => prefix ? t.startsWith(prefix) : true).slice(0, 20);

      // Get consumer group lag for each monitored topic
      const topicDetails: any[] = [];
      for (const topic of relevant) {
        try {
          const offsets = await admin.fetchTopicOffsets(topic);
          const totalMessages = offsets.reduce((sum, p) => sum + parseInt(p.offset, 10), 0);
          topicDetails.push({ topic, partitions: offsets.length, totalMessages });
        } catch {
          topicDetails.push({ topic, partitions: null, totalMessages: null });
        }
      }

      this.logger.log(`Kafka [${name}] connected (${latencyMs}ms) — ${allTopics.length} topics`);
      return {
        name, type: 'kafka', status: 'connected', latencyMs,
        meta: { totalTopics: allTopics.length, monitoredTopics: topicDetails, brokers: cfg.brokers },
      };
    } catch (err: any) {
      this.logger.warn(`Kafka [${name}] failed: ${err.message}`);
      return { name, type: 'kafka', status: 'error', error: err.message };
    } finally {
      await admin.disconnect().catch(() => {});
    }
  }
}
