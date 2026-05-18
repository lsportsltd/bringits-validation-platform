import { Injectable } from '@nestjs/common';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';

@Injectable()
export class WaitCommand implements ICommand {
  type = 'wait';
  supportedActions = ['sleep'];

  async execute(definition: CommandDefinition, _context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date().toISOString();
    const seconds = Number(definition.config?.seconds ?? 5);
    const ms = Math.min(seconds * 1000, 300_000); // max 5 minutes

    await new Promise((resolve) => setTimeout(resolve, ms));

    const finishedAt = new Date().toISOString();
    return {
      commandName: definition.name,
      type: this.type,
      action: definition.action,
      status: 'passed',
      startedAt,
      finishedAt,
      durationMs: ms,
      evidence: { sleptSeconds: seconds },
    };
  }
}
