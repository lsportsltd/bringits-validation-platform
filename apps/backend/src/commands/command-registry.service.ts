import { Injectable, OnModuleInit } from '@nestjs/common';
import { ICommand } from './command.interface';
import { HttpCommand } from './implementations/http.command';
import { RedisCommand } from './implementations/redis.command';
import { PostgresCommand } from './implementations/postgres.command';
import { KafkaCommand } from './implementations/kafka.command';
import { KubernetesCommand } from './implementations/kubernetes.command';
import { StorageCommand } from './implementations/storage.command';
import { LogsCommand } from './implementations/logs.command';
import { WaitCommand } from './implementations/wait.command';

@Injectable()
export class CommandRegistryService implements OnModuleInit {
  private registry = new Map<string, ICommand>();

  constructor(
    private readonly httpCommand: HttpCommand,
    private readonly redisCommand: RedisCommand,
    private readonly postgresCommand: PostgresCommand,
    private readonly kafkaCommand: KafkaCommand,
    private readonly kubernetesCommand: KubernetesCommand,
    private readonly storageCommand: StorageCommand,
    private readonly logsCommand: LogsCommand,
    private readonly waitCommand: WaitCommand,
  ) {}

  onModuleInit() {
    const commands: ICommand[] = [
      this.httpCommand,
      this.redisCommand,
      this.postgresCommand,
      this.kafkaCommand,
      this.kubernetesCommand,
      this.storageCommand,
      this.logsCommand,
      this.waitCommand,
    ];

    for (const cmd of commands) {
      for (const action of cmd.supportedActions) {
        this.registry.set(`${cmd.type}:${action}`, cmd);
      }
    }
  }

  find(type: string, action: string): ICommand | undefined {
    return this.registry.get(`${type}:${action}`);
  }

  getSupportedTypes(): string[] {
    return ['http', 'redis', 'postgres', 'kafka', 'kubernetes', 'storage', 'logs', 'wait'];
  }

  getActionsForType(type: string): string[] {
    const actions: string[] = [];
    for (const key of this.registry.keys()) {
      const [t, a] = key.split(':');
      if (t === type) actions.push(a);
    }
    return actions;
  }
}
