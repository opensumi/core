import { PreferenceScope } from './preference-scope';

export interface PreferenceSchema {
    [name: string]: any,
    scope?: 'application' | 'window' | 'resource' | PreferenceScope,
    overridable?: boolean;
    properties: PreferenceSchemaProperties
}
export namespace PreferenceSchema {
    export function is(obj: Object | undefined): obj is PreferenceSchema {
        return !!obj && ('properties' in obj) && PreferenceSchemaProperties.is((<any>obj)['properties']);
    }
    export function getDefaultScope(schema: PreferenceSchema): PreferenceScope {
        let defaultScope: PreferenceScope = PreferenceScope.Workspace;
        if (!PreferenceScope.is(schema.scope)) {
            defaultScope = PreferenceScope.fromString(<string>schema.scope) || PreferenceScope.Workspace;
        } else {
            defaultScope = schema.scope;
        }
        return defaultScope;
    }
}

export interface PreferenceSchemaProperties {
    [name: string]: PreferenceSchemaProperty
}
export namespace PreferenceSchemaProperties {
    export function is(obj: Object | undefined): obj is PreferenceSchemaProperties {
        return !!obj && typeof obj === 'object';
    }
}

export interface PreferenceDataSchema {
    [name: string]: any,
    scope?: PreferenceScope,
    properties: {
        [name: string]: PreferenceDataProperty
    }
    patternProperties: {
        [name: string]: PreferenceDataProperty
    };
}

export interface PreferenceItem {
    type?: JsonType | JsonType[];
    minimum?: number;
    /**
     * content assist (UI) default value
     */
    default?: any;
    /**
     * preference default value, if `undefined` then `default`
     */
    defaultValue?: any;
    enum?: Array<string | number>;
    items?: PreferenceItem;
    properties?: { [name: string]: PreferenceItem };
    additionalProperties?: object;
    [name: string]: any;
    overridable?: boolean;
}

export interface PreferenceSchemaProperty extends PreferenceItem {
    description?: string;
    scope?: 'application' | 'window' | 'resource' | PreferenceScope;
}

export interface PreferenceDataProperty extends PreferenceItem {
    description?: string;
    scope?: PreferenceScope;
}
export namespace PreferenceDataProperty {
    export function fromPreferenceSchemaProperty(schemaProps: PreferenceSchemaProperty, defaultScope: PreferenceScope = PreferenceScope.Workspace): PreferenceDataProperty {
        if (!schemaProps.scope) {
            schemaProps.scope = defaultScope;
        } else if (typeof schemaProps.scope === 'string') {
            return Object.assign(schemaProps, { scope: PreferenceScope.fromString(schemaProps.scope) || defaultScope });
        }
        return <PreferenceDataProperty>schemaProps;
    }
}

export type JsonType = 'string' | 'array' | 'number' | 'integer' | 'object' | 'boolean' | 'null' | 'string[]';
