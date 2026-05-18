import { Injectable } from '@nestjs/common';
import { Kafka, Admin, Consumer, logLevel } from 'kafkajs';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

// Named Kafka cluster registry — built from env vars
// Pattern: KAFKA_<NAME>_BROKERS / KAFKA_<NAME>_USERNAME / KAFKA_<NAME>_PASSWORD / KAFKA_<NAME>_MECHANISM
interface KafkaConfig {
  brokers: string;
  username?: string;
  password?: string;
  mechanism?: string;
}

function buildKafkaMap(): Record<string, KafkaConfig> {
  const map: Record<string, KafkaConfig> = {};
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^KAFKA_(.+)_BROKERS$/i);
    if (match && value) {
      const name = match[1].toLowerCase();
      map[name] = {
        brokers: value,
        username: process.env[`KAFKA_${match[1]}_USERNAME`],
        password: process.env[`KAFKA_${match[1]}_PASSWORD`],
        mechanism: (process.env[`KAFKA_${match[1]}_MECHANISM`] || 'plain').toLowerCase(),
      };
    }
  }
  return map;
}

const KAFKA_MAP = buildKafkaMap();
const adminClients: Record<string, Admin> = {};

function getAdmin(name: string): Admin {
  if (adminClients[name]) return adminClients[name];
  const cfg = KAFKA_MAP[name.toLowerCase()];
  if (!cfg) {
    throw new Error(
      `Kafka connection "${name}" not found. Available: ${Object.keys(KAFKA_MAP).join(', ')}`,
    );
  }

  const kafka = new Kafka({
    brokers: cfg.brokers.split(',').map((b) => b.trim()),
    logLevel: logLevel.ERROR,
    ssl: !!cfg.username,
    sasl: cfg.username
      ? { mechanism: 'plain' as any, username: cfg.username, password: cfg.password! }
      : undefined,
    connectionTimeout: 8000,
    requestTimeout: 10000,
  });

  const admin = kafka.admin();
  adminClients[name] = admin;
  return admin;
}

async function withAdmin<T>(name: string, fn: (admin: Admin) => Promise<T>): Promise<T> {
  const admin = getAdmin(name);
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.disconnect();
  }
}

@Injectable()
export class KafkaCommand implements ICommand {
  type = 'kafka';
  supportedActions = ['list_topics', 'topic_exists', 'consumer_lag', 'produce'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);
    const expect = definition.expect
      ? this.interpolation.interpolate(definition.expect, context)
      : {};

    try {
      const connectionName: string = config.connection || 'cdc';
      const evidence = await this.runAction(definition.action, config, connectionName);
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

  private async runAction(action: string, config: any, connectionName: string): Promise<Record<string, any>> {
    switch (action) {
      case 'list_topics': {
        return await withAdmin(connectionName, async (admin) => {
          const topics = await admin.listTopics();
          const filtered = config.prefix
            ? topics.filter((t) => t.startsWith(config.prefix))
            : topics;
          return { topics: filtered, count: filtered.length };
        });
      }

      case 'topic_exists': {
        return await withAdmin(connectionName, async (admin) => {
          const topics = await admin.listTopics();
          const exists = topics.includes(config.topic);
          return { topic: config.topic, exists };
        });
      }

      case 'consumer_lag': {
        return await withAdmin(connectionName, async (admin) => {
          const offsets = await admin.fetchOffsets({
            groupId: config.consumerGroup,
            topics: [config.topic],
          });
          const endOffsets = await admin.fetchTopicOffsets(config.topic);
          let totalLag = 0;
          for (const { partition, offset } of offsets[0]?.partitions ?? []) {
            const end = endOffsets.find((e) => e.partition === partition);
            if (end) {
              totalLag += Math.max(0, parseInt(end.offset, 10) - parseInt(offset, 10));
            }
          }
          return { topic: config.topic, consumerGroup: config.consumerGroup, totalLag };
        });
      }

      case 'produce': {
        const cfg = KAFKA_MAP[connectionName.toLowerCase()];
        if (!cfg) throw new Error(`Kafka connection "${connectionName}" not found`);
        const kafka = new Kafka({
          brokers: cfg.brokers.split(',').map((b) => b.trim()),
          logLevel: logLevel.ERROR,
          ssl: !!cfg.username,
          sasl: cfg.username
            ? { mechanism: 'plain' as any, username: cfg.username, password: cfg.password! }
            : undefined,
          connectionTimeout: 8000,
        });
        const producer = kafka.producer();
        await producer.connect();
        try {
          const result = await producer.send({
            topic: config.topic,
            messages: [
              {
                key: config.key ?? null,
                value: typeof config.value === 'string' ? config.value : JSON.stringify(config.value),
              },
            ],
          });
          return { topic: config.topic, result };
        } finally {
          await producer.disconnect();
        }
      }

      default:
        throw new Error(`Unsupported Kafka action: ${action}`);
    }
  }

  private validateExpect(action: string, expect: any, evidence: any): string[] {
    const errors: string[] = [];
    if (!expect || Object.keys(expect).length === 0) return errors;

    if (expect.exists !== undefined) {
      if (expect.exists && !evidence.exists) errors.push(`Expected topic to exist`);
      if (!expect.exists && evidence.exists) errors.push(`Expected topic to NOT exist`);
    }
    if (expect.minTopics !== undefined && evidence.count < expect.minTopics) {
      errors.push(`Expected at least ${expect.minTopics} topics, found ${evidence.count}`);
    }
    if (expect.maxLag !== undefined && evidence.totalLag > expect.maxLag) {
      errors.push(`Consumer lag ${evidence.totalLag} exceeds max ${expect.maxLag}`);
    }
    return errors;
  }
}
