import { Injectable, Logger } from '@nestjs/common';
import { CommandRegistryService } from './command-registry.service';
import { PrismaService } from '../database/prisma.service';
import { InterpolationService } from '../common/interpolation.service';
import { IdGeneratorService } from '../common/id-generator.service';
import { CommandDefinition, CommandResult, ExecutionContext } from '../common/types';

@Injectable()
export class CommandRunnerService {
  private readonly logger = new Logger(CommandRunnerService.name);

  constructor(
    private readonly registry: CommandRegistryService,
    private readonly prisma: PrismaService,
    private readonly interpolation: InterpolationService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async runCommand(
    definition: CommandDefinition,
    context: ExecutionContext,
    commandTemplateId?: string,
  ): Promise<CommandResult> {
    const command = this.registry.find(definition.type, definition.action);

    if (!command) {
      const result: CommandResult = {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status: 'failed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        evidence: {},
        errorMessage: `No implementation found for type="${definition.type}" action="${definition.action}"`,
      };
      await this.persistResult(result, definition, context, commandTemplateId);
      return result;
    }

    let result: CommandResult;
    const startedAt = new Date().toISOString();
    const timeoutMs = (definition.timeoutSeconds ?? 30) * 1000;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Command timed out after ${definition.timeoutSeconds ?? 30}s`)), timeoutMs),
      );
      result = await Promise.race([command.execute(definition, context), timeoutPromise]);
    } catch (err: any) {
      result = {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
        evidence: {},
        errorMessage: err.message || 'Unexpected error',
      };
    }

    await this.persistResult(result, definition, context, commandTemplateId);
    return result;
  }

  private async persistResult(
    result: CommandResult,
    definition: CommandDefinition,
    context: ExecutionContext,
    commandTemplateId?: string,
  ) {
    try {
      const commandRun = await this.prisma.commandRun.create({
        data: {
          commandTemplateId: commandTemplateId || null,
          flowRunId: context.flow_run_id || null,
          commandName: result.commandName,
          type: result.type,
          action: result.action,
          status: result.status,
          correlationId: context.correlation_id,
          startedAt: new Date(result.startedAt),
          finishedAt: new Date(result.finishedAt),
          durationMs: result.durationMs,
          configSnapshot: definition.config as any,
          expectSnapshot: (definition.expect || null) as any,
          evidence: result.evidence as any,
          errorMessage: result.errorMessage || null,
        },
      });

      if (result.evidence && Object.keys(result.evidence).length > 0) {
        await this.prisma.evidenceItem.create({
          data: {
            commandRunId: commandRun.id,
            flowRunId: context.flow_run_id || null,
            sourceType: definition.type,
            sourceName: definition.name,
            payload: result.evidence as any,
          },
        });
      }
    } catch (err: any) {
      this.logger.error('Failed to persist command run', err.message);
    }
  }
}
