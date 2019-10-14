import { ISchemaStore, JsonSchemaConfiguration } from '../common';
import debounce = require('lodash.debounce');
import { IDisposable, Disposable } from '@ali/ide-core-common/lib/disposable';
import { Emitter, Event, ISchemaRegistry, ISchemaContributions } from '@ali/ide-core-browser';
import { Injectable } from '@ali/common-di';
import { IJSONSchema } from '../../../core-browser/src/monaco/jsonSchema';

@Injectable()
export class SchemaStore implements ISchemaStore {
  private _schemas: JsonSchemaConfiguration[] = [];

  protected readonly onSchemasChangedEmitter = new Emitter<void>();
  readonly onSchemasChanged = this.onSchemasChangedEmitter.event;

  protected notifyChanged = debounce(() => {
    this.onSchemasChangedEmitter.fire(undefined);
  }, 500) as any;

  register(config: JsonSchemaConfiguration): IDisposable {
    this._schemas.push(config);
    this.notifyChanged();
    return Disposable.create(() => {
      const idx = this._schemas.indexOf(config);
      if (idx > -1) {
        this._schemas.splice(idx, 1);
        this.notifyChanged();
      }
    });
  }

  getConfigurations(): JsonSchemaConfiguration[] {
    return [...this._schemas];
  }
}

function normalizeId(id: string) {
  if (id.length > 0 && id.charAt(id.length - 1) === '#') {
    return id.substring(0, id.length - 1);
  }
  return id;
}

@Injectable()
export class SchemaRegistry implements ISchemaRegistry {

  private schemasById: { [id: string]: IJSONSchema };

  private readonly _onDidChangeSchema = new Emitter<string>();
  readonly onDidChangeSchema: Event<string> = this._onDidChangeSchema.event;

  constructor() {
    this.schemasById = {};
  }

  public registerSchema(uri: string, unresolvedSchemaContent: IJSONSchema): void {
    this.schemasById[normalizeId(uri)] = unresolvedSchemaContent;
    this._onDidChangeSchema.fire(uri);
  }

  public notifySchemaChanged(uri: string): void {
    this._onDidChangeSchema.fire(uri);
  }

  public getSchemaContributions(): ISchemaContributions {
    return {
      schemas: this.schemasById,
    };
  }

}
