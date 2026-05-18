import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CommandRunnerService } from '../commands/command-runner.service';
import { InterpolationService } from '../common/interpolation.service';
import { IdGeneratorService } from '../common/id-generator.service';
import { CommandResult, ExecutionContext, FlowRunResult } from '../common/types';

const BOUNDARY_LABELS: [string, string, string][] = [
  ['create', 'validate_.*_in_db', 'HTTP API → Database'],
  ['validate_.*_in_db', 'validate_.*_in_redis', 'Database → Redis cache'],
  ['update', 'validate_.*_updated_in_redis', 'Update → Cache synchronization'],
  ['delete', 'validate_.*_removed_from_redis', 'Delete → Cache invalidation'],
  ['deployment', 'pod', 'Kubernetes runtime health'],
  ['validate_.*_service_alive', '', 'Kubernetes runtime health'],
];

@Injectable()
export class FlowRunnerService {
  private readonly logger = new Logger(FlowRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commandRunner: CommandRunnerService,
    private readonly interpolation: InterpolationService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async runFlow(flowId: string, overrideVariables?: Record<string, any>): Promise<FlowRunResult> {
    const flow = await this.prisma.flow.findUniqueOrThrow({
      where: { id: flowId },
      include: { commands: { orderBy: { orderIndex: 'asc' } } },
    });

    const runId = this.idGenerator.generate();
    const correlationId = this.idGenerator.generateCorrelationId();
    const variables = {
      ...(flow.variables as Record<string, any> || {}),
      ...(overrideVariables || {}),
    };

    const flowRun = await this.prisma.flowRun.create({
      data: {
        flowId: flow.id,
        flowName: flow.name,
        env: flow.env,
        status: 'running',
        correlationId,
        variablesSnapshot: variables as any,
        startedAt: new Date(),
      },
    });

    const context: ExecutionContext = {
      run_id: runId,
      flow_run_id: flowRun.id,
      env: flow.env,
      correlation_id: correlationId,
      variables: {},
      outputs: {},
    };

    // Interpolate variables that may reference run_id etc.
    for (const [k, v] of Object.entries(variables)) {
      context.variables[k] = this.interpolation.interpolate(v, context);
    }

    const commandResults: CommandResult[] = [];
    let failedCommandName: string | undefined;
    let flowStatus: 'passed' | 'failed' = 'passed';

    for (const flowCmd of flow.commands) {
      const definition = {
        name: flowCmd.name,
        type: flowCmd.type,
        action: flowCmd.action,
        timeoutSeconds: flowCmd.timeoutSeconds,
        config: flowCmd.config as Record<string, any>,
        expect: flowCmd.expect as Record<string, any> | undefined,
      };

      const result = await this.commandRunner.runCommand(
        definition,
        context,
        flowCmd.commandTemplateId || undefined,
      );

      // Store outputs for interpolation by subsequent commands
      context.outputs[flowCmd.name] = result.evidence;
      commandResults.push(result);

      if (result.status === 'failed') {
        flowStatus = 'failed';
        failedCommandName = flowCmd.name;
        if (!flowCmd.continueOnFailure) {
          break;
        }
      }
    }

    const finishedAt = new Date();
    const flowRunStart = new Date(flowRun.startedAt);
    const durationMs = finishedAt.getTime() - flowRunStart.getTime();

    const failureBoundary = failedCommandName
      ? this.inferBoundary(commandResults, failedCommandName)
      : undefined;

    const summary = this.buildSummary(flow.name, commandResults, failedCommandName);
    const report = this.buildReport(commandResults, context);

    await this.prisma.flowRun.update({
      where: { id: flowRun.id },
      data: {
        status: flowStatus,
        finishedAt,
        durationMs,
        failedCommandName: failedCommandName || null,
        failureBoundary: failureBoundary || null,
        summary,
        report: report as any,
      },
    });

    return {
      flowRunId: flowRun.id,
      flowName: flow.name,
      env: flow.env,
      status: flowStatus,
      correlationId,
      startedAt: flowRun.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      commandResults,
      failedCommandName,
      failureBoundary,
      summary,
    };
  }

  private inferBoundary(results: CommandResult[], failedName: string): string {
    const failedIdx = results.findIndex((r) => r.commandName === failedName);
    if (failedIdx <= 0) return 'Initial validation';

    const prev = results[failedIdx - 1].commandName;
    const curr = failedName;

    for (const [prevPattern, currPattern, label] of BOUNDARY_LABELS) {
      const prevRx = new RegExp(prevPattern, 'i');
      const currRx = currPattern ? new RegExp(currPattern, 'i') : null;
      if (prevRx.test(prev) && (!currRx || currRx.test(curr))) {
        return label;
      }
    }

    return `${prev} → ${curr}`;
  }

  private buildSummary(flowName: string, results: CommandResult[], failedName?: string): string {
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    if (!failedName) {
      return `Flow "${flowName}" completed successfully. ${passed} commands passed.`;
    }
    return `Flow "${flowName}" failed at "${failedName}". ${passed} passed, ${failed} failed.`;
  }

  private buildReport(results: CommandResult[], context: ExecutionContext): Record<string, any> {
    return {
      correlationId: context.correlation_id,
      env: context.env,
      commands: results.map((r) => ({
        name: r.commandName,
        type: r.type,
        action: r.action,
        status: r.status,
        durationMs: r.durationMs,
        error: r.errorMessage,
      })),
    };
  }
}
