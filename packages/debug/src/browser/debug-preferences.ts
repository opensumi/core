
import { PreferenceSchema, PreferenceProxy, PreferenceService, createPreferenceProxy, PreferenceContribution } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';

export const debugPreferencesSchema: PreferenceSchema = {
    type: 'object',
    properties: {
        'debug.trace': {
            type: 'boolean',
            default: false,
            description: 'Enable/disable tracing communications with debug adapters',
        },
        'debug.debugViewLocation': {
            enum: ['default', 'left', 'right', 'bottom'],
            default: 'default',
            description: 'Controls the location of the debug view.',
        },
        'debug.openDebug': {
            enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart', 'openOnDebugBreak'],
            default: 'openOnSessionStart',
            description: 'Controls when the debug view should open.',
        },
        'debug.internalConsoleOptions': {
            enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart'],
            default: 'openOnFirstSessionStart',
            description: 'Controls when the internal debug console should open.',
        },
    },
};

export class DebugConfiguration {
    'debug.trace': boolean;
    'debug.debugViewLocation': 'default' | 'left' | 'right' | 'bottom';
    'debug.openDebug': 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart' | 'openOnDebugBreak';
    'debug.internalConsoleOptions': 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart';
}

export const DebugPreferences = Symbol('DebugPreferences');
export type DebugPreferences = PreferenceProxy<DebugConfiguration>;

export function createDebugPreferences(preferences: PreferenceService): DebugPreferences {
    return createPreferenceProxy(preferences, debugPreferencesSchema);
}

export function injectDebugPreferences(injector: Injector): void {

  injector.addProviders({
    token: DebugPreferences,
    useFactory: (injector: Injector) => {
      const preferences = injector.get(PreferenceService);
      return createDebugPreferences(preferences);
    },
  });

  injector.addProviders({
    token: PreferenceContribution,
    useValue: { schema: debugPreferencesSchema },
  });
}
