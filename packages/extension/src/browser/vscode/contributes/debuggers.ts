import { Autowired, Injectable } from '@opensumi/di';
import { replaceLocalizePlaceholder } from '@opensumi/ide-core-browser';
import {
  IJSONSchema,
  IJSONSchemaMap,
  IJSONSchemaSnippet,
  LifeCyclePhase,
  localize,
  objects,
} from '@opensumi/ide-core-common';
import { IDebugService, IDebuggerContribution } from '@opensumi/ide-debug';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser/debug-configuration-manager';
import { DebugSchemaManager } from '@opensumi/ide-debug/lib/browser/debug-schema-manager';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';
import { Extension } from '../../extension';
import { AbstractExtInstanceManagementService } from '../../types';

const { deepClone } = objects;

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
@LifeCycle(LifeCyclePhase.Ready)
export class DebuggersContributionPoint extends VSCodeContributePoint<DebuggersContributionScheme[]> {
  static schema = {
    description: localize('vscode.extension.contributes.debuggers', 'Contributes debug adapters.'),
    type: 'array',
    defaultSnippets: [{ body: [{ type: '' }] }],
    items: {
      additionalProperties: false,
      type: 'object',
      defaultSnippets: [{ body: { type: '', program: '', runtime: '' } }],
      properties: {
        type: {
          description: localize(
            'vscode.extension.contributes.debuggers.type',
            'Unique identifier for this debug adapter.',
          ),
          type: 'string',
        },
        label: {
          description: localize('vscode.extension.contributes.debuggers.label', 'Display name for this debug adapter.'),
          type: 'string',
        },
        program: {
          description: localize(
            'vscode.extension.contributes.debuggers.program',
            'Path to the debug adapter program. Path is either absolute or relative to the extension folder.',
          ),
          type: 'string',
        },
        args: {
          description: localize(
            'vscode.extension.contributes.debuggers.args',
            'Optional arguments to pass to the adapter.',
          ),
          type: 'array',
        },
        runtime: {
          description: localize(
            'vscode.extension.contributes.debuggers.runtime',
            'Optional runtime in case the program attribute is not an executable but requires a runtime.',
          ),
          type: 'string',
        },
        runtimeArgs: {
          description: localize('vscode.extension.contributes.debuggers.runtimeArgs', 'Optional runtime arguments.'),
          type: 'array',
        },
        variables: {
          description: localize(
            'vscode.extension.contributes.debuggers.variables',
            'Mapping from interactive variables (e.g. ${action.pickProcess}) in `launch.json` to a command.',
          ),
          type: 'object',
        },
        initialConfigurations: {
          description: localize(
            'vscode.extension.contributes.debuggers.initialConfigurations',
            "Configurations for generating the initial 'launch.json'.",
          ),
          type: ['array', 'string'],
        },
        languages: {
          description: localize(
            'vscode.extension.contributes.debuggers.languages',
            'List of languages for which the debug extension could be considered the "default debugger".',
          ),
          type: 'array',
        },
        configurationSnippets: {
          description: localize(
            'vscode.extension.contributes.debuggers.configurationSnippets',
            "Snippets for adding new configurations in 'launch.json'.",
          ),
          type: 'array',
        },
        configurationAttributes: {
          description: localize(
            'vscode.extension.contributes.debuggers.configurationAttributes',
            "JSON schema configurations for validating 'launch.json'.",
          ),
          type: 'object',
        },
        when: {
          description: localize(
            'vscode.extension.contributes.debuggers.when',
            "Condition which must be true to enable this type of debugger. Consider using 'shellExecutionSupported', 'virtualWorkspace', 'resourceScheme' or an extension-defined context key as appropriate for this.",
          ),
          type: 'string',
          default: '',
        },
        windows: {
          description: localize('vscode.extension.contributes.debuggers.windows', 'Windows specific settings.'),
          type: 'object',
          properties: {
            runtime: {
              description: localize(
                'vscode.extension.contributes.debuggers.windows.runtime',
                'Runtime used for Windows.',
              ),
              type: 'string',
            },
          },
        },
        osx: {
          description: localize('vscode.extension.contributes.debuggers.osx', 'macOS specific settings.'),
          type: 'object',
          properties: {
            runtime: {
              description: localize('vscode.extension.contributes.debuggers.osx.runtime', 'Runtime used for macOS.'),
              type: 'string',
            },
          },
        },
        linux: {
          description: localize('vscode.extension.contributes.debuggers.linux', 'Linux specific settings.'),
          type: 'object',
          properties: {
            runtime: {
              description: localize('vscode.extension.contributes.debuggers.linux.runtime', 'Runtime used for Linux.'),
              type: 'string',
            },
          },
        },
      },
    },
  };

  @Autowired(IDebugService)
  private debugService: IDebugService;

  @Autowired(DebugConfigurationManager)
  private debugConfigurationManager: DebugConfigurationManager;

  @Autowired(DebugSchemaManager)
  protected readonly debugSchemaManager: DebugSchemaManager;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      this.debugService.registerDebugContributionPoints(
        extension.path,
        this.resolveDebuggers(contributes, extension) as IJSONSchema[],
      );
    }
    this.debugSchemaManager.update();
  }

  private resolveDebuggers(
    debuggersContributionPoints: DebuggersContributionScheme[],
    extension: Extension,
  ): IDebuggerContribution[] {
    return debuggersContributionPoints.map((debuggersContributionPoint) => {
      const debuggers = this.doResolveDebuggers(debuggersContributionPoint, extension);
      this.debugConfigurationManager.registerDebugger(debuggers);
      return debuggers;
    });
  }

  private doResolveDebuggers(
    debuggersContributionPoint: DebuggersContributionScheme,
    extension: Extension,
  ): IDebuggerContribution {
    const result: IDebuggerContribution = {
      type: debuggersContributionPoint.type,
      label: debuggersContributionPoint.label
        ? replaceLocalizePlaceholder(debuggersContributionPoint.label, extension.id)
        : '',
      languages: debuggersContributionPoint.languages,
      enableBreakpointsFor: debuggersContributionPoint.enableBreakpointsFor,
      variables: debuggersContributionPoint.variables,
      adapterExecutableCommand: debuggersContributionPoint.adapterExecutableCommand,
      configurationSnippets: (debuggersContributionPoint.configurationSnippets || []).map(
        (config: IJSONSchemaSnippet) => {
          if (config.label) {
            config.label = replaceLocalizePlaceholder(config.label, extension.id);
          }
          if (config.description) {
            config.description = replaceLocalizePlaceholder(config.description, extension.id);
          }
          if (config.markdownDescription) {
            config.markdownDescription = replaceLocalizePlaceholder(config.markdownDescription, extension.id);
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
      this.resolveSchemaAttributes(
        debuggersContributionPoint.type,
        debuggersContributionPoint.configurationAttributes,
        extension,
      );

    return result;
  }

  protected resolveSchemaAttributes(
    type: string,
    configurationAttributes: { [request: string]: IJSONSchema },
    extension: Extension,
  ): IJSONSchema[] {
    const taskSchema = {};
    const recursionPropertiesDescription = (prop: IJSONSchemaMap) => {
      Object.keys(prop).forEach((name) => {
        if (prop[name].properties) {
          recursionPropertiesDescription(prop[name].properties!);
        }
        // 避免某些不规范的 json 配置打挂整个 debug 功能，做个防御
        if (typeof prop[name] !== 'object') {
          return;
        }
        prop[name].description = replaceLocalizePlaceholder(prop[name].description, extension.id);
        prop[name].markdownDescription = replaceLocalizePlaceholder(prop[name].markdownDescription, extension.id);
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
    for (const contrib of this.contributesMap) {
      const { extensionId } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }
      this.debugService.unregisterDebugContributionPoints(extension.path);
    }
  }
}
