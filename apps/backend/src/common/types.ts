export interface CommandDefinition {
  name: string;
  type: string;
  action: string;
  timeoutSeconds?: number;
  config: Record<string, any>;
  expect?: Record<string, any>;
}

export interface CommandResult {
  commandName: string;
  type: string;
  action: string;
  status: 'passed' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  evidence: Record<string, any>;
  errorMessage?: string;
}

export interface FlowDefinition {
  name: string;
  env: string;
  description?: string;
  variables?: Record<string, any>;
  commands: CommandDefinition[];
}

export interface FlowRunResult {
  flowRunId: string;
  flowName: string;
  env: string;
  status: 'passed' | 'failed' | 'running';
  correlationId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  commandResults: CommandResult[];
  failedCommandName?: string;
  failureBoundary?: string;
  summary?: string;
}

export interface ExecutionContext {
  run_id: string;
  flow_run_id?: string;
  env: string;
  correlation_id: string;
  variables: Record<string, any>;
  outputs: Record<string, any>;
}
