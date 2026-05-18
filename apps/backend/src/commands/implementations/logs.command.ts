import { Injectable } from '@nestjs/common';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

@Injectable()
export class LogsCommand implements ICommand {
  type = 'logs';
  supportedActions = ['search'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);
    const expect = definition.expect
      ? this.interpolation.interpolate(definition.expect, context)
      : {};

    const mockLogs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Proxy created',
        correlation_id: context.correlation_id,
        service: config.query?.service || 'mock-service',
      },
    ];

    const evidence = {
      provider: config.provider || 'mock',
      query: config.query,
      results: mockLogs,
      count: mockLogs.length,
      _mock: true,
    };

    const errors: string[] = [];
    if (expect.minResults !== undefined && evidence.count < expect.minResults) {
      errors.push(`Expected at least ${expect.minResults} log entries, found ${evidence.count}`);
    }
    if (expect.maxResults !== undefined && expect.maxResults > 0 && evidence.count > expect.maxResults) {
      errors.push(`Expected at most ${expect.maxResults} log entries, found ${evidence.count}`);
    }

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
  }
}
