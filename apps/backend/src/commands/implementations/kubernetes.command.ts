import { Injectable } from '@nestjs/common';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

@Injectable()
export class KubernetesCommand implements ICommand {
  type = 'kubernetes';
  supportedActions = ['deployment_health', 'pod_health'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);
    const expect = definition.expect
      ? this.interpolation.interpolate(definition.expect, context)
      : {};

    const evidence: Record<string, any> = {
      deployment: config.deployment || 'unknown',
      namespace: config.namespace || 'default',
      _mock: true,
    };

    if (definition.action === 'deployment_health') {
      evidence.readyReplicas = 2;
      evidence.desiredReplicas = 2;
      evidence.availableReplicas = 2;
      evidence.restartsLast10m = 0;
      evidence.pods = [
        { name: `${config.deployment}-abc-1`, status: 'Running', restarts: 0 },
        { name: `${config.deployment}-abc-2`, status: 'Running', restarts: 0 },
      ];
    } else {
      evidence.pods = [{ name: config.pod || 'mock-pod', status: 'Running', restarts: 0 }];
    }

    const errors: string[] = [];
    if (expect.minReadyReplicas !== undefined && evidence.readyReplicas < expect.minReadyReplicas) {
      errors.push(`Expected at least ${expect.minReadyReplicas} ready replicas, got ${evidence.readyReplicas}`);
    }
    if (expect.maxRestartsLast10m !== undefined && evidence.restartsLast10m > expect.maxRestartsLast10m) {
      errors.push(`Expected max ${expect.maxRestartsLast10m} restarts, got ${evidence.restartsLast10m}`);
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
