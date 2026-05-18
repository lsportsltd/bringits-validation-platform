-- CreateTable
CREATE TABLE "command_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "expect" JSONB,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "command_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "env" TEXT NOT NULL DEFAULT 'qa',
    "variables" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_commands" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "commandTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "expect" JSONB,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "continueOnFailure" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_runs" (
    "id" TEXT NOT NULL,
    "commandTemplateId" TEXT,
    "flowRunId" TEXT,
    "commandName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "configSnapshot" JSONB NOT NULL,
    "expectSnapshot" JSONB,
    "evidence" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_runs" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowName" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "variablesSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "failedCommandName" TEXT,
    "failureBoundary" TEXT,
    "summary" TEXT,
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "commandRunId" TEXT NOT NULL,
    "flowRunId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "flow_commands" ADD CONSTRAINT "flow_commands_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_commands" ADD CONSTRAINT "flow_commands_commandTemplateId_fkey" FOREIGN KEY ("commandTemplateId") REFERENCES "command_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_runs" ADD CONSTRAINT "command_runs_commandTemplateId_fkey" FOREIGN KEY ("commandTemplateId") REFERENCES "command_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_runs" ADD CONSTRAINT "command_runs_flowRunId_fkey" FOREIGN KEY ("flowRunId") REFERENCES "flow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_commandRunId_fkey" FOREIGN KEY ("commandRunId") REFERENCES "command_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_flowRunId_fkey" FOREIGN KEY ("flowRunId") REFERENCES "flow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
