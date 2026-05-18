import { Injectable } from '@nestjs/common';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

@Injectable()
export class StorageCommand implements ICommand {
  type = 'storage';
  supportedActions = ['object_exists', 'read_object_metadata'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);

    const evidence: Record<string, any> = {
      bucket: config.bucket || 'mock-bucket',
      path: config.path || 'mock/path',
      _mock: true,
    };

    if (definition.action === 'object_exists') {
      evidence.exists = true;
    } else if (definition.action === 'read_object_metadata') {
      evidence.metadata = {
        size: 1024,
        contentType: 'application/json',
        updatedAt: new Date().toISOString(),
      };
    }

    const finishedAt = new Date();
    return {
      commandName: definition.name,
      type: definition.type,
      action: definition.action,
      status: 'passed',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      evidence,
    };
  }
}
