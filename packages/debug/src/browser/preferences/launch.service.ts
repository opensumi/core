import { IChangeEvent } from '@rjsf/core';
import { GenericObjectType, StrictRJSFSchema } from '@rjsf/utils';
import * as jsoncparser from 'jsonc-parser';
import lodashSet from 'lodash/set';

import { Autowired, Injectable } from '@opensumi/di';
import { COMMON_COMMANDS } from '@opensumi/ide-core-browser';
import { CommandService, Emitter, Event, FileType, IJSONSchema, URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { JSON_SCHEMA_TYPE } from '../../common';
import { ILaunchService } from '../../common/debug-service';

type TFormData = { [key in string]: any };
const CONFIGURATIONS_FIELD = 'configurations';

@Injectable()
export class LaunchService implements ILaunchService {
  @Autowired(IFileServiceClient)
  private readonly fileSystem: IFileServiceClient;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private readonly _onRawSchemaProperties = new Emitter<IJSONSchema>();
  public readonly onRawSchemaProperties: Event<IJSONSchema> = this._onRawSchemaProperties.event;

  private readonly _onChangeSchema = new Emitter<StrictRJSFSchema>();
  public readonly onChangeSchema: Event<StrictRJSFSchema> = this._onChangeSchema.event;

  private readonly _onChangeFormData = new Emitter<TFormData>();
  public readonly onChangeFormData: Event<TFormData> = this._onChangeFormData.event;

  private _rawSchemaProperties: IJSONSchema;
  private _schema: StrictRJSFSchema;
  private _formData: TFormData;

  public get rawSchemaProperties(): IJSONSchema {
    return this._rawSchemaProperties;
  }
  public get schema(): StrictRJSFSchema {
    return this._schema;
  }
  public get formData(): TFormData {
    return this._formData;
  }

  public async openLaunchConfiguration(): Promise<void> {
    await this.commandService.executeCommand(COMMON_COMMANDS.OPEN_LAUNCH_CONFIGURATION.id);
  }

  public setRawSchemaProperties(sp: IJSONSchema) {
    this._rawSchemaProperties = sp;
    this._onRawSchemaProperties.fire(sp);
  }

  public nextNewSchema(data: StrictRJSFSchema): void {
    this._schema = data;
    this._onChangeSchema.fire(data);
  }

  public nextNewFormData(data: TFormData, isEmit = true): void {
    this._formData = data;
    if (isEmit) {
      this._onChangeFormData.fire(data);
    }
  }

  public addNewItem(name: string): void {
    if (name === '') {
      return;
    }

    const { properties } = this.rawSchemaProperties;
    const newFormData = { ...this.formData };

    const preSchemaValue = properties![name];

    const { default: defaultValue, type } = preSchemaValue;

    lodashSet(newFormData as GenericObjectType, name, defaultValue || this.getDefaultValue(type));
    lodashSet(this.schema.properties!, name, preSchemaValue);

    this.nextNewSchema(this.schema);
    this.nextNewFormData(newFormData);
  }

  public delItem(name: string): void {
    if (name === '') {
      return;
    }

    const { properties } = this.schema;
    const newFormData = { ...this.formData };

    delete newFormData[name];
    delete properties![name];

    this.nextNewSchema(this.schema);
    this.nextNewFormData(newFormData);
  }

  private getDefaultValue(type: IJSONSchema['type']): any {
    switch (type) {
      case JSON_SCHEMA_TYPE.ARRAY:
        return [];
      case JSON_SCHEMA_TYPE.BOOLEAN:
        return false;
      case JSON_SCHEMA_TYPE.NULL:
        return null;
      case JSON_SCHEMA_TYPE.NUMBER:
        return 0;
      case JSON_SCHEMA_TYPE.OBJECT:
        return {};
      case JSON_SCHEMA_TYPE.STRING:
      default:
        return '';
    }
  }

  private async readResourceContent(resource: URI): Promise<string> {
    try {
      const { content } = await this.fileSystem.readFile(resource.toString());
      return content.toString();
    } catch (error) {
      return '';
    }
  }

  public async modifyConfigurationsInResource(resource: URI, data: IChangeEvent, index: number): Promise<void> {
    const stat = await this.fileSystem.getFileStat(resource.toString());

    if (stat && stat.type === FileType.File) {
      const { formData } = data;

      const fileContent = await this.readResourceContent(resource);

      const parseContent = jsoncparser.parse(fileContent);
      const preConfigurations = parseContent[CONFIGURATIONS_FIELD];

      if (!preConfigurations) {
        return;
      }

      if (Array.isArray(preConfigurations) && preConfigurations.length - 1 >= index) {
        preConfigurations.splice(index, 1, formData);
      }

      const edits = jsoncparser.modify(fileContent, [CONFIGURATIONS_FIELD], preConfigurations, {
        isArrayInsertion: false,
        formattingOptions: {
          tabSize: 2,
          insertSpaces: true,
          eol: '\n',
        },
      });

      const newContent = jsoncparser.applyEdits(fileContent, edits);
      await this.fileSystem.setContent(stat, newContent);
    }
  }
}
