import debounce = require('lodash.debounce');

import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, Event, IJSONSchemaRegistry, ISchemaContributions, IJSONSchema } from '@opensumi/ide-core-browser';
import { IDisposable, Disposable } from '@opensumi/ide-core-common/lib/disposable';

import { ISchemaStore, JsonSchemaConfiguration } from '../common';

@Injectable()
export class SchemaStore implements ISchemaStore {
  private _schemas: JsonSchemaConfiguration[] = [];

  protected readonly onSchemasChangedEmitter = new Emitter<void>();
  readonly onSchemasChanged = this.onSchemasChangedEmitter.event;

  protected notifyChanged = debounce(() => {
    this.onSchemasChangedEmitter.fire(undefined);
  }, 500) as any;

  register(config: JsonSchemaConfiguration): IDisposable {
    // NOTE 不同的文件请绑定到不同的schema uri
    const existIndex = this._schemas.findIndex((item) => item.url === config.url);
    if (existIndex > -1) {
      return Disposable.create(() => {
        this._schemas.splice(existIndex, 1);
        this.notifyChanged();
      });
    }
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
export class SchemaRegistry implements IJSONSchemaRegistry {
  @Autowired(ISchemaStore)
  schemaStore: ISchemaStore;

  private schemasById: { [id: string]: IJSONSchema };

  private readonly _onDidChangeSchema = new Emitter<string>();
  readonly onDidChangeSchema: Event<string> = this._onDidChangeSchema.event;

  constructor() {
    this.schemasById = {};
  }

  public registerSchema(uri: string, unresolvedSchemaContent: IJSONSchema, fileMatch: string[]): IDisposable {
    this.schemasById[normalizeId(uri)] = unresolvedSchemaContent;
    const disposable = this.schemaStore.register({
      fileMatch,
      url: uri,
    });
    this._onDidChangeSchema.fire(uri);
    return disposable;
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
