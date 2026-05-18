import { Injectable } from '@nestjs/common';
import { ExecutionContext } from './types';

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'authorization', 'apiKey', 'api_key'];

@Injectable()
export class InterpolationService {
  interpolate(value: any, context: ExecutionContext): any {
    if (typeof value === 'string') {
      return this.interpolateString(value, context);
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.interpolate(v, context));
    }
    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.interpolate(v, context);
      }
      return result;
    }
    return value;
  }

  private interpolateString(str: string, context: ExecutionContext): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmed = path.trim();
      const resolved = this.resolvePath(trimmed, context);
      return resolved !== undefined ? String(resolved) : match;
    });
  }

  private resolvePath(path: string, context: ExecutionContext): any {
    const parts = path.split('.');

    const root = parts[0];
    const rest = parts.slice(1);

    let base: any;
    if (root === 'variables') {
      base = context.variables;
    } else if (root === 'outputs') {
      base = context.outputs;
    } else if (root === 'correlation_id') {
      return context.correlation_id;
    } else if (root === 'run_id') {
      return context.run_id;
    } else if (root === 'env') {
      return context.env;
    } else if (root === 'flow_run_id') {
      return context.flow_run_id;
    } else {
      return undefined;
    }

    return rest.reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[key];
    }, base);
  }

  redactSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((v) => this.redactSensitiveFields(v));

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = this.redactSensitiveFields(value);
      }
    }
    return result;
  }
}
