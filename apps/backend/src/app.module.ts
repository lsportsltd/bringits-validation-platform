import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaService } from './database/prisma.service';
import { InterpolationService } from './common/interpolation.service';
import { IdGeneratorService } from './common/id-generator.service';

import { HttpCommand } from './commands/implementations/http.command';
import { RedisCommand } from './commands/implementations/redis.command';
import { PostgresCommand } from './commands/implementations/postgres.command';
import { KafkaCommand } from './commands/implementations/kafka.command';
import { KubernetesCommand } from './commands/implementations/kubernetes.command';
import { StorageCommand } from './commands/implementations/storage.command';
import { LogsCommand } from './commands/implementations/logs.command';
import { WaitCommand } from './commands/implementations/wait.command';
import { CommandRegistryService } from './commands/command-registry.service';
import { CommandRunnerService } from './commands/command-runner.service';
import { FlowRunnerService } from './flows/flow-runner.service';

import { CommandsController } from './api/commands.controller';
import { FlowsController } from './api/flows.controller';
import { RunsController } from './api/runs.controller';
import { MetaController } from './api/meta.controller';
import { ChatController } from './api/chat.controller';
import { ConnectionsController } from './connections/connections.controller';
import { ConnectionsService } from './connections/connections.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CommandsController, FlowsController, RunsController, MetaController, ChatController, ConnectionsController],
  providers: [
    PrismaService,
    InterpolationService,
    IdGeneratorService,
    HttpCommand,
    RedisCommand,
    PostgresCommand,
    KafkaCommand,
    KubernetesCommand,
    StorageCommand,
    LogsCommand,
    WaitCommand,
    CommandRegistryService,
    CommandRunnerService,
    FlowRunnerService,
    ConnectionsService,
  ],
})
export class AppModule {}
