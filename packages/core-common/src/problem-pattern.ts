/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/core/src/common/severity.ts

import { Diagnostic } from 'vscode';

import { Injectable } from '@opensumi/di';

import { IDisposable, Disposable, DisposableCollection } from './disposable';
import { ProblemMatcher } from './problem-matcher';
import { URI } from './uri';
import { isArray, isString } from './utils/types';

export enum ApplyToKind {
  allDocuments,
  openDocuments,
  closedDocuments,
}

enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export namespace ApplyToKind {
  export function fromString(value: string | undefined): ApplyToKind | undefined {
    if (value) {
      value = value.toLowerCase();
      if (value === 'alldocuments') {
        return ApplyToKind.allDocuments;
      } else if (value === 'opendocuments') {
        return ApplyToKind.openDocuments;
      } else if (value === 'closeddocuments') {
        return ApplyToKind.closedDocuments;
      }
    }
    return undefined;
  }
}

export enum ProblemLocationKind {
  File,
  Location,
}

export namespace ProblemLocationKind {
  export function fromString(value: string): ProblemLocationKind | undefined {
    value = value.toLowerCase();
    if (value === 'file') {
      return ProblemLocationKind.File;
    } else if (value === 'location') {
      return ProblemLocationKind.Location;
    } else {
      return undefined;
    }
  }
}

export namespace FileLocationKind {
  export function fromString(value: string): FileLocationKind | undefined {
    value = value.toLowerCase();
    if (value === 'absolute') {
      return FileLocationKind.Absolute;
    } else if (value === 'relative') {
      return FileLocationKind.Relative;
    } else {
      return undefined;
    }
  }
}

export enum FileLocationKind {
  Default,
  Relative,
  Absolute,
  AutoDetect,
}

export interface ProblemPattern {
  regexp?: RegExp | string;

  kind?: ProblemLocationKind;

  file?: number;

  message?: number;

  location?: number;

  line?: number;

  character?: number;

  endLine?: number;

  endCharacter?: number;

  code?: number;

  severity?: number;

  loop?: boolean;
}

export interface CheckedProblemPattern extends ProblemPattern {
  /**
   * The regular expression to find a problem in the console output of an
   * executed task.
   */
  regexp: string;
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

export namespace CheckedProblemPattern {
  export function is(value: any): value is CheckedProblemPattern {
    const candidate: ProblemPattern = value as ProblemPattern;
    return candidate && isString(candidate.regexp);
  }
}

export type MultiLineCheckedProblemPattern = CheckedProblemPattern[];

export namespace MultiLineProblemPattern {
  export function is(value: any): value is MultiLineProblemPattern {
    return value && isArray(value);
  }
}
export namespace MultiLineCheckedProblemPattern {
  export function is(value: any): value is MultiLineCheckedProblemPattern {
    if (!MultiLineProblemPattern.is(value)) {
      return false;
    }
    for (const element of value) {
      if (!CheckedProblemPattern.is(element)) {
        return false;
      }
    }
    return true;
  }
}

export namespace NamedProblemPattern {
  export function is(value: any): value is NamedProblemPattern {
    const candidate: NamedProblemPattern = value as NamedProblemPattern;
    return candidate && isString(candidate.name);
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

export type MultiLineProblemPattern = ProblemPattern[];

export interface NamedMultiLineProblemPattern {
  name: string;
  label: string;
  patterns: MultiLineProblemPattern;
}

export interface ProblemPatternContribution {
  name?: string;
  regexp: string;

  kind?: string;
  file?: number;
  message?: number;
  location?: number;
  line?: number;
  character?: number;
  column?: number;
  endLine?: number;
  endCharacter?: number;
  endColumn?: number;
  code?: number;
  severity?: number;
  loop?: boolean;
}

export namespace ProblemPattern {
  export function fromProblemPatternContribution(value: ProblemPatternContribution): NamedProblemPattern {
    return {
      name: value.name!,
      regexp: value.regexp,
      kind: value.kind ? ProblemLocationKind.fromString(value.kind) : undefined,
      file: value.file,
      message: value.message,
      location: value.location,
      line: value.line,
      character: value.column || value.character,
      endLine: value.endLine,
      endCharacter: value.endColumn || value.endCharacter,
      code: value.code,
      severity: value.severity,
      loop: value.loop,
    };
  }
}

export interface ProblemMatch {
  resource?: URI;
  description: ProblemMatcher;
}

export interface ProblemMatchData extends ProblemMatch {
  marker: Diagnostic;
}

export namespace ProblemMatchData {
  export function is(data: ProblemMatch): data is ProblemMatchData {
    return 'marker' in data;
  }
}

export enum Severity {
  Ignore = 0,
  Error = 1,
  Warning = 2,
  Info = 3,
  Log = 4,
}

export namespace Severity {
  const error = 'Errors';
  const warning = 'Warnings';
  const info = 'Info';
  const log = 'Log';
  const ignore = 'All';

  export function fromValue(value: string | undefined): Severity {
    value = value && value.toLowerCase();

    if (!value) {
      return Severity.Ignore;
    }
    if (['error', 'errors'].indexOf(value) !== -1) {
      return Severity.Error;
    }
    if (['warn', 'warning', 'warnings'].indexOf(value) !== -1) {
      return Severity.Warning;
    }
    if (value === 'info') {
      return Severity.Info;
    }
    if (value === 'log') {
      return Severity.Log;
    }

    return Severity.Ignore;
  }

  export function toDiagnosticSeverity(value: Severity): DiagnosticSeverity {
    switch (value) {
      case Severity.Ignore:
        return DiagnosticSeverity.Hint;
      case Severity.Info:
        return DiagnosticSeverity.Information;
      case Severity.Log:
        return DiagnosticSeverity.Information;
      case Severity.Warning:
        return DiagnosticSeverity.Warning;
      case Severity.Error:
        return DiagnosticSeverity.Error;
      default:
        return DiagnosticSeverity.Error;
    }
  }

  export function toString(severity: Severity | undefined): string {
    switch (severity) {
      case Severity.Error:
        return error;
      case Severity.Warning:
        return warning;
      case Severity.Info:
        return info;
      case Severity.Log:
        return log;
      default:
        return ignore;
    }
  }

  export function toArray(): string[] {
    return [ignore, error, warning, info, log];
  }
}

export interface WatchingPattern {
  regexp: RegExp | string;
  file?: number;
}

export const IProblemPatternRegistry = Symbol('ProblemPatternRegistry');

export interface IProblemPatternRegistry {
  onReady(): Promise<void>;
  register(value: any | any[]): IDisposable;
  get(key: string): undefined | NamedProblemPattern | NamedProblemPattern[];
}

@Injectable()
export class ProblemPatternRegistryImpl implements IProblemPatternRegistry {
  private readonly patterns = new Map<string, NamedProblemPattern | NamedProblemPattern[]>();
  private readyPromise: Promise<void>;

  constructor() {
    this.init();
  }

  protected init(): void {
    this.fillDefaults();
    this.readyPromise = new Promise<void>((res, rej) => res(undefined));
  }

  onReady(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Add a problem pattern to the registry.
   *
   * @param definition the problem pattern to be added.
   */
  register(value: ProblemPatternContribution | ProblemPatternContribution[]): IDisposable {
    if (Array.isArray(value)) {
      const toDispose = new DisposableCollection();
      value.forEach((problemPatternContribution) => toDispose.push(this.register(problemPatternContribution)));
      return toDispose;
    }
    if (!value.name) {
      // eslint-disable-next-line no-console
      console.error('Only named Problem Patterns can be registered.');
      return Disposable.NULL;
    }
    const problemPattern: NamedProblemPattern = ProblemPattern.fromProblemPatternContribution(value);
    return this.add(problemPattern.name!, problemPattern);
  }

  /**
   * Finds the problem pattern(s) from the registry with the given name.
   *
   * @param key the name of the problem patterns
   * @return a problem pattern or an array of the problem patterns associated with the name. If no problem patterns are found, `undefined` is returned.
   */
  get(key: string): undefined | NamedProblemPattern | NamedProblemPattern[] {
    if (key.startsWith('$')) {
      return this.patterns.get(key.slice(1));
    }
    return this.patterns.get(key);
  }

  private add(key: string, value: ProblemPattern | ProblemPattern[]): IDisposable {
    let toAdd: NamedProblemPattern | NamedProblemPattern[];
    if (Array.isArray(value)) {
      toAdd = value.map((v) => Object.assign(v, { name: key }));
    } else {
      toAdd = Object.assign(value, { name: key });
    }
    this.patterns.set(key, toAdd);
    return Disposable.create(() => this.patterns.delete(key));
  }

  // copied from https://github.com/Microsoft/vscode/blob/1.33.1/src/vs/workbench/contrib/tasks/common/problemMatcher.ts
  private fillDefaults(): void {
    this.add('msCompile', {
      regexp:
        /^(?:\s+\d+\>)?([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\)\s*:\s+(error|warning|info)\s+(\w{1,2}\d+)\s*:\s*(.*)$/
          .source,
      kind: ProblemLocationKind.Location,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5,
    });
    this.add('gulp-tsc', {
      regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(\d+)\s+(.*)$/.source,
      kind: ProblemLocationKind.Location,
      file: 1,
      location: 2,
      code: 3,
      message: 4,
    });
    this.add('cpp', {
      regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(C\d+)\s*:\s*(.*)$/.source,
      kind: ProblemLocationKind.Location,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5,
    });
    this.add('csc', {
      regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(CS\d+)\s*:\s*(.*)$/.source,
      kind: ProblemLocationKind.Location,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5,
    });
    this.add('vb', {
      regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(BC\d+)\s*:\s*(.*)$/.source,
      kind: ProblemLocationKind.Location,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5,
    });
    this.add('lessCompile', {
      regexp: /^\s*(.*) in file (.*) line no. (\d+)$/.source,
      kind: ProblemLocationKind.Location,
      message: 1,
      file: 2,
      line: 3,
    });
    this.add('jshint', {
      regexp: /^(.*):\s+line\s+(\d+),\s+col\s+(\d+),\s(.+?)(?:\s+\((\w)(\d+)\))?$/.source,
      kind: ProblemLocationKind.Location,
      file: 1,
      line: 2,
      character: 3,
      message: 4,
      severity: 5,
      code: 6,
    });
    this.add('jshint-stylish', [
      {
        regexp: /^(.+)$/.source,
        kind: ProblemLocationKind.Location,
        file: 1,
      },
      {
        regexp: /^\s+line\s+(\d+)\s+col\s+(\d+)\s+(.+?)(?:\s+\((\w)(\d+)\))?$/.source,
        line: 1,
        character: 2,
        message: 3,
        severity: 4,
        code: 5,
        loop: true,
      },
    ]);
    this.add('eslint-compact', {
      regexp: /^(.+):\sline\s(\d+),\scol\s(\d+),\s(Error|Warning|Info)\s-\s(.+)\s\((.+)\)$/.source,
      file: 1,
      kind: ProblemLocationKind.Location,
      line: 2,
      character: 3,
      severity: 4,
      message: 5,
      code: 6,
    });
    this.add('eslint-stylish', [
      {
        regexp: /^([^\s].*)$/.source,
        kind: ProblemLocationKind.Location,
        file: 1,
      },
      {
        regexp: /^\s+(\d+):(\d+)\s+(error|warning|info)\s+(.+?)(?:\s\s+(.*))?$/.source,
        line: 1,
        character: 2,
        severity: 3,
        message: 4,
        code: 5,
        loop: true,
      },
    ]);
    this.add('go', {
      regexp: /^([^:]*: )?((.:)?[^:]*):(\d+)(:(\d+))?: (.*)$/.source,
      kind: ProblemLocationKind.Location,
      file: 2,
      line: 4,
      character: 6,
      message: 7,
    });
  }
}
