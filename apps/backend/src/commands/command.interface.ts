import { CommandDefinition, CommandResult, ExecutionContext } from '../common/types';

export interface ICommand {
  type: string;
  supportedActions: string[];
  execute(
    definition: CommandDefinition,
    context: ExecutionContext,
  ): Promise<CommandResult>;
}
