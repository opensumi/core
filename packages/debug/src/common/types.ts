import { IJSONSchemaSnippet } from '@ali/ide-core-common';

export interface IPlatformSpecificAdapterContribution {
  program?: string;
  args?: string[];
  runtime?: string;
  runtimeArgs?: string[];
}

export interface IDebuggerContribution extends IPlatformSpecificAdapterContribution {
  type: string;
  label?: string;
  // debug adapter executable
  adapterExecutableCommand?: string;
  win?: IPlatformSpecificAdapterContribution;
  winx86?: IPlatformSpecificAdapterContribution;
  windows?: IPlatformSpecificAdapterContribution;
  osx?: IPlatformSpecificAdapterContribution;
  linux?: IPlatformSpecificAdapterContribution;

  // internal
  aiKey?: string;

  // supported languages
  languages?: string[];
  enableBreakpointsFor?: { languageIds: string[] };

  // debug configuration support
  configurationAttributes?: any;
  initialConfigurations?: any[];
  configurationSnippets?: IJSONSchemaSnippet[];
  variables?: { [key: string]: string };
}
