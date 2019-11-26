import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { replaceLocalizePlaceholder } from '@ali/ide-core-browser';
import { IJSONSchema, IJSONSchemaSnippet, deepClone, localize } from '@ali/ide-core-common';
import { IDebugService, IDebuggerContribution } from '@ali/ide-debug';
import { DebugConfigurationManager, DebugSchemaUpdater } from '@ali/ide-debug/lib/browser';

const INTERNAL_CONSOLE_OPTIONS_SCHEMA = {
  enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart'],
  default: 'openOnFirstSessionStart',
  description: localize('internalConsoleOptions', 'Controls when the internal debug console should open.'),
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
    languageIds: string[],
  };
  configurationSnippets?: IJSONSchemaSnippet[];
  configurationAttributes?: {
    [request: string]: IJSONSchema,
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
    this.debugService.registerDebugContributionPoints(this.extension.path, this.resolveDebuggers(this.json) as IJSONSchema[]);
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
      label: debuggersContributionPoint.label ? replaceLocalizePlaceholder(debuggersContributionPoint.label, this.extension.id) : '',
      languages: debuggersContributionPoint.languages,
      enableBreakpointsFor: debuggersContributionPoint.enableBreakpointsFor,
      variables: debuggersContributionPoint.variables,
      adapterExecutableCommand: debuggersContributionPoint.adapterExecutableCommand,
      configurationSnippets: debuggersContributionPoint.configurationSnippets,
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

    result.configurationAttributes = debuggersContributionPoint.configurationAttributes && this.resolveSchemaAttributes(debuggersContributionPoint.type, debuggersContributionPoint.configurationAttributes);

    return result;
  }

  protected resolveSchemaAttributes(type: string, configurationAttributes: { [request: string]: IJSONSchema }): IJSONSchema[] {
    const taskSchema = {};
    return Object.keys(configurationAttributes).map((request) => {
      const attributes: IJSONSchema = deepClone(configurationAttributes[request]);
      const defaultRequired = ['name', 'type', 'request'];
      attributes.required = attributes.required && attributes.required.length ? defaultRequired.concat(attributes.required) : defaultRequired;
      attributes.additionalProperties = false;
      attributes.type = 'object';
      if (!attributes.properties) {
        attributes.properties = {};
      }
      const properties = attributes.properties;
      properties.type = {
        enum: [type],
        description: localize('debugType', 'Type of configuration.'),
        pattern: '^(?!node2)',
        errorMessage: localize('debugTypeNotRecognised',
          'The debug type is not recognized. Make sure that you have a corresponding debug extension installed and that it is enabled.'),
        patternErrorMessage: localize('node2NotSupported',
          '"node2" is no longer supported, use "node" instead and set the "protocol" attribute to "inspector".'),
      };
      properties.name = {
        type: 'string',
        description: localize('debugName', 'Name of configuration; appears in the launch configuration drop down menu.'),
        default: 'Launch',
      };
      properties.request = {
        enum: [request],
        description: localize('debugRequest', 'Request type of configuration. Can be "launch" or "attach".'),
      };
      properties.debugServer = {
        type: 'number',
        description: localize('debugServer',
          'For debug extension development only: if a port is specified VS Code tries to connect to a debug adapter running in server mode'),
        default: 4711,
      };
      properties.preLaunchTask = {
        anyOf: [taskSchema, {
          type: ['string', 'null'],
        }],
        default: '',
        description: localize('debugPrelaunchTask', 'Task to run before debug session starts.'),
      };
      properties.postDebugTask = {
        anyOf: [taskSchema, {
          type: ['string', 'null'],
        }],
        default: '',
        description: localize('debugPostDebugTask', 'Task to run after debug session ends.'),
      };
      properties.internalConsoleOptions = INTERNAL_CONSOLE_OPTIONS_SCHEMA;

      const osProperties = Object.assign({}, properties);
      properties.windows = {
        type: 'object',
        description: localize('debugWindowsConfiguration', 'Windows specific launch configuration attributes.'),
        properties: osProperties,
      };
      properties.osx = {
        type: 'object',
        description: localize('debugOSXConfiguration', 'OS X specific launch configuration attributes.'),
        properties: osProperties,
      };
      properties.linux = {
        type: 'object',
        description: localize('debugLinuxConfiguration', 'Linux specific launch configuration attributes.'),
        properties: osProperties,
      };
      Object.keys(attributes.properties).forEach((name) => {
        // 为每一个属性创建独立的错误信息
        attributes!.properties![name].pattern = attributes!.properties![name].pattern || '^(?!.*\\$\\{(env|config|command)\\.)';
        attributes!.properties![name].patternErrorMessage = attributes!.properties![name].patternErrorMessage ||
          localize('deprecatedVariables', "'env.', 'config.' and 'command.' are deprecated, use 'env:', 'config:' and 'command:' instead.");
      });

      return attributes;
    });
  }
}
