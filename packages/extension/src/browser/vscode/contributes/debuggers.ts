import { Injectable, Autowired } from '@opensumi/di';
import { replaceLocalizePlaceholder } from '@opensumi/ide-core-browser';
import { IJSONSchema, IJSONSchemaSnippet, deepClone, localize, IJSONSchemaMap } from '@opensumi/ide-core-common';
import { IDebugService, IDebuggerContribution } from '@opensumi/ide-debug';
import { DebugConfigurationManager, DebugSchemaUpdater } from '@opensumi/ide-debug/lib/browser';

import { VSCodeContributePoint, Contributes } from '../../../common';

const INTERNAL_CONSOLE_OPTIONS_SCHEMA = {
  enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart'],
  default: 'openOnFirstSessionStart',
  description: localize('preference.debug.internalConsoleOptions'),
};

export interface VSCodePlatformSpecificAdapterContribution {
  program?: string;
  args?: string[];
  runtime?: string;
  runtimeArgs?: string[];
}

export interface ScopeMap {
  [scopeName: string]: string;
}

export interface DebuggersContributionScheme extends VSCodePlatformSpecificAdapterContribution {
  type: string;
  label?: string;
  languages?: string[];
  enableBreakpointsFor?: {
    languageIds: string[];
  };
  configurationSnippets?: IJSONSchemaSnippet[];
  configurationAttributes?: {
    [request: string]: IJSONSchema;
  };
  variables?: ScopeMap;
  adapterExecutableCommand?: string;
  win?: VSCodePlatformSpecificAdapterContribution;
  winx86?: VSCodePlatformSpecificAdapterContribution;
  windows?: VSCodePlatformSpecificAdapterContribution;
  osx?: VSCodePlatformSpecificAdapterContribution;
  linux?: VSCodePlatformSpecificAdapterContribution;
}

@Injectable()
@Contributes('debuggers')
export class DebuggersContributionPoint extends VSCodeContributePoint<DebuggersContributionScheme[]> {
  @Autowired(IDebugService)
  private debugService: IDebugService;

  @Autowired(DebugConfigurationManager)
  private debugConfigurationManager: DebugConfigurationManager;

  @Autowired(DebugSchemaUpdater)
  protected readonly debugSchemaUpdater: DebugSchemaUpdater;

  contribute() {
    this.debugService.registerDebugContributionPoints(
      this.extension.path,
      this.resolveDebuggers(this.json) as IJSONSchema[],
    );
    this.debugSchemaUpdater.update();
  }

  private resolveDebuggers(debuggersContributionPoints: DebuggersContributionScheme[]): IDebuggerContribution[] {
    return debuggersContributionPoints.map((debuggersContributionPoint) => {
      const debuggers = this.doResolveDebuggers(debuggersContributionPoint);
      this.debugConfigurationManager.registerDebugger(debuggers);
      return debuggers;
    });
  }

  private doResolveDebuggers(debuggersContributionPoint: DebuggersContributionScheme): IDebuggerContribution {
    const result: IDebuggerContribution = {
      type: debuggersContributionPoint.type,
      label: debuggersContributionPoint.label
        ? replaceLocalizePlaceholder(debuggersContributionPoint.label, this.extension.id)
        : '',
      languages: debuggersContributionPoint.languages,
      enableBreakpointsFor: debuggersContributionPoint.enableBreakpointsFor,
      variables: debuggersContributionPoint.variables,
      adapterExecutableCommand: debuggersContributionPoint.adapterExecutableCommand,
      configurationSnippets: (debuggersContributionPoint.configurationSnippets || []).map(
        (config: IJSONSchemaSnippet) => {
          if (config.label) {
            config.label = replaceLocalizePlaceholder(config.label, this.extension.id);
          }
          if (config.description) {
            config.description = replaceLocalizePlaceholder(config.description, this.extension.id);
          }
          return config;
        },
      ),
      win: debuggersContributionPoint.win,
      winx86: debuggersContributionPoint.winx86,
      windows: debuggersContributionPoint.windows,
      osx: debuggersContributionPoint.osx,
      linux: debuggersContributionPoint.linux,
      program: debuggersContributionPoint.program,
      args: debuggersContributionPoint.args,
      runtime: debuggersContributionPoint.runtime,
      runtimeArgs: debuggersContributionPoint.runtimeArgs,
    };

    result.configurationAttributes =
      debuggersContributionPoint.configurationAttributes &&
      this.resolveSchemaAttributes(debuggersContributionPoint.type, debuggersContributionPoint.configurationAttributes);

    return result;
  }

  protected resolveSchemaAttributes(
    type: string,
    configurationAttributes: { [request: string]: IJSONSchema },
  ): IJSONSchema[] {
    const taskSchema = {};
    const recursionPropertiesDescription = (prop: IJSONSchemaMap) => {
      Object.keys(prop).forEach((name) => {
        if (prop[name].properties) {
          recursionPropertiesDescription(prop[name].properties!);
        }
        prop[name].description = replaceLocalizePlaceholder(prop[name].description, this.extension.id);
      });
    };

    return Object.keys(configurationAttributes).map((request) => {
      const attributes: IJSONSchema = deepClone(configurationAttributes[request]);
      const defaultRequired = ['name', 'type', 'request'];
      attributes.required =
        attributes.required && attributes.required.length
          ? defaultRequired.concat(attributes.required)
          : defaultRequired;
      attributes.additionalProperties = false;
      attributes.type = 'object';
      if (!attributes.properties) {
        attributes.properties = {};
      }
      const properties = attributes.properties;
      properties.type = {
        enum: [type],
        description: localize('debug.launch.configurations.debugType'),
        pattern: '^(?!node2)',
        errorMessage: localize('debug.launch.configurations.debugTypeNotRecognised'),
        patternErrorMessage: localize('debug.launch.configurations.node2NotSupported'),
      };
      properties.name = {
        type: 'string',
        description: localize('debug.launch.configurations.debugName'),
        default: 'Launch',
      };
      properties.request = {
        enum: [request],
        description: localize('debug.launch.configurations.debugRequest'),
      };
      properties.debugServer = {
        type: 'number',
        description: localize('debug.launch.configurations.debugServer'),
        default: 4711,
      };
      properties.preLaunchTask = {
        anyOf: [
          taskSchema,
          {
            type: ['string', 'null'],
          },
        ],
        default: '',
        description: localize('debug.launch.configurations.debugPrelaunchTask'),
      };
      properties.postDebugTask = {
        anyOf: [
          taskSchema,
          {
            type: ['string', 'null'],
          },
        ],
        default: '',
        description: localize('debug.launch.configurations.debugPostDebugTask'),
      };
      properties.internalConsoleOptions = INTERNAL_CONSOLE_OPTIONS_SCHEMA;

      const osProperties = Object.assign({}, properties);
      properties.windows = {
        type: 'object',
        description: localize('debug.launch.configurations.debugWindowsConfiguration'),
        properties: osProperties,
      };
      properties.osx = {
        type: 'object',
        description: localize('debug.launch.configurations.debugOSXConfiguration'),
        properties: osProperties,
      };
      properties.linux = {
        type: 'object',
        description: localize('debug.launch.configurations.debugLinuxConfiguration'),
        properties: osProperties,
      };
      Object.keys(attributes.properties).forEach((name) => {
        // 为每一个属性创建独立的错误信息
        attributes!.properties![name].pattern =
          attributes!.properties![name].pattern || '^(?!.*\\$\\{(env|config|command)\\.)';
        attributes!.properties![name].patternErrorMessage =
          attributes!.properties![name].patternErrorMessage ||
          localize(
            'deprecatedVariables',
            "'env.', 'config.' and 'command.' are deprecated, use 'env:', 'config:' and 'command:' instead.",
          );
      });

      recursionPropertiesDescription(attributes.properties);

      return attributes;
    });
  }

  dispose() {
    this.debugService.unregisterDebugContributionPoints(this.extension.path);
  }
}
