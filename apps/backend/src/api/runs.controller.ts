import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const [commandRuns, flowRuns] = await Promise.all([
      this.prisma.commandRun.findMany({
        where: { flowRunId: null },
        orderBy: { startedAt: 'desc' },
        take: 50,
      }),
      this.prisma.flowRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      commandRuns,
      flowRuns,
    };
  }

  @Get('commands/:id')
  async findCommandRun(@Param('id') id: string) {
    const run = await this.prisma.commandRun.findUnique({
      where: { id },
      include: { evidenceItems: true },
    });
    if (!run) throw new NotFoundException('Command run not found');
    return run;
  }

  @Get('flows/:id')
  async findFlowRun(@Param('id') id: string) {
    const run = await this.prisma.flowRun.findUnique({
      where: { id },
      include: {
        commandRuns: {
          orderBy: { startedAt: 'asc' },
          include: { evidenceItems: true },
        },
        evidenceItems: true,
      },
    });
    if (!run) throw new NotFoundException('Flow run not found');
    return run;
  }
}
