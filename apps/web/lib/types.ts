export interface CommandTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  action: string;
  config: Record<string, any>;
  expect?: Record<string, any>;
  timeoutSeconds: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowCommand {
  id: string;
  flowId: string;
  commandTemplateId?: string;
  name: string;
  type: string;
  action: string;
  orderIndex: number;
  config: Record<string, any>;
  expect?: Record<string, any>;
  timeoutSeconds: number;
  continueOnFailure: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  env: string;
  variables?: Record<string, any>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  commands?: FlowCommand[];
  commandCount?: number;
}

export interface CommandRun {
  id: string;
  commandTemplateId?: string;
  flowRunId?: string;
  commandName: string;
  type: string;
  action: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  correlationId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  configSnapshot: Record<string, any>;
  expectSnapshot?: Record<string, any>;
  evidence?: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
  evidenceItems?: EvidenceItem[];
}

export interface FlowRun {
  id: string;
  flowId: string;
  flowName: string;
  env: string;
  status: 'passed' | 'failed' | 'running';
  correlationId: string;
  variablesSnapshot?: Record<string, any>;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  failedCommandName?: string;
  failureBoundary?: string;
  summary?: string;
  report?: Record<string, any>;
  createdAt: string;
  commandRuns?: CommandRun[];
  evidenceItems?: EvidenceItem[];
}

export interface EvidenceItem {
  id: string;
  commandRunId: string;
  flowRunId?: string;
  sourceType: string;
  sourceName: string;
  payload: Record<string, any>;
  createdAt: string;
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

export interface CommandType {
  type: string;
  actions: string[];
}
