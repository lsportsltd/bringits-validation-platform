import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class IdGeneratorService {
  generate(): string {
    return uuidv4();
  }

  generateCorrelationId(): string {
    const short = uuidv4().split('-')[0];
    return `run-${short}`;
  }
}
