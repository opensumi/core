/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  ProblemMatcher,
  ApplyToKind,
  uuid,
  isString,
  FileLocationKind,
  Severity,
  localize,
  NamedProblemMatcher,
  ProblemPattern,
  WatchingPattern,
  isBoolean,
  isStringArray,
  isUndefined,
  MultiLineProblemPattern,
  ProblemLocationKind,
  NamedProblemPattern,
  NamedMultiLineProblemPattern,
  isArray,
  mixin,
  isUndefinedOrNull,
  isNumber,
  deepClone,
} from '@opensumi/ide-core-common';

import { IProblemReporter, getProblemPatternFn, getProblemMatcherFn } from './task-config';

export const enum ValidationState {
  OK = 0,
  Info = 1,
  Warning = 2,
  Error = 3,
  Fatal = 4,
}

export class ValidationStatus {
  private _state: ValidationState;

  constructor() {
    this._state = ValidationState.OK;
  }

  public get state(): ValidationState {
    return this._state;
  }

  public set state(value: ValidationState) {
    if (value > this._state) {
      this._state = value;
    }
  }

  public isOK(): boolean {
    return this._state === ValidationState.OK;
  }

  public isFatal(): boolean {
    return this._state === ValidationState.Fatal;
  }
}

export interface IProblemReporterBase {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  fatal(message: string): void;
  status: ValidationStatus;
}

export abstract class Parser {
  private _problemReporter: IProblemReporterBase;

  constructor(problemReporter: IProblemReporterBase) {
    this._problemReporter = problemReporter;
  }

  public reset(): void {
    this._problemReporter.status.state = ValidationState.OK;
  }

  public get problemReporter(): IProblemReporterBase {
    return this._problemReporter;
  }

  public info(message: string): void {
    this._problemReporter.info(message);
  }

  public warn(message: string): void {
    this._problemReporter.warn(message);
  }

  public error(message: string): void {
    this._problemReporter.error(message);
  }

  public fatal(message: string): void {
    this._problemReporter.fatal(message);
  }
}

export namespace Config {
  export interface ProblemPattern {
    /**
     * The regular expression to find a problem in the console output of an
     * executed task.
     */
    regexp?: string;

    /**
     * Whether the pattern matches a whole file, or a location (file/line)
     *
     * The default is to match for a location. Only valid on the
     * first problem pattern in a multi line problem matcher.
     */
    kind?: string;

    /**
     * The match group index of the filename.
     * If omitted 1 is used.
     */
    file?: number;

    /**
     * The match group index of the problem's location. Valid location
     * patterns are: (line), (line,column) and (startLine,startColumn,endLine,endColumn).
     * If omitted the line and column properties are used.
     */
    location?: number;

    /**
     * The match group index of the problem's line in the source file.
     *
     * Defaults to 2.
     */
    line?: number;

    /**
     * The match group index of the problem's column in the source file.
     *
     * Defaults to 3.
     */
    column?: number;

    /**
     * The match group index of the problem's end line in the source file.
     *
     * Defaults to undefined. No end line is captured.
     */
    endLine?: number;

    /**
     * The match group index of the problem's end column in the source file.
     *
     * Defaults to undefined. No end column is captured.
     */
    endColumn?: number;

    /**
     * The match group index of the problem's severity.
     *
     * Defaults to undefined. In this case the problem matcher's severity
     * is used.
     */
    severity?: number;

    /**
     * The match group index of the problem's code.
     *
     * Defaults to undefined. No code is captured.
     */
    code?: number;

    /**
     * The match group index of the message. If omitted it defaults
     * to 4 if location is specified. Otherwise it defaults to 5.
     */
    message?: number;

    /**
     * Specifies if the last pattern in a multi line problem matcher should
     * loop as long as it does match a line consequently. Only valid on the
     * last problem pattern in a multi line problem matcher.
     */
    loop?: boolean;
  }

  export interface CheckedProblemPattern extends ProblemPattern {
    /**
     * The regular expression to find a problem in the console output of an
     * executed task.
     */
    regexp: string;
  }

  export namespace CheckedProblemPattern {
    export function is(value: any): value is CheckedProblemPattern {
      const candidate: ProblemPattern = value as ProblemPattern;
      return candidate && isString(candidate.regexp);
    }
  }

  export interface NamedProblemPattern extends ProblemPattern {
    /**
     * The name of the problem pattern.
     */
    name: string;

    /**
     * A human readable label
     */
    label?: string;
  }

  export namespace NamedProblemPattern {
    export function is(value: any): value is NamedProblemPattern {
      const candidate: NamedProblemPattern = value as NamedProblemPattern;
      return candidate && isString(candidate.name);
    }
  }

  export interface NamedCheckedProblemPattern extends NamedProblemPattern {
    /**
     * The regular expression to find a problem in the console output of an
     * executed task.
     */
    regexp: string;
  }

  export namespace NamedCheckedProblemPattern {
    export function is(value: any): value is NamedCheckedProblemPattern {
      const candidate: NamedProblemPattern = value as NamedProblemPattern;
      return candidate && NamedProblemPattern.is(candidate) && isString(candidate.regexp);
    }
  }

  export type MultiLineProblemPattern = ProblemPattern[];

  export namespace MultiLineProblemPattern {
    export function is(value: any): value is MultiLineProblemPattern {
      return value && isArray(value);
    }
  }

  export type MultiLineCheckedProblemPattern = CheckedProblemPattern[];

  export namespace MultiLineCheckedProblemPattern {
    export function is(value: any): value is MultiLineCheckedProblemPattern {
      if (!MultiLineProblemPattern.is(value)) {
        return false;
      }
      for (const element of value) {
        if (!Config.CheckedProblemPattern.is(element)) {
          return false;
        }
      }
      return true;
    }
  }

  export interface NamedMultiLineCheckedProblemPattern {
    /**
     * The name of the problem pattern.
     */
    name: string;

    /**
     * A human readable label
     */
    label?: string;

    /**
     * The actual patterns
     */
    patterns: MultiLineCheckedProblemPattern;
  }

  export namespace NamedMultiLineCheckedProblemPattern {
    export function is(value: any): value is NamedMultiLineCheckedProblemPattern {
      const candidate = value as NamedMultiLineCheckedProblemPattern;
      return (
        candidate &&
        isString(candidate.name) &&
        isArray(candidate.patterns) &&
        MultiLineCheckedProblemPattern.is(candidate.patterns)
      );
    }
  }

  export type NamedProblemPatterns = (Config.NamedProblemPattern | Config.NamedMultiLineCheckedProblemPattern)[];

  /**
   * A watching pattern
   */
  export interface WatchingPattern {
    /**
     * The actual regular expression
     */
    regexp?: string;

    /**
     * The match group index of the filename. If provided the expression
     * is matched for that file only.
     */
    file?: number;
  }

  /**
   * A description to track the start and end of a watching task.
   */
  export interface BackgroundMonitor {
    /**
     * If set to true the watcher is in active mode when the task
     * starts. This is equals of issuing a line that matches the
     * beginsPattern.
     */
    activeOnStart?: boolean;

    /**
     * If matched in the output the start of a watching task is signaled.
     */
    beginsPattern?: string | WatchingPattern;

    /**
     * If matched in the output the end of a watching task is signaled.
     */
    endsPattern?: string | WatchingPattern;
  }

  /**
   * A description of a problem matcher that detects problems
   * in build output.
   */
  export interface ProblemMatcher {
    /**
     * The name of a base problem matcher to use. If specified the
     * base problem matcher will be used as a template and properties
     * specified here will replace properties of the base problem
     * matcher
     */
    base?: string;

    /**
     * The owner of the produced VSCode problem. This is typically
     * the identifier of a VSCode language service if the problems are
     * to be merged with the one produced by the language service
     * or a generated internal id. Defaults to the generated internal id.
     */
    owner?: string;

    /**
     * A human-readable string describing the source of this problem.
     * E.g. 'typescript' or 'super lint'.
     */
    source?: string;

    /**
     * Specifies to which kind of documents the problems found by this
     * matcher are applied. Valid values are:
     *
     *   "allDocuments": problems found in all documents are applied.
     *   "openDocuments": problems found in documents that are open
     *   are applied.
     *   "closedDocuments": problems found in closed documents are
     *   applied.
     */
    applyTo?: string | string[];

    /**
     * The severity of the VSCode problem produced by this problem matcher.
     *
     * Valid values are:
     *   "error": to produce errors.
     *   "warning": to produce warnings.
     *   "info": to produce infos.
     *
     * The value is used if a pattern doesn't specify a severity match group.
     * Defaults to "error" if omitted.
     */
    severity?: string | Severity;

    /**
     * Defines how filename reported in a problem pattern
     * should be read. Valid values are:
     *  - "absolute": the filename is always treated absolute.
     *  - "relative": the filename is always treated relative to
     *    the current working directory. This is the default.
     *  - ["relative", "path value"]: the filename is always
     *    treated relative to the given path value.
     */
    fileLocation?: string | string[];

    /**
     * The name of a predefined problem pattern, the inline definintion
     * of a problem pattern or an array of problem patterns to match
     * problems spread over multiple lines.
     */
    pattern?: string | ProblemPattern | ProblemPattern[];

    /**
     * A regular expression signaling that a watched tasks begins executing
     * triggered through file watching.
     */
    watchedTaskBeginsRegExp?: string;

    /**
     * A regular expression signaling that a watched tasks ends executing.
     */
    watchedTaskEndsRegExp?: string;

    /**
     * @deprecated Use background instead.
     */
    watching?: BackgroundMonitor;
    background?: BackgroundMonitor;
  }

  export type ProblemMatcherType = string | ProblemMatcher | Array<string | ProblemMatcher>;

  export interface NamedProblemMatcher extends ProblemMatcher {
    /**
     * This name can be used to refer to the
     * problem matcher from within a task.
     */
    name: string;

    /**
     * A human readable label.
     */
    label?: string;
  }

  export function isNamedProblemMatcher(value?: ProblemMatcher): value is NamedProblemMatcher {
    return isString((value as NamedProblemMatcher).name);
  }
}

export class ProblemPatternParser extends Parser {
  constructor(logger: IProblemReporter) {
    super(logger);
  }

  public parse(value: Config.ProblemPattern): ProblemPattern;
  public parse(value: Config.MultiLineProblemPattern): MultiLineProblemPattern;
  public parse(value: Config.NamedProblemPattern): NamedProblemPattern;
  public parse(value: Config.NamedMultiLineCheckedProblemPattern): NamedMultiLineProblemPattern;
  public parse(
    value:
      | Config.ProblemPattern
      | Config.MultiLineProblemPattern
      | Config.NamedProblemPattern
      | Config.NamedMultiLineCheckedProblemPattern,
  ): any {
    if (Config.NamedMultiLineCheckedProblemPattern.is(value)) {
      return this.createNamedMultiLineProblemPattern(value);
    } else if (Config.MultiLineCheckedProblemPattern.is(value)) {
      return this.createMultiLineProblemPattern(value);
    } else if (Config.NamedCheckedProblemPattern.is(value)) {
      const result = this.createSingleProblemPattern(value) as NamedProblemPattern;
      result.name = value.name;
      return result;
    } else if (Config.CheckedProblemPattern.is(value)) {
      return this.createSingleProblemPattern(value);
    } else {
      this.error(
        localize(
          'ProblemPatternParser.problemPattern.missingRegExp',
          'The problem pattern is missing a regular expression.',
        ),
      );
      return null;
    }
  }

  private createSingleProblemPattern(value: Config.CheckedProblemPattern): ProblemPattern | null {
    const result = this.doCreateSingleProblemPattern(value, true);
    if (result === undefined) {
      return null;
    } else if (result.kind === undefined) {
      result.kind = ProblemLocationKind.Location;
    }
    return this.validateProblemPattern([result]) ? result : null;
  }

  private createNamedMultiLineProblemPattern(
    value: Config.NamedMultiLineCheckedProblemPattern,
  ): NamedMultiLineProblemPattern | null {
    const validPatterns = this.createMultiLineProblemPattern(value.patterns);
    if (!validPatterns) {
      return null;
    }
    const result = {
      name: value.name,
      label: value.label ? value.label : value.name,
      patterns: validPatterns,
    };
    return result;
  }

  private createMultiLineProblemPattern(values: Config.MultiLineCheckedProblemPattern): MultiLineProblemPattern | null {
    const result: MultiLineProblemPattern = [];
    for (let i = 0; i < values.length; i++) {
      const pattern = this.doCreateSingleProblemPattern(values[i], false);
      if (pattern === undefined) {
        return null;
      }
      if (i < values.length - 1) {
        if (!isUndefined(pattern.loop) && pattern.loop) {
          pattern.loop = false;
          this.error(
            localize(
              'ProblemPatternParser.loopProperty.notLast',
              'The loop property is only supported on the last line matcher.',
            ),
          );
        }
      }
      result.push(pattern);
    }
    if (result[0].kind === undefined) {
      result[0].kind = ProblemLocationKind.Location;
    }
    return this.validateProblemPattern(result) ? result : null;
  }

  private doCreateSingleProblemPattern(
    value: Config.CheckedProblemPattern,
    setDefaults: boolean,
  ): ProblemPattern | undefined {
    const regexp = this.createRegularExpression(value.regexp);
    if (regexp === undefined) {
      return undefined;
    }
    let result: ProblemPattern = { regexp };
    if (value.kind) {
      result.kind = ProblemLocationKind.fromString(value.kind);
    }

    function copyProperty(
      result: ProblemPattern,
      source: Config.ProblemPattern,
      resultKey: keyof ProblemPattern,
      sourceKey: keyof Config.ProblemPattern,
    ) {
      const value = source[sourceKey];
      if (typeof value === 'number') {
        (result as any)[resultKey] = value;
      }
    }
    copyProperty(result, value, 'file', 'file');
    copyProperty(result, value, 'location', 'location');
    copyProperty(result, value, 'line', 'line');
    copyProperty(result, value, 'character', 'column');
    copyProperty(result, value, 'endLine', 'endLine');
    copyProperty(result, value, 'endCharacter', 'endColumn');
    copyProperty(result, value, 'severity', 'severity');
    copyProperty(result, value, 'code', 'code');
    copyProperty(result, value, 'message', 'message');
    if (value.loop === true || value.loop === false) {
      result.loop = value.loop;
    }
    if (setDefaults) {
      if (result.location || result.kind === ProblemLocationKind.File) {
        const defaultValue: Partial<ProblemPattern> = {
          file: 1,
          message: 0,
        };
        result = mixin(result, defaultValue, false);
      } else {
        const defaultValue: Partial<ProblemPattern> = {
          file: 1,
          line: 2,
          character: 3,
          message: 0,
        };
        result = mixin(result, defaultValue, false);
      }
    }
    return result;
  }

  private validateProblemPattern(values: ProblemPattern[]): boolean {
    // tslint:disable-next-line: one-variable-per-declaration
    let file = false;
    let message = false;
    let location = false;
    let line = false;
    const locationKind = values[0].kind === undefined ? ProblemLocationKind.Location : values[0].kind;

    values.forEach((pattern, i) => {
      if (i !== 0 && pattern.kind) {
        this.error(
          localize(
            'ProblemPatternParser.problemPattern.kindProperty.notFirst',
            'The problem pattern is invalid. The kind property must be provided only in the first element',
          ),
        );
      }
      file = file || !isUndefined(pattern.file);
      message = message || !isUndefined(pattern.message);
      location = location || !isUndefined(pattern.location);
      line = line || !isUndefined(pattern.line);
    });
    if (!(file && message)) {
      this.error(
        localize(
          'ProblemPatternParser.problemPattern.missingProperty',
          'The problem pattern is invalid. It must have at least have a file and a message.',
        ),
      );
      return false;
    }
    if (locationKind === ProblemLocationKind.Location && !(location || line)) {
      this.error(
        localize(
          'ProblemPatternParser.problemPattern.missingLocation',
          'The problem pattern is invalid. It must either have kind: "file" or have a line or location match group.',
        ),
      );
      return false;
    }
    return true;
  }

  private createRegularExpression(value: string): RegExp | undefined {
    let result: RegExp | undefined;
    try {
      result = new RegExp(value);
    } catch (err) {
      this.error(
        localize(
          'ProblemPatternParser.invalidRegexp',
          'Error: The string {0} is not a valid regular expression.\n',
          value,
        ),
      );
    }
    return result;
  }
}

export class ProblemMatcherParser extends Parser {
  constructor(logger: IProblemReporter) {
    super(logger);
  }

  public parse(
    json: Config.ProblemMatcher,
    getProblemPattern: getProblemPatternFn,
    getProblemMatcher: getProblemMatcherFn,
  ): ProblemMatcher | undefined {
    const result = this.createProblemMatcher(json, getProblemPattern, getProblemMatcher);
    if (!this.checkProblemMatcherValid(json, result)) {
      return undefined;
    }
    this.addWatchingMatcher(json, result);

    return result;
  }

  private checkProblemMatcherValid(
    externalProblemMatcher: Config.ProblemMatcher,
    problemMatcher: ProblemMatcher | null,
  ): problemMatcher is ProblemMatcher {
    if (!problemMatcher) {
      this.error(
        localize(
          'ProblemMatcherParser.noProblemMatcher',
          "Error: the description can't be converted into a problem matcher:\n{0}\n",
          JSON.stringify(externalProblemMatcher, null, 4),
        ),
      );
      return false;
    }
    if (!problemMatcher.pattern) {
      this.error(
        localize(
          'ProblemMatcherParser.noProblemPattern',
          "Error: the description doesn't define a valid problem pattern:\n{0}\n",
          JSON.stringify(externalProblemMatcher, null, 4),
        ),
      );
      return false;
    }
    if (!problemMatcher.owner) {
      this.error(
        localize(
          'ProblemMatcherParser.noOwner',
          "Error: the description doesn't define an owner:\n{0}\n",
          JSON.stringify(externalProblemMatcher, null, 4),
        ),
      );
      return false;
    }
    if (isUndefined(problemMatcher.fileLocation)) {
      this.error(
        localize(
          'ProblemMatcherParser.noFileLocation',
          "Error: the description doesn't define a file location:\n{0}\n",
          JSON.stringify(externalProblemMatcher, null, 4),
        ),
      );
      return false;
    }
    return true;
  }

  private createProblemMatcher(
    description: Config.ProblemMatcher,
    getProblemPattern: getProblemPatternFn,
    getProblemMatcher: getProblemMatcherFn,
  ): ProblemMatcher | null {
    let result: ProblemMatcher | null = null;

    const owner = isString(description.owner) ? description.owner : uuid();
    const source = isString(description.source) ? description.source : undefined;
    let applyTo = isString(description.applyTo)
      ? ApplyToKind.fromString(description.applyTo)
      : ApplyToKind.allDocuments;
    if (!applyTo) {
      applyTo = ApplyToKind.allDocuments;
    }
    let fileLocation: FileLocationKind | undefined;
    let filePrefix: string | undefined;

    let kind: FileLocationKind | undefined;
    if (isUndefined(description.fileLocation)) {
      fileLocation = FileLocationKind.Relative;
      filePrefix = '${workspaceFolder}';
    } else if (isString(description.fileLocation)) {
      kind = FileLocationKind.fromString(description.fileLocation as string);
      if (kind) {
        fileLocation = kind;
        if (kind === FileLocationKind.Relative || kind === FileLocationKind.AutoDetect) {
          filePrefix = '${workspaceFolder}';
        }
      }
    } else if (isStringArray(description.fileLocation)) {
      const values = description.fileLocation as string[];
      if (values.length > 0) {
        kind = FileLocationKind.fromString(values[0]);
        if (values.length === 1 && kind === FileLocationKind.Absolute) {
          fileLocation = kind;
        } else if (
          values.length === 2 &&
          (kind === FileLocationKind.Relative || kind === FileLocationKind.AutoDetect) &&
          values[1]
        ) {
          fileLocation = kind;
          filePrefix = values[1];
        }
      }
    }

    const pattern = description.pattern ? this.createProblemPattern(description.pattern, getProblemPattern) : undefined;

    let severity = description.severity ? Severity.fromValue(description.severity as string) : undefined;
    if (severity === Severity.Ignore) {
      this.info(
        localize(
          'ProblemMatcherParser.unknownSeverity',
          'Info: unknown severity {0}. Valid values are error, warning and info.\n',
          description.severity as string,
        ),
      );
      severity = Severity.Error;
    }

    if (isString(description.base)) {
      const variableName = description.base as string;
      if (variableName.length > 1 && variableName[0] === '$') {
        const base = getProblemMatcher(variableName.substring(1));
        if (base) {
          result = deepClone(base);
          if (description.owner !== undefined && owner !== undefined) {
            result.owner = owner;
          }
          if (description.source !== undefined && source !== undefined) {
            result.source = source;
          }
          if (description.fileLocation !== undefined && fileLocation !== undefined) {
            result.fileLocation = fileLocation;
            result.filePrefix = filePrefix;
          }
          if (description.pattern !== undefined && pattern !== undefined && pattern !== null) {
            result.pattern = pattern;
          }
          if (description.severity !== undefined && severity !== undefined) {
            result.severity = severity;
          }
          if (description.applyTo !== undefined && applyTo !== undefined) {
            result.applyTo = applyTo;
          }
        }
      }
    } else if (fileLocation && pattern) {
      result = {
        owner,
        applyTo,
        fileLocation,
        pattern,
      };
      if (source) {
        result.source = source;
      }
      if (filePrefix) {
        result.filePrefix = filePrefix;
      }
      if (severity) {
        result.severity = severity;
      }
    }
    if (Config.isNamedProblemMatcher(description)) {
      (result as NamedProblemMatcher).name = description.name;
      (result as NamedProblemMatcher).label = isString(description.label) ? description.label : description.name;
    }
    return result;
  }

  private createProblemPattern(
    value: string | Config.ProblemPattern | Config.MultiLineProblemPattern,
    getProblemPattern: getProblemPatternFn,
  ): ProblemPattern | ProblemPattern[] | undefined {
    if (isString(value)) {
      const variableName: string = value as string;
      if (variableName.length > 1 && variableName[0] === '$') {
        const result = getProblemPattern(variableName.substring(1));
        if (!result) {
          this.error(
            localize(
              'ProblemMatcherParser.noDefinedPatter',
              "Error: the pattern with the identifier {0} doesn't exist.",
              variableName,
            ),
          );
        }
        return result;
      } else {
        if (variableName.length === 0) {
          this.error(
            localize('ProblemMatcherParser.noIdentifier', 'Error: the pattern property refers to an empty identifier.'),
          );
        } else {
          this.error(
            localize(
              'ProblemMatcherParser.noValidIdentifier',
              'Error: the pattern property {0} is not a valid pattern variable name.',
              variableName,
            ),
          );
        }
      }
    } else if (value) {
      const problemPatternParser = new ProblemPatternParser(this.problemReporter);
      if (Array.isArray(value)) {
        return problemPatternParser.parse(value);
      } else {
        return problemPatternParser.parse(value);
      }
    }
    return undefined;
  }

  private addWatchingMatcher(external: Config.ProblemMatcher, internal: ProblemMatcher): void {
    const oldBegins = this.createRegularExpression(external.watchedTaskBeginsRegExp);
    const oldEnds = this.createRegularExpression(external.watchedTaskEndsRegExp);
    if (oldBegins && oldEnds) {
      internal.watching = {
        activeOnStart: false,
        beginsPattern: { regexp: oldBegins },
        endsPattern: { regexp: oldEnds },
      };
      return;
    }
    const backgroundMonitor = external.background || external.watching;
    if (isUndefinedOrNull(backgroundMonitor)) {
      return;
    }
    const begins: WatchingPattern | null = this.createWatchingPattern(backgroundMonitor.beginsPattern);
    const ends: WatchingPattern | null = this.createWatchingPattern(backgroundMonitor.endsPattern);
    if (begins && ends) {
      internal.watching = {
        activeOnStart: isBoolean(backgroundMonitor.activeOnStart) ? backgroundMonitor.activeOnStart : false,
        beginsPattern: begins,
        endsPattern: ends,
      };
      return;
    }
    if (begins || ends) {
      this.error(
        localize(
          'ProblemMatcherParser.problemPattern.watchingMatcher',
          'A problem matcher must define both a begin pattern and an end pattern for watching.',
        ),
      );
    }
  }

  private createWatchingPattern(external: string | Config.WatchingPattern | undefined): WatchingPattern | null {
    if (isUndefinedOrNull(external)) {
      return null;
    }
    let regexp: RegExp | null;
    let file: number | undefined;
    if (isString(external)) {
      regexp = this.createRegularExpression(external);
    } else {
      regexp = this.createRegularExpression(external.regexp);
      if (isNumber(external.file)) {
        file = external.file;
      }
    }
    if (!regexp) {
      return null;
    }
    return file ? { regexp, file } : { regexp, file: 1 };
  }

  private createRegularExpression(value: string | undefined): RegExp | null {
    let result: RegExp | null = null;
    if (!value) {
      return result;
    }
    try {
      result = new RegExp(value);
    } catch (err) {
      this.error(
        localize(
          'ProblemMatcherParser.invalidRegexp',
          'Error: The string {0} is not a valid regular expression.\n',
          value,
        ),
      );
    }
    return result;
  }
}
