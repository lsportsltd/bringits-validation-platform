import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FlowRunnerService } from '../flows/flow-runner.service';

@Controller('flows')
export class FlowsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flowRunner: FlowRunnerService,
  ) {}

  @Get()
  async findAll() {
    const flows = await this.prisma.flow.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { commands: true } } },
    });
    return flows.map((f) => ({
      ...f,
      commandCount: f._count.commands,
    }));
  }

  @Post()
  async create(@Body() body: any) {
    return this.prisma.flow.create({
      data: {
        name: body.name,
        description: body.description || null,
        env: body.env || 'qa',
        variables: body.variables || {},
        tags: body.tags || [],
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id },
      include: { commands: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    return flow;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.prisma.flow.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        env: body.env || 'qa',
        variables: body.variables || {},
        tags: body.tags || [],
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    // Delete child records first to satisfy FK constraints
    await this.prisma.flowRun.deleteMany({ where: { flowId: id } });
    await this.prisma.flowCommand.deleteMany({ where: { flowId: id } });
    await this.prisma.flow.delete({ where: { id } });
  }

  @Post(':id/commands')
  async addCommand(@Param('id') id: string, @Body() body: any) {
    const flow = await this.prisma.flow.findUnique({
      where: { id },
      include: { commands: { orderBy: { orderIndex: 'desc' }, take: 1 } },
    });
    if (!flow) throw new NotFoundException('Flow not found');

    const nextIndex = flow.commands.length > 0 ? flow.commands[0].orderIndex + 1 : 0;

    return this.prisma.flowCommand.create({
      data: {
        flowId: id,
        commandTemplateId: body.commandTemplateId || null,
        name: body.name,
        type: body.type,
        action: body.action,
        orderIndex: body.orderIndex ?? nextIndex,
        config: body.config,
        expect: body.expect || null,
        timeoutSeconds: body.timeoutSeconds || 30,
        continueOnFailure: body.continueOnFailure || false,
      },
    });
  }

  @Put(':id/commands/:commandId')
  async updateCommand(
    @Param('id') flowId: string,
    @Param('commandId') commandId: string,
    @Body() body: any,
  ) {
    return this.prisma.flowCommand.update({
      where: { id: commandId },
      data: {
        name: body.name,
        type: body.type,
        action: body.action,
        orderIndex: body.orderIndex,
        config: body.config,
        expect: body.expect || null,
        timeoutSeconds: body.timeoutSeconds || 30,
        continueOnFailure: body.continueOnFailure || false,
        commandTemplateId: body.commandTemplateId || null,
      },
    });
  }

  @Delete(':id/commands/:commandId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCommand(
    @Param('id') flowId: string,
    @Param('commandId') commandId: string,
  ) {
    await this.prisma.flowCommand.delete({ where: { id: commandId } });
  }

  @Post(':id/run')
  async runFlow(@Param('id') id: string, @Body() body: any) {
    return this.flowRunner.runFlow(id, body.variables);
  }
}
