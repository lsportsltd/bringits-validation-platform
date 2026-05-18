import { Controller, Get, Post } from '@nestjs/common';
import { ConnectionsService } from './connections.service';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly svc: ConnectionsService) {}

  @Get()
  get() {
    return this.svc.getStatuses();
  }

  @Post('refresh')
  async refresh() {
    await this.svc.checkAll();
    return this.svc.getStatuses();
  }
}
