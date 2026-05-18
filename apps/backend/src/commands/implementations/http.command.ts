import { Injectable } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { ICommand } from '../command.interface';
import { CommandDefinition, CommandResult, ExecutionContext } from '../../common/types';
import { InterpolationService } from '../../common/interpolation.service';

@Injectable()
export class HttpCommand implements ICommand {
  type = 'http';
  supportedActions = ['get', 'post', 'put', 'patch', 'delete'];

  constructor(private readonly interpolation: InterpolationService) {}

  async execute(definition: CommandDefinition, context: ExecutionContext): Promise<CommandResult> {
    const startedAt = new Date();
    const config = this.interpolation.interpolate(definition.config, context);
    const expect = definition.expect
      ? this.interpolation.interpolate(definition.expect, context)
      : {};

    try {
      const axiosConfig: AxiosRequestConfig = {
        method: definition.action as any,
        url: config.url,
        headers: config.headers || {},
        params: config.query || {},
        data: config.body,
        timeout: (definition.timeoutSeconds || 30) * 1000,
        validateStatus: () => true,
      };

      const response = await axios(axiosConfig);
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const evidence = this.interpolation.redactSensitiveFields({
        url: config.url,
        method: definition.action.toUpperCase(),
        statusCode: response.status,
        responseHeaders: response.headers,
        responseBody: response.data,
        durationMs,
      });

      const errors: string[] = [];

      if (expect.statusCode !== undefined && response.status !== expect.statusCode) {
        errors.push(`Expected status ${expect.statusCode}, got ${response.status}`);
      }

      if (expect.maxDurationMs !== undefined && durationMs > expect.maxDurationMs) {
        errors.push(`Expected max duration ${expect.maxDurationMs}ms, took ${durationMs}ms`);
      }

      if (expect.body && typeof expect.body === 'object' && Object.keys(expect.body).length > 0) {
        const bodyErrors = this.validateBodyExpect(response.data, expect.body);
        errors.push(...bodyErrors);
      }

      if (expect.notContainsFields && Array.isArray(expect.notContainsFields)) {
        const body = response.data;
        for (const field of expect.notContainsFields) {
          if (body && typeof body === 'object' && field in body) {
            errors.push(`Response body should not contain field: ${field}`);
          }
        }
      }

      const status = errors.length === 0 ? 'passed' : 'failed';

      return {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        evidence,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      };
    } catch (err: any) {
      const finishedAt = new Date();
      return {
        commandName: definition.name,
        type: definition.type,
        action: definition.action,
        status: 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        evidence: { url: config.url, method: definition.action.toUpperCase() },
        errorMessage: err.message || 'Unknown HTTP error',
      };
    }
  }

  private validateBodyExpect(actual: any, expected: any): string[] {
    const errors: string[] = [];
    if (!actual || typeof actual !== 'object') {
      if (expected && typeof expected === 'object') {
        errors.push('Response body is not an object');
      }
      return errors;
    }

    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] === undefined) {
        errors.push(`Expected field "${key}" not found in response`);
      } else if (String(actual[key]) !== String(value)) {
        errors.push(`Field "${key}": expected "${value}", got "${actual[key]}"`);
      }
    }
    return errors;
  }
}
