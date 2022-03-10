import { Injectable, Autowired } from '@opensumi/di';
import { IJSONSchema, IJSONSchemaMap, localize, ILogger } from '@opensumi/ide-core-browser';
import { ITaskDefinitionRegistry } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';

export const taskDefinitionSchema: IJSONSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      description: localize(
        'TaskDefinition.description',
        "The actual task type. Please note that types starting with a '$' are reserved for internal usage.",
      ),
    },
    required: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    properties: {
      type: 'object',
      description: localize('TaskDefinition.properties', 'Additional properties of the task type'),
      additionalProperties: {
        $ref: 'http://json-schema.org/draft-04/schema#',
      },
    },
  },
};

export interface TaskDefinition {
  type: string;
  required: string[];
  properties: IJSONSchemaMap;
}

export type ITaskDefinitionSchema = Array<TaskDefinition>;

@Injectable()
@Contributes('taskDefinitions')
export class TaskDefinitionContributionPoint extends VSCodeContributePoint<ITaskDefinitionSchema> {
  @Autowired(ITaskDefinitionRegistry)
  taskDefinitionRegistry: ITaskDefinitionRegistry;

  @Autowired(ILogger)
  logger: ILogger;

  contribute() {
    for (const definition of this.json) {
      this.logger.verbose(`${this.extension.id} register taskDefinition ${JSON.stringify(definition)}`);
      this.addDispose(
        this.taskDefinitionRegistry.register(definition.type, {
          ...definition,
          taskType: definition.type,
          extensionId: this.extension.id,
        }),
      );
    }
  }
}
