import { UriComponents } from './uri';
import { IJSONSchema, IJSONSchemaSnippet } from '@ali/ide-core-common';

export interface Range {
  /**
   * Line number on which the range starts (starts at 1).
   */
  readonly startLineNumber: number;
  /**
   * Column on which the range starts in line `startLineNumber` (starts at 1).
   */
  readonly startColumn: number;
  /**
   * Line number on which the range ends.
   */
  readonly endLineNumber: number;
  /**
   * Column on which the range ends in line `endLineNumber`.
   */
  readonly endColumn: number;
}

export interface Location {
  uri: UriComponents;
  range: Range;
}

export interface Breakpoint {
  readonly id: string;
  readonly enabled: boolean;
  readonly condition?: string;
  readonly hitCondition?: string;
  readonly logMessage?: string;
  readonly location?: Location;
  readonly functionName?: string;
}

/**
 * An event describing the changes to the set of [breakpoints](#Breakpoint).
 */
export interface BreakpointsChangeEvent {
  /**
   * Added breakpoints.
   */
  readonly added: ReadonlyArray<Breakpoint>;

  /**
   * Removed breakpoints.
   */
  readonly removed: ReadonlyArray<Breakpoint>;

  /**
   * Changed breakpoints.
   */
  readonly changed: ReadonlyArray<Breakpoint>;
}

export interface ScopeMap {
  [scopeName: string]: string;
}

export interface PlatformSpecificAdapterContribution {
  program?: string;
  args?: string[];
  runtime?: string;
  runtimeArgs?: string[];
}

/**
 * package.json中的debugger贡献点定义
 */
export interface DebuggerContribution extends PlatformSpecificAdapterContribution {
  type: string;
  label?: string;
  languages?: string[];
  enableBreakpointsFor?: {
      languageIds: string[],
  };
  configurationAttributes?: IJSONSchema[];
  configurationSnippets?: IJSONSchemaSnippet[];
  variables?: ScopeMap;
  adapterExecutableCommand?: string;
  win?: PlatformSpecificAdapterContribution;
  winx86?: PlatformSpecificAdapterContribution;
  windows?: PlatformSpecificAdapterContribution;
  osx?: PlatformSpecificAdapterContribution;
  linux?: PlatformSpecificAdapterContribution;
}
