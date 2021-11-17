
import { PreferenceSchema, PreferenceProxy, PreferenceService, createPreferenceProxy, PreferenceContribution, localize } from '@ide-framework/ide-core-browser';
import { Injector } from '@ide-framework/common-di';

export const debugPreferencesSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'debug.trace': {
      type: 'boolean',
      default: false,
      description: localize('preference.debug.trace'),
    },
    'debug.debugViewLocation': {
      enum: ['default', 'left', 'right', 'bottom'],
      default: 'default',
      description: localize('preference.debug.debugViewLocation'),
    },
    'debug.openDebug': {
      enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart', 'openOnDebugBreak'],
      default: 'openOnSessionStart',
      description: localize('preference.debug.openDebug'),
    },
    'debug.internalConsoleOptions': {
      enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart'],
      default: 'openOnFirstSessionStart',
      description: localize('preference.debug.internalConsoleOptions'),
    },
    'debug.allowBreakpointsEverywhere': {
      type: 'boolean',
      description: localize('preference.debug.allowBreakpointsEverywhere'),
      default: false,
    },
  },
};

export class IDebugConfiguration {
  'debug.trace': boolean;
  'debug.debugViewLocation': 'default' | 'left' | 'right' | 'bottom';
  'debug.openDebug': 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart' | 'openOnDebugBreak';
  'debug.internalConsoleOptions': 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart';
  'debug.allowBreakpointsEverywhere': boolean;
}

export const DebugPreferences = Symbol('DebugPreferences');
export type DebugPreferences = PreferenceProxy<IDebugConfiguration>;

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
