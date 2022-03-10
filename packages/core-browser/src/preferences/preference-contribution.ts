import Ajv from 'ajv';

import { Injectable, Autowired, Injector } from '@opensumi/di';
import {
  Mutable,
  ContributionProvider,
  Emitter,
  Event,
  ILogger,
  Disposable,
  IDisposable,
} from '@opensumi/ide-core-common';
import {
  PreferenceSchema,
  PreferenceSchemaProperties,
  PreferenceDataSchema,
  PreferenceItem,
  PreferenceSchemaProperty,
  PreferenceDataProperty,
  JsonType,
} from '@opensumi/ide-core-common/lib/preferences/preference-schema';

import { AppConfig } from '../react-providers';

import { PreferenceConfigurations, injectPreferenceConfigurations } from './preference-configurations';
import { PreferenceProvider, PreferenceProviderDataChange, IResolvedPreferences } from './preference-provider';
import { PreferenceScope } from './preference-scope';

export {
  PreferenceSchema,
  PreferenceSchemaProperties,
  PreferenceDataSchema,
  PreferenceItem,
  PreferenceSchemaProperty,
  PreferenceDataProperty,
  JsonType,
};

export const PreferenceContribution = Symbol('PreferenceContribution');
export interface PreferenceContribution {
  readonly schema: PreferenceSchema;
}

export function injectPreferenceSchemaProvider(injector: Injector): void {
  injectPreferenceConfigurations(injector);
  injector.addProviders({
    token: PreferenceSchemaProvider,
    useClass: PreferenceSchemaProvider,
  });
  injector.addProviders({
    token: PreferenceProvider,
    tag: PreferenceScope.Default,
    useClass: DefaultPreferenceProvider,
  });
}

export interface OverridePreferenceName {
  preferenceName: string;
  overrideIdentifier: string;
}

export namespace OverridePreferenceName {
  export function is(arg: any): arg is OverridePreferenceName {
    return !!arg && typeof arg === 'object' && 'preferenceName' in arg && 'overrideIdentifier' in arg;
  }
}

const OVERRIDE_PROPERTY = '\\[(.*)\\]$';
export const OVERRIDE_PROPERTY_PATTERN = new RegExp(OVERRIDE_PROPERTY);

@Injectable()
export class PreferenceSchemaProvider extends PreferenceProvider {
  @Autowired(PreferenceContribution)
  protected readonly preferenceContributions: ContributionProvider<PreferenceContribution>;
  private _validateFunction: Ajv.ValidateFunction | undefined;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  protected preferences: { [name: string]: any } = {};
  protected combinedSchema: PreferenceDataSchema = { properties: {}, patternProperties: {} };
  protected readonly onDidPreferenceSchemaChangedEmitter = new Emitter<void>();
  public readonly onDidPreferenceSchemaChanged: Event<void> = this.onDidPreferenceSchemaChangedEmitter.event;

  private validationFunctions = new Map<string, Ajv.ValidateFunction>();

  protected fireDidPreferenceSchemaChanged(): void {
    this.onDidPreferenceSchemaChangedEmitter.fire(undefined);
  }

  protected get validateFunction(): Ajv.ValidateFunction {
    if (!this._validateFunction) {
      this.doUpdateValidate();
    }
    return this._validateFunction!;
  }

  constructor() {
    super();
    this.init();

    this.toDispose.push(
      Disposable.create(() => {
        this.preferences = {};
        this.validationFunctions.clear();
        this.combinedSchema = { properties: {}, patternProperties: {} };
      }),
    );

    this.toDispose.push(this.onDidPreferenceSchemaChangedEmitter);
  }

  protected init(): void {
    this.preferenceContributions?.getContributions().forEach((contrib) => {
      this.doSetSchema(contrib.schema);
    });
    this.combinedSchema.additionalProperties = false;
    this.updateValidate();
    this.onDidPreferencesChanged(() => this.updateValidate());
    this._ready.resolve();
  }

  protected doUnsetSchema(changes: PreferenceProviderDataChange[]): PreferenceProviderDataChange[] {
    const inverseChanges: PreferenceProviderDataChange[] = [];
    for (const change of changes) {
      const preferenceName = change.preferenceName;
      const newValue = change.oldValue;
      const oldValue = change.newValue;
      const { scope, domain } = change;
      const inverseChange: Mutable<PreferenceProviderDataChange> = { preferenceName, oldValue, scope, domain };

      delete this.combinedSchema.properties[preferenceName];

      if (typeof newValue === undefined) {
        delete this.preferences[preferenceName];
      } else {
        inverseChange.newValue = newValue;
        this.preferences[preferenceName] = newValue;
      }
      inverseChanges.push(inverseChange);
    }
    return inverseChanges;
  }

  protected doSetSchema(schema: PreferenceSchema, override?: boolean): PreferenceProviderDataChange[] {
    const scope = PreferenceScope.Default;
    const domain = this.getDomain();
    const changes: PreferenceProviderDataChange[] = [];
    const defaultScope = PreferenceSchema.getDefaultScope(schema);
    const overridable = schema.overridable || false;
    for (const preferenceName of Object.keys(schema.properties)) {
      if (this.combinedSchema.properties[preferenceName] && !override) {
        this.logger.error('Preference name collision detected in the schema for property: ' + preferenceName);
        continue;
      } else {
        const schemaProps = PreferenceDataProperty.fromPreferenceSchemaProperty(
          schema.properties[preferenceName],
          defaultScope,
        );
        if (typeof schemaProps.overridable !== 'boolean' && overridable) {
          schemaProps.overridable = true;
        }
        this.combinedSchema.properties[preferenceName] = schemaProps;
        this.unsupportedPreferences.delete(preferenceName);

        const value = (schemaProps.defaultValue = this.getDefaultValue(schemaProps, preferenceName));
        changes.push(this.doSetPreferenceValue(preferenceName, value, { scope, domain }));
      }
    }
    return changes;
  }

  protected doSetPreferenceValue(
    preferenceName: string,
    newValue: any,
    {
      scope,
      domain,
    }: {
      scope: PreferenceScope;
      domain?: string[];
    },
  ): PreferenceProviderDataChange {
    const oldValue = this.preferences[preferenceName];
    this.preferences[preferenceName] = newValue;
    return { preferenceName, oldValue, newValue, scope, domain };
  }

  protected getDefaultValue(property: PreferenceItem): any;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  protected getDefaultValue(property: PreferenceItem, preferenceName: string): any;
  protected getDefaultValue(property: PreferenceItem, preferenceName?: string): any {
    if (preferenceName && this.appConfig.defaultPreferences && preferenceName in this.appConfig.defaultPreferences) {
      return this.appConfig.defaultPreferences[preferenceName];
    }
    if (property.defaultValue !== undefined) {
      return property.defaultValue;
    }
    if (property.default !== undefined) {
      return property.default;
    }
    const type = Array.isArray(property.type) ? property.type[0] : property.type;
    switch (type) {
      case 'boolean':
        return false;
      case 'integer':
      case 'number':
        return 0;
      case 'string':
        return '';
      case 'array':
        return [];
      case 'object':
        return {};
    }
    return null;
  }

  protected updateValidate(): void {
    this._validateFunction = undefined;
  }

  private doUpdateValidate(): void {
    const schema = {
      ...this.combinedSchema,
      properties: {
        ...this.combinedSchema.properties,
      },
    };
    for (const sectionName of this.configurations.getSectionNames()) {
      delete schema.properties[sectionName];
    }
    this._validateFunction = new Ajv().compile(schema);
  }

  protected readonly unsupportedPreferences = new Set<string>();

  public validate(name: string, value: any): { valid: boolean; reason?: string } {
    if (this.configurations.isSectionName(name)) {
      return { valid: true };
    }
    // 对于不存在的先过
    if (!this.getPreferenceProperty(name)) {
      return { valid: true };
    }
    if (!this.validationFunctions.has(name)) {
      this.validationFunctions.set(name, new Ajv().compile(this.getPreferenceProperty(name)!));
    }
    // 验证是否合并schema配置
    const validationFn = this.validationFunctions.get(name)!;
    const result = validationFn(value) as boolean;
    if (!result && !(name in this.combinedSchema.properties)) {
      // 避免每次发生变化时重复提示警告
      if (!this.unsupportedPreferences.has(name)) {
        this.unsupportedPreferences.add(name);
        this.logger.warn(`"${name}" preference is not supported`);
      }
    }
    const errorReason =
      validationFn.errors && validationFn.errors[0] ? normalizeAjvValidationError(validationFn.errors[0]) : undefined;
    return { valid: result, reason: errorReason };
  }

  public getCombinedSchema(): PreferenceDataSchema {
    return this.combinedSchema;
  }

  public setSchema(schema: PreferenceSchema, override?: boolean): IDisposable {
    const changes = this.doSetSchema(schema, override);

    if (!changes.length) {
      return Disposable.NULL;
    }

    this.fireDidPreferenceSchemaChanged();
    this.emitPreferencesChangedEvent(changes);

    return Disposable.create(() => {
      const inverseChanges = this.doUnsetSchema(changes);
      if (!inverseChanges.length) {
        return;
      }
      this.fireDidPreferenceSchemaChanged();
      this.emitPreferencesChangedEvent(inverseChanges);
    });
  }

  public getPreferences(): { [name: string]: any } {
    return this.preferences;
  }

  getLanguagePreferences(resourceUri?: string) {
    return {};
  }

  public async doSetPreference(): Promise<boolean> {
    return false;
  }

  public isValidInScope(preferenceName: string, scope: PreferenceScope): boolean {
    const preference = this.getPreferenceProperty(preferenceName);
    if (preference) {
      return preference.scope! >= scope;
    }
    return false;
  }

  public *getPreferenceNames(): IterableIterator<string> {
    // eslint-disable-next-line guard-for-in
    for (const preferenceName in this.combinedSchema.properties) {
      yield preferenceName;
    }
  }

  public getPreferenceProperty(preferenceName: string): PreferenceItem | undefined {
    return this.combinedSchema.properties[preferenceName];
  }
}

@Injectable()
export class DefaultPreferenceProvider extends PreferenceProvider {
  @Autowired(PreferenceSchemaProvider)
  public preferenceSchemaProvider: PreferenceSchemaProvider;

  private preferences: IResolvedPreferences = {
    default: {},
    languageSpecific: {},
  };

  constructor() {
    super();
    this.init();
  }

  protected async init() {
    this._ready.resolve();
  }

  public getPreferences(resourceUri?: string, language?: string) {
    if (!language) {
      return {
        ...this.preferenceSchemaProvider.getPreferences(),
        ...this.preferences.default,
      };
    } else {
      return this.preferences.languageSpecific[language] || {};
    }
  }

  getLanguagePreferences(resourceUri?: string) {
    return this.preferences.languageSpecific;
  }

  public async doSetPreference(key: string, value: any, resourceUri?: string, language?: string) {
    if (!language) {
      const oldValue = this.preferences.default[key];
      this.preferences.default[key] = value;
      this.handlePreferenceChanges(key, value, oldValue);
    } else {
      if (!this.preferences.languageSpecific[language]) {
        this.preferences.languageSpecific[language] = {};
      }
      const oldValue = this.preferences.languageSpecific[language][key];
      this.preferences.languageSpecific[language][key] = value;
      this.handlePreferenceChanges(key, value, oldValue, language);
    }
    return true;
  }

  public handlePreferenceChanges(preferenceName: string, newValue: any, oldValue: any, language?: string) {
    const prefChange: PreferenceProviderDataChange = {
      preferenceName,
      newValue,
      oldValue,
      scope: PreferenceScope.Default,
      domain: undefined,
    };
    if (language) {
      this.emitPreferencesChangedEvent({
        default: {},
        languageSpecific: {
          [language]: {
            [preferenceName]: prefChange,
          },
        },
      });
    } else {
      this.emitPreferencesChangedEvent([prefChange]);
    }
  }
}

function normalizeAjvValidationError(error: Ajv.ErrorObject) {
  return error.message;
}
