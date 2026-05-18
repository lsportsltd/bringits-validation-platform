import { Controller, Get } from '@nestjs/common';
import { CommandRegistryService } from '../commands/command-registry.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly registry: CommandRegistryService) {}

  @Get('command-types')
  getCommandTypes() {
    const types = this.registry.getSupportedTypes();
    return types.map((type) => ({
      type,
      actions: this.registry.getActionsForType(type),
    }));
  }
}
