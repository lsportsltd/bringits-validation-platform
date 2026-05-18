import { Controller, Get } from '@nestjs/common';
import { CommandRegistryService } from '../commands/command-registry.service';

@Controller()
export class MetaController {
  constructor(private readonly registry: CommandRegistryService) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('meta/command-types')
  getCommandTypes() {
    const types = this.registry.getSupportedTypes();
    return types.map((type) => ({
      type,
      actions: this.registry.getActionsForType(type),
    }));
  }
}
