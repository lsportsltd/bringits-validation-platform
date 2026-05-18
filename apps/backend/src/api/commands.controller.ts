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
import { CommandRunnerService } from '../commands/command-runner.service';
import { IdGeneratorService } from '../common/id-generator.service';
import { ExecutionContext } from '../common/types';

@Controller('commands')
export class CommandsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commandRunner: CommandRunnerService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  @Get()
  async findAll() {
    return this.prisma.commandTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() body: any) {
    return this.prisma.commandTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type,
        action: body.action,
        config: body.config,
        expect: body.expect || null,
        timeoutSeconds: body.timeoutSeconds || 30,
        tags: body.tags || [],
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cmd = await this.prisma.commandTemplate.findUnique({ where: { id } });
    if (!cmd) throw new NotFoundException('Command not found');
    return cmd;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.prisma.commandTemplate.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type,
        action: body.action,
        config: body.config,
        expect: body.expect || null,
        timeoutSeconds: body.timeoutSeconds || 30,
        tags: body.tags || [],
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.prisma.commandRun.deleteMany({ where: { commandTemplateId: id } });
    await this.prisma.commandTemplate.delete({ where: { id } });
  }

  @Post(':id/run')
  async runSaved(@Param('id') id: string, @Body() body: any) {
    const template = await this.prisma.commandTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Command not found');

    const context: ExecutionContext = {
      run_id: this.idGenerator.generate(),
      env: body.env || 'qa',
      correlation_id: this.idGenerator.generateCorrelationId(),
      variables: body.variables || {},
      outputs: {},
    };

    return this.commandRunner.runCommand(
      {
        name: template.name,
        type: template.type,
        action: template.action,
        timeoutSeconds: template.timeoutSeconds,
        config: template.config as Record<string, any>,
        expect: template.expect as Record<string, any> | undefined,
      },
      context,
      template.id,
    );
  }

  @Post('run')
  async runInline(@Body() body: any) {
    const context: ExecutionContext = {
      run_id: this.idGenerator.generate(),
      env: body.env || 'qa',
      correlation_id: this.idGenerator.generateCorrelationId(),
      variables: body.variables || {},
      outputs: {},
    };

    return this.commandRunner.runCommand(
      {
        name: body.name || 'inline-command',
        type: body.type,
        action: body.action,
        timeoutSeconds: body.timeoutSeconds || 30,
        config: body.config,
        expect: body.expect,
      },
      context,
    );
  }
}
