/** ******************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/task/src/node/task-abstract-line-matcher.ts

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode';

import {
  isWindows,
  ProblemLocationKind,
  ProblemPattern,
  ProblemMatcher,
  ProblemMatch,
  ProblemMatchData,
  Severity,
  FileLocationKind,
  URI,
  WatchingPattern,
} from '@opensumi/ide-core-common';

const endOfLine: string = isWindows ? '\r\n' : '\n';

export interface ProblemData {
  kind?: ProblemLocationKind;
  file?: string;
  location?: string;
  line?: string;
  character?: string;
  endLine?: string;
  endCharacter?: string;
  message?: string;
  severity?: string;
  code?: string;
}

export abstract class AbstractLineMatcher {
  protected patterns: ProblemPattern[] = [];
  protected activePatternIndex = 0;
  protected activePattern: ProblemPattern | undefined;
  protected cachedProblemData: ProblemData;

  constructor(protected matcher: ProblemMatcher) {
    if (Array.isArray(matcher.pattern)) {
      this.patterns = matcher.pattern;
    } else {
      this.patterns = [matcher.pattern];
    }
    this.cachedProblemData = this.getEmptyProblemData();

    if (this.patterns.slice(0, this.patternCount - 1).some((p) => !!p.loop)) {
      // eslint-disable-next-line no-console
      console.error('Problem Matcher: Only the last pattern can loop');
    }
  }

  /**
   * Finds the problem identified by this line matcher.
   *
   * @param line the line of text to find the problem from
   * @return the identified problem. If the problem is not found, `undefined` is returned.
   */
  abstract match(line: string): ProblemMatch | undefined;

  /**
   * Number of problem patterns that the line matcher uses.
   */
  get patternCount(): number {
    return this.patterns.length;
  }

  protected getEmptyProblemData(): ProblemData {
    return Object.create(null) as ProblemData;
  }

  protected fillProblemData(
    data: ProblemData | null,
    pattern: ProblemPattern,
    matches: RegExpExecArray,
  ): data is ProblemData {
    if (data) {
      this.fillProperty(data, 'file', pattern, matches, true);
      this.appendProperty(data, 'message', pattern, matches, true);
      this.fillProperty(data, 'code', pattern, matches, true);
      this.fillProperty(data, 'severity', pattern, matches, true);
      this.fillProperty(data, 'location', pattern, matches, true);
      this.fillProperty(data, 'line', pattern, matches);
      this.fillProperty(data, 'character', pattern, matches);
      this.fillProperty(data, 'endLine', pattern, matches);
      this.fillProperty(data, 'endCharacter', pattern, matches);
      return true;
    }
    return false;
  }

  private appendProperty(
    data: ProblemData,
    property: keyof ProblemData,
    pattern: ProblemPattern,
    matches: RegExpExecArray,
    trim = false,
  ): void {
    const patternProperty = pattern[property];
    if (data[property] === undefined) {
      this.fillProperty(data, property, pattern, matches, trim);
    } else if (patternProperty !== undefined && patternProperty < matches.length) {
      let value = matches[patternProperty];
      if (trim) {
        value = value.trim();
      }
      (data[property] as string) += endOfLine + value;
    }
  }

  private fillProperty(
    data: ProblemData,
    property: keyof ProblemData,
    pattern: ProblemPattern,
    matches: RegExpExecArray,
    trim = false,
  ): void {
    const patternAtProperty = pattern[property];
    if (data[property] === undefined && patternAtProperty !== undefined && patternAtProperty < matches.length) {
      let value = matches[patternAtProperty];
      if (value !== undefined) {
        if (trim) {
          value = value.trim();
        }
        (data[property] as string) = value;
      }
    }
  }

  protected getMarkerMatch(data: ProblemData): ProblemMatch | undefined {
    try {
      const location = this.getLocation(data);
      if (data.file && location && data.message) {
        const marker: Diagnostic = {
          severity: this.getSeverity(data),
          range: location,
          message: data.message,
        };
        if (data.code !== undefined) {
          marker.code = data.code;
        }
        if (this.matcher.source !== undefined) {
          marker.source = this.matcher.source;
        }
        return {
          description: this.matcher,
          resource: this.getResource(data.file, this.matcher),
          marker,
        } as ProblemMatchData;
      }
      return {
        description: this.matcher,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed to convert problem data into match: ${JSON.stringify(data)}`);
    }
    return undefined;
  }

  private getLocation(data: ProblemData): Range | null {
    if (data.kind === ProblemLocationKind.File) {
      return this.createRange(0, 0, 0, 0);
    }
    if (data.location) {
      return this.parseLocationInfo(data.location);
    }
    if (!data.line) {
      return null;
    }
    const startLine = parseInt(data.line, 10);
    const startColumn = data.character ? parseInt(data.character, 10) : undefined;
    const endLine = data.endLine ? parseInt(data.endLine, 10) : undefined;
    const endColumn = data.endCharacter ? parseInt(data.endCharacter, 10) : undefined;
    return this.createRange(startLine, startColumn, endLine, endColumn);
  }

  private parseLocationInfo(value: string): Range | null {
    if (!value || !value.match(/(\d+|\d+,\d+|\d+,\d+,\d+,\d+)/)) {
      return null;
    }
    const parts = value.split(',');
    const startLine = parseInt(parts[0], 10);
    const startColumn = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
    if (parts.length > 3) {
      return this.createRange(startLine, startColumn, parseInt(parts[2], 10), parseInt(parts[3], 10));
    } else {
      return this.createRange(startLine, startColumn, undefined, undefined);
    }
  }

  private createRange(
    startLine: number,
    startColumn: number | undefined,
    endLine: number | undefined,
    endColumn: number | undefined,
  ): Range {
    let range: Range;
    if (startColumn !== undefined) {
      if (endColumn !== undefined) {
        range = {
          start: { line: startLine, character: startColumn },
          end: { line: endLine || startLine, character: endColumn },
        } as Range;
      } else {
        range = {
          start: { line: startLine, character: startColumn },
          end: { line: startLine, character: startColumn },
        } as Range;
      }
    } else {
      range = {
        start: { line: startLine, character: 1 },
        end: { line: startLine, character: Number.MAX_VALUE },
      } as Range;
    }

    // range indexes should be zero-based
    return {
      start: {
        line: this.getZeroBasedRangeIndex(range.start.line),
        character: this.getZeroBasedRangeIndex(range.start.character),
      },
      end: {
        line: this.getZeroBasedRangeIndex(range.end.line),
        character: this.getZeroBasedRangeIndex(range.end.character),
      },
    } as Range;
  }

  private getZeroBasedRangeIndex(ind: number): number {
    return ind === 0 ? ind : ind - 1;
  }

  private getSeverity(data: ProblemData): DiagnosticSeverity {
    let result: Severity | null = null;
    if (data.severity) {
      const value = data.severity;
      if (value) {
        result = Severity.fromValue(value);
        if (result === Severity.Ignore) {
          if (value === 'E') {
            result = Severity.Error;
          } else if (value === 'W') {
            result = Severity.Warning;
          } else if (value === 'I') {
            result = Severity.Info;
          } else if (value.toLowerCase() === 'hint') {
            result = Severity.Info;
          } else if (value.toLowerCase() === 'note') {
            result = Severity.Info;
          }
        }
      }
    }
    if (result === null || result === Severity.Ignore) {
      if (typeof this.matcher.severity === 'string') {
        result = Severity.fromValue(this.matcher.severity) || Severity.Error;
      } else {
        result = this.matcher.severity || Severity.Error;
      }
    }
    return Severity.toDiagnosticSeverity(result as Severity);
  }

  private getResource(filename: string, matcher: ProblemMatcher): URI {
    const kind = matcher.fileLocation;
    let fullPath: string | undefined;
    if (kind === FileLocationKind.Absolute) {
      fullPath = filename;
    } else if (kind === FileLocationKind.Relative && matcher.filePrefix) {
      let relativeFileName = filename.replace(/\\/g, '/');
      if (relativeFileName.startsWith('./')) {
        relativeFileName = relativeFileName.slice(2);
      }
      fullPath = new URI(matcher.filePrefix).resolve(relativeFileName).path.toString();
    }
    if (fullPath === undefined) {
      throw new Error(
        'FileLocationKind is not actionable. Does the matcher have a filePrefix? This should never happen.',
      );
    }
    fullPath = fullPath.replace(/\\/g, '/');
    if (fullPath[0] !== '/') {
      fullPath = '/' + fullPath;
    }
    if (matcher.uriProvider !== undefined) {
      return matcher.uriProvider(fullPath);
    } else {
      return URI.file(fullPath);
    }
  }

  protected resetActivePatternIndex(defaultIndex?: number): void {
    if (defaultIndex === undefined) {
      defaultIndex = 0;
    }
    this.activePatternIndex = defaultIndex;
    this.activePattern = this.patterns[defaultIndex];
  }

  protected nextProblemPattern(): void {
    this.activePatternIndex++;
    if (this.activePatternIndex > this.patternCount - 1) {
      this.resetActivePatternIndex();
    } else {
      this.activePattern = this.patterns[this.activePatternIndex];
    }
  }

  protected doOneLineMatch(line: string): boolean {
    if (this.activePattern) {
      const regexp = new RegExp(this.activePattern.regexp!);
      const regexMatches = regexp.exec(line);
      if (regexMatches) {
        if (this.activePattern.kind !== undefined && this.cachedProblemData.kind !== undefined) {
          this.cachedProblemData.kind = this.activePattern.kind;
        }
        return this.fillProblemData(this.cachedProblemData, this.activePattern, regexMatches);
      }
    }
    return false;
  }

  // check if active pattern is the last pattern
  protected isUsingTheLastPattern(): boolean {
    return this.patternCount > 0 && this.activePatternIndex === this.patternCount - 1;
  }

  protected isLastPatternLoop(): boolean {
    return this.patternCount > 0 && !!this.patterns[this.patternCount - 1].loop;
  }

  protected resetCachedProblemData(): void {
    this.cachedProblemData = this.getEmptyProblemData();
  }
}

export class StartStopLineMatcher extends AbstractLineMatcher {
  constructor(protected matcher: ProblemMatcher) {
    super(matcher);
  }

  /**
   * Finds the problem identified by this line matcher.
   *
   * @param line the line of text to find the problem from
   * @return the identified problem. If the problem is not found, `undefined` is returned.
   */
  match(line: string): ProblemMatch | undefined {
    if (!this.activePattern) {
      this.resetActivePatternIndex();
    }
    if (this.activePattern) {
      const originalProblemData = Object.assign(this.getEmptyProblemData(), this.cachedProblemData);
      const foundMatch = this.doOneLineMatch(line);
      if (foundMatch) {
        if (this.isUsingTheLastPattern()) {
          const matchResult = this.getMarkerMatch(this.cachedProblemData);
          if (this.isLastPatternLoop()) {
            this.cachedProblemData = originalProblemData;
          } else {
            this.resetCachedProblemData();
            this.resetActivePatternIndex();
          }
          return matchResult;
        } else {
          this.nextProblemPattern();
        }
      } else {
        this.resetCachedProblemData();
        if (this.activePatternIndex !== 0) {
          // if no match, use the first pattern to parse the same line
          this.resetActivePatternIndex();
          return this.match(line);
        }
      }
    }
    return undefined;
  }
}

export class WatchModeLineMatcher extends StartStopLineMatcher {
  private beginsPattern: WatchingPattern;
  private endsPattern: WatchingPattern;
  activeOnStart = false;

  constructor(protected matcher: ProblemMatcher) {
    super(matcher);
    this.beginsPattern = matcher.watching!.beginsPattern;
    this.endsPattern = matcher.watching!.endsPattern;
    this.activeOnStart = matcher.watching!.activeOnStart === true;
    this.resetActivePatternIndex(this.activeOnStart ? 0 : -1);
  }

  /**
   * Finds the problem identified by this line matcher.
   *
   * @param line the line of text to find the problem from
   * @return the identified problem. If the problem is not found, `undefined` is returned.
   */
  match(line: string): ProblemMatch | undefined {
    if (this.activeOnStart) {
      this.activeOnStart = false;
      this.resetActivePatternIndex(0);
      this.resetCachedProblemData();
      return super.match(line);
    }

    if (this.matchBegin(line)) {
      const beginsPatternMatch = this.getMarkerMatch(this.cachedProblemData);
      this.resetCachedProblemData();
      return beginsPatternMatch;
    }
    if (this.matchEnd(line)) {
      this.resetCachedProblemData();
      return undefined;
    }
    if (this.activePattern) {
      return super.match(line);
    }
    return undefined;
  }

  matchBegin(line: string): boolean {
    const beginRegexp = new RegExp(this.beginsPattern.regexp);
    const regexMatches = beginRegexp.exec(line);
    if (regexMatches) {
      this.fillProblemData(this.cachedProblemData, this.beginsPattern, regexMatches);
      this.resetActivePatternIndex(0);
      return true;
    }
    return false;
  }

  matchEnd(line: string): boolean {
    const endRegexp = new RegExp(this.endsPattern.regexp);
    const match = endRegexp.exec(line);
    if (match) {
      this.resetActivePatternIndex(-1);
      return true;
    }
    return false;
  }
}
