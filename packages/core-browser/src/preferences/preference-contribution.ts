import * as Ajv from 'ajv';
import { Injectable, Autowired, Injector } from '@ali/common-di';
import { ContributionProvider, escapeRegExpCharacters, Emitter, Event } from '@ali/ide-core-common';
import { PreferenceScope } from './preference-scope';
import { PreferenceProvider, PreferenceProviderDataChange } from './preference-provider';
import {
  PreferenceSchema, PreferenceSchemaProperties, PreferenceDataSchema, PreferenceItem, PreferenceSchemaProperty, PreferenceDataProperty, JsonType,
} from '@ali/ide-core-common/lib/preferences/preference-schema';
import {
  createContributionProvider,
} from '@ali/ide-core-common';
import { ClientAppConfigProvider, ClientAppConfig } from '../application';
import { PreferenceConfigurations, injectPreferenceConfigurations } from './preference-configurations';
export { PreferenceSchema, PreferenceSchemaProperties, PreferenceDataSchema, PreferenceItem, PreferenceSchemaProperty, PreferenceDataProperty, JsonType };

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
}

export interface OverridePreferenceName {
  preferenceName: string;
  overrideIdentifier: string;
}

const OVERRIDE_PROPERTY = '\\[(.*)\\]$';
export const OVERRIDE_PROPERTY_PATTERN = new RegExp(OVERRIDE_PROPERTY);

const OVERRIDE_PATTERN_WITH_SUBSTITUTION = '\\[(${0})\\]$';

export interface FrontendApplicationPreferenceConfig extends ClientAppConfig {
  preferences: {
    [preferenceName: string]: any,
  };
}
export namespace FrontendApplicationPreferenceConfig {
  export function is(config: ClientAppConfig): config is FrontendApplicationPreferenceConfig {
    return 'preferences' in config && typeof config.preferences === 'object';
  }
}

@Injectable()
export class PreferenceSchemaProvider extends PreferenceProvider {

  protected readonly preferences: { [name: string]: any } = {};
  protected readonly combinedSchema: PreferenceDataSchema = { properties: {}, patternProperties: {} };

  @Autowired(PreferenceContribution)
  protected readonly preferenceContributions: ContributionProvider<PreferenceContribution>;
  protected validateFunction: Ajv.ValidateFunction;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  protected readonly onDidPreferenceSchemaChangedEmitter = new Emitter<void>();
  readonly onDidPreferenceSchemaChanged: Event<void> = this.onDidPreferenceSchemaChangedEmitter.event;

  protected fireDidPreferenceSchemaChanged(): void {
    this.onDidPreferenceSchemaChangedEmitter.fire(undefined);
  }

  constructor() {
    super();
    this.init();
  }

  protected init(): void {
    console.log(this.preferenceContributions.getContributions());
    this.preferenceContributions.getContributions().forEach((contrib) => {
      this.doSetSchema(contrib.schema);
    });
    this.combinedSchema.additionalProperties = false;
    this.updateValidate();
    this.onDidPreferencesChanged(() => this.updateValidate());
    this._ready.resolve();
  }

  protected readonly overrideIdentifiers = new Set<string>();
  registerOverrideIdentifier(overrideIdentifier: string): void {
    if (this.overrideIdentifiers.has(overrideIdentifier)) {
      return;
    }
    this.overrideIdentifiers.add(overrideIdentifier);
    this.updateOverridePatternPropertiesKey();
  }

  protected readonly overridePatternProperties: Required<Pick<PreferenceDataProperty, 'properties'>> & PreferenceDataProperty = {
    type: 'object',
    description: 'Configure editor settings to be overridden for a language.',
    errorMessage: 'Unknown Identifier. Use language identifiers',
    properties: {},
  };
  protected overridePatternPropertiesKey: string | undefined;
  protected updateOverridePatternPropertiesKey(): void {
    const oldKey = this.overridePatternPropertiesKey;
    const newKey = this.computeOverridePatternPropertiesKey();
    if (oldKey === newKey) {
      return;
    }
    if (oldKey) {
      delete this.combinedSchema.patternProperties[oldKey];
    }
    this.overridePatternPropertiesKey = newKey;
    if (newKey) {
      this.combinedSchema.patternProperties[newKey] = this.overridePatternProperties;
    }
    this.fireDidPreferenceSchemaChanged();
  }
  protected computeOverridePatternPropertiesKey(): string | undefined {
    let param: string = '';
    for (const overrideIdentifier of this.overrideIdentifiers.keys()) {
      if (param.length) {
        param += '|';
      }
      param += new RegExp(escapeRegExpCharacters(overrideIdentifier)).source;
    }
    return param.length ? OVERRIDE_PATTERN_WITH_SUBSTITUTION.replace('${0}', param) : undefined;
  }

  protected doSetSchema(schema: PreferenceSchema): PreferenceProviderDataChange[] {
    const scope = PreferenceScope.Default;
    const domain = this.getDomain();
    const changes: PreferenceProviderDataChange[] = [];
    const defaultScope = PreferenceSchema.getDefaultScope(schema);
    const overridable = schema.overridable || false;
    for (const preferenceName of Object.keys(schema.properties)) {
      if (this.combinedSchema.properties[preferenceName]) {
        console.error('Preference name collision detected in the schema for property: ' + preferenceName);
      } else {
        const schemaProps = PreferenceDataProperty.fromPreferenceSchemaProperty(schema.properties[preferenceName], defaultScope);
        if (typeof schemaProps.overridable !== 'boolean' && overridable) {
          schemaProps.overridable = true;
        }
        if (schemaProps.overridable) {
          this.overridePatternProperties.properties[preferenceName] = schemaProps;
        }
        this.combinedSchema.properties[preferenceName] = schemaProps;
        this.unsupportedPreferences.delete(preferenceName);

        const value = schemaProps.defaultValue = this.getDefaultValue(schemaProps, preferenceName);
        if (this.testOverrideValue(preferenceName, value)) {
          // tslint:disable-next-line:forin
          for (const overriddenPreferenceName in value) {
            const overrideValue = value[overriddenPreferenceName];
            const overridePreferenceName = `${preferenceName}.${overriddenPreferenceName}`;
            changes.push(this.doSetPreferenceValue(overridePreferenceName, overrideValue, { scope, domain }));
          }
        } else {
          changes.push(this.doSetPreferenceValue(preferenceName, value, { scope, domain }));
        }
      }
    }
    return changes;
  }
  protected doSetPreferenceValue(preferenceName: string, newValue: any, { scope, domain }: {
    scope: PreferenceScope,
    domain?: string[],
  }): PreferenceProviderDataChange {
    const oldValue = this.preferences[preferenceName];
    this.preferences[preferenceName] = newValue;
    return { preferenceName, oldValue, newValue, scope, domain };
  }

  /** @deprecated since 0.6.0 pass preferenceName as the second arg */
  protected getDefaultValue(property: PreferenceItem): any;
  // tslint:disable-next-line:unified-signatures
  protected getDefaultValue(property: PreferenceItem, preferenceName: string): any;
  protected getDefaultValue(property: PreferenceItem, preferenceName?: string): any {
    const config = ClientAppConfigProvider.get();
    if (preferenceName && FrontendApplicationPreferenceConfig.is(config) && preferenceName in config.preferences) {
      return config.preferences[preferenceName];
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
    // tslint:disable-next-line:no-null-keyword
    return null;
  }

  protected updateValidate(): void {
    const schema = {
      ...this.combinedSchema,
      properties: {
        ...this.combinedSchema.properties,
      },
    };
    for (const sectionName of this.configurations.getSectionNames()) {
      delete schema.properties[sectionName];
    }
    this.validateFunction = new Ajv().compile(schema);
  }

  protected readonly unsupportedPreferences = new Set<string>();
  validate(name: string, value: any): boolean {
    if (this.configurations.isSectionName(name)) {
      return true;
    }
    // 验证是否复合schema配置
    const result = this.validateFunction({ [name]: value }) as boolean;
    console.log(this.combinedSchema.properties);
    if (!result && !(name in this.combinedSchema.properties)) {
      // 避免每次发生变化时重复提示警告
      if (!this.unsupportedPreferences.has(name)) {
        this.unsupportedPreferences.add(name);
        console.warn(`"${name}" preference is not supported`);
      }
    }
    return result;
  }

  getCombinedSchema(): PreferenceDataSchema {
    return this.combinedSchema;
  }

  setSchema(schema: PreferenceSchema): void {
    const changes = this.doSetSchema(schema);
    this.fireDidPreferenceSchemaChanged();
    this.emitPreferencesChangedEvent(changes);
  }

  getPreferences(): { [name: string]: any } {
    return this.preferences;
  }

  async setPreference(): Promise<boolean> {
    return false;
  }

  isValidInScope(preferenceName: string, scope: PreferenceScope): boolean {
    const preference = this.getPreferenceProperty(preferenceName);
    if (preference) {
      return preference.scope! >= scope;
    }
    return false;
  }

  *getPreferenceNames(): IterableIterator<string> {
    // tslint:disable-next-line:forin
    for (const preferenceName in this.combinedSchema.properties) {
      yield preferenceName;
      for (const overridePreferenceName of this.getOverridePreferenceNames(preferenceName)) {
        yield overridePreferenceName;
      }
    }
  }

  *getOverridePreferenceNames(preferenceName: string): IterableIterator<string> {
    const preference = this.combinedSchema.properties[preferenceName];
    if (preference && preference.overridable) {
      for (const overrideIdentifier of this.overrideIdentifiers) {
        yield this.overridePreferenceName({ preferenceName, overrideIdentifier });
      }
    }
  }

  getPreferenceProperty(preferenceName: string): PreferenceItem | undefined {
    const overridden = this.overriddenPreferenceName(preferenceName);
    return this.combinedSchema.properties[overridden ? overridden.preferenceName : preferenceName];
  }

  overridePreferenceName({ preferenceName, overrideIdentifier }: OverridePreferenceName): string {
    return `[${overrideIdentifier}].${preferenceName}`;
  }
  overriddenPreferenceName(name: string): OverridePreferenceName | undefined {
    const index = name.indexOf('.');
    if (index === -1) {
      return undefined;
    }
    const matches = name.substr(0, index).match(OVERRIDE_PROPERTY_PATTERN);
    const overrideIdentifier = matches && matches[1];
    if (!overrideIdentifier || !this.overrideIdentifiers.has(overrideIdentifier)) {
      return undefined;
    }
    const preferenceName = name.substr(index + 1);
    return { preferenceName, overrideIdentifier };
  }

  testOverrideValue(name: string, value: any): value is PreferenceSchemaProperties {
    return PreferenceSchemaProperties.is(value) && OVERRIDE_PROPERTY_PATTERN.test(name);
  }
}
