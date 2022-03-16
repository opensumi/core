import { Injectable } from '@opensumi/di';

import { IDisposable, Disposable } from './disposable';
import { IJSONSchemaMap, IJSONSchema } from './json-schema';
import { formatLocalize } from './localize';
import { IStringDictionary } from './types/string';
import { deepClone } from './utils/objects';

interface TaskDefinition {
  extensionId: string;
  taskType: string;
  required: string[];
  properties: IJSONSchemaMap;
}

export interface TaskIdentifier {
  type: string;
  [name: string]: any;
}

export interface KeyedTaskIdentifier extends TaskIdentifier {
  _key: string;
}

export namespace KeyedTaskIdentifier {
  function sortedStringify(literal: any): string {
    const keys = Object.keys(literal).sort();
    let result = '';
    for (const key of keys) {
      let stringified = literal[key];
      if (stringified instanceof Object) {
        stringified = sortedStringify(stringified);
      } else if (typeof stringified === 'string') {
        stringified = stringified.replace(/,/g, ',,');
      }
      result += key + ',' + stringified + ',';
    }
    return result;
  }
  export function create(value: TaskIdentifier): KeyedTaskIdentifier {
    const resultKey = sortedStringify(value);
    const result = { _key: resultKey, type: value.taskType };
    Object.assign(result, value);
    return result;
  }
}

export const ITaskDefinitionRegistry = Symbol('ITaskDefinitionRegistry');

export interface ITaskDefinitionRegistry {
  onReady(): Promise<void>;
  register(taskType: string, definition: TaskDefinition): IDisposable;
  get(key: string): TaskDefinition;
  all(): TaskDefinition[];
  getJsonSchema(): IJSONSchema;
  createTaskIdentifier(
    external: TaskIdentifier,
    reporter: { error(message: string): void },
  ): KeyedTaskIdentifier | undefined;
}

@Injectable()
export class TaskDefinitionRegistryImpl implements ITaskDefinitionRegistry {
  private taskTypes: IStringDictionary<TaskDefinition>;
  private readyPromise: Promise<void>;
  private _schema: IJSONSchema;

  constructor() {
    this.taskTypes = Object.create(null);
    this.readyPromise = new Promise<void>((res, rej) => res(undefined));
  }

  public onReady(): Promise<void> {
    return this.readyPromise;
  }

  register(taskType: string, definition: TaskDefinition) {
    this.taskTypes[taskType] = definition;
    return Disposable.create(() => delete this.taskTypes[taskType]);
  }

  public get(key: string): TaskDefinition {
    return this.taskTypes[key];
  }

  public all(): TaskDefinition[] {
    return Object.keys(this.taskTypes).map((key) => this.taskTypes[key]);
  }

  public createTaskIdentifier = (
    external: TaskIdentifier,
    reporter: { error(message: string): void },
  ): KeyedTaskIdentifier | undefined => {
    const definition = this.get(external.type);
    if (definition === undefined) {
      // We have no task definition so we can't sanitize the literal. Take it as is
      const copy = deepClone(external);
      delete copy._key;
      return KeyedTaskIdentifier.create(copy);
    }

    const literal: { type: string; [name: string]: any } = Object.create(null);
    literal.type = definition.taskType;
    const required: Set<string> = new Set();
    definition.required.forEach((element) => required.add(element));

    const properties = definition.properties;
    for (const property of Object.keys(properties)) {
      const value = external[property];
      if (value !== undefined && value !== null) {
        literal[property] = value;
      } else if (required.has(property)) {
        const schema = properties[property];
        if (schema.default !== undefined) {
          literal[property] = deepClone(schema.default);
        } else {
          switch (schema.type) {
            case 'boolean':
              literal[property] = false;
              break;
            case 'number':
            case 'integer':
              literal[property] = 0;
              break;
            case 'string':
              literal[property] = '';
              break;
            default:
              reporter.error(
                formatLocalize(
                  'TaskDefinition.missingRequiredProperty',
                  "Error: the task identifier '{0}' is missing the required property '{1}'. The task identifier will be ignored.",
                  JSON.stringify(external, undefined, 0),
                  property,
                ),
              );
              return undefined;
          }
        }
      }
    }
    return KeyedTaskIdentifier.create(literal);
  };

  public getJsonSchema(): IJSONSchema {
    if (this._schema === undefined) {
      const schemas: IJSONSchema[] = [];
      for (const definition of this.all()) {
        const schema: IJSONSchema = {
          type: 'object',
          additionalProperties: false,
        };
        if (definition.required.length > 0) {
          schema.required = definition.required.slice(0);
        }
        if (definition.properties !== undefined) {
          schema.properties = deepClone(definition.properties);
        } else {
          schema.properties = Object.create(null);
        }
        schema.properties!.type = {
          type: 'string',
          enum: [definition.taskType],
        };
        schemas.push(schema);
      }
      this._schema = { oneOf: schemas };
    }
    return this._schema;
  }
}
