import { Event, IRelativePattern, Uri, match as matchGlobPattern } from '@opensumi/ide-core-common';
import { LanguageFilter, LanguageSelector } from '@opensumi/ide-editor';
import { normalize } from '@opensumi/ide-utils/lib/path';

import * as types from '../../../../common/vscode/ext-types';

import type vscode from 'vscode';

export function createToken(): any {
  return Object.freeze({
    isCancellationRequested: false,
    onCancellationRequested: Event.None,
  });
}

export interface ObjectIdentifier {
  $ident: number;
}

export namespace ObjectIdentifier {
  export const name = '$ident';

  export function mixin<T>(obj: T, id: number): T & ObjectIdentifier {
    Object.defineProperty(obj, name, { value: id, enumerable: true });
    return obj as T & ObjectIdentifier;
  }

  export function of(obj: any): number {
    return obj[name];
  }
}

export function isLocationArray(array: any): array is types.Location[] {
  return Array.isArray(array) && array.length > 0 && array[0] instanceof types.Location;
}

export function isDefinitionLinkArray(array: any): array is vscode.DefinitionLink[] {
  return (
    Array.isArray(array) &&
    array.length > 0 &&
    array[0].hasOwnProperty('targetUri') &&
    array[0].hasOwnProperty('targetRange')
  );
}

export function score(
  selector: LanguageSelector | undefined,
  candidateUri: Uri,
  candidateLanguage: string,
  candidateIsSynchronized: boolean,
  candidateNotebookUri: Uri | undefined,
  candidateNotebookType: string | undefined,
): number {
  if (Array.isArray(selector)) {
    let ret = 0;
    for (const filter of selector) {
      const value = score(
        filter,
        candidateUri,
        candidateLanguage,
        candidateIsSynchronized,
        candidateNotebookUri,
        candidateNotebookType,
      );
      if (value === 10) {
        return value;
      }
      if (value > ret) {
        ret = value;
      }
    }
    return ret;
  } else if (typeof selector === 'string') {
    if (!candidateIsSynchronized) {
      return 0;
    }

    if (selector === '*') {
      return 5;
    } else if (selector === candidateLanguage) {
      return 10;
    } else {
      return 0;
    }
  } else if (selector) {
    const { language, pattern, scheme, hasAccessToAllModels, notebookType } = selector;

    if (!candidateIsSynchronized && !hasAccessToAllModels) {
      return 0;
    }

    if (notebookType && candidateNotebookUri) {
      candidateUri = candidateNotebookUri;
    }

    let result = 0;

    if (scheme) {
      if (scheme === candidateUri.scheme) {
        result = 10;
      } else if (scheme === '*') {
        result = 5;
      } else {
        return 0;
      }
    }

    if (language) {
      if (language === candidateLanguage) {
        result = 10;
      } else if (language === '*') {
        result = Math.max(result, 5);
      } else {
        return 0;
      }
    }

    if (notebookType) {
      if (notebookType === candidateNotebookType) {
        result = 10;
      } else if (notebookType === '*' && candidateNotebookType !== undefined) {
        result = Math.max(result, 5);
      } else {
        return 0;
      }
    }

    if (pattern) {
      let normalizedPattern: string | IRelativePattern;
      if (typeof pattern === 'string') {
        normalizedPattern = pattern;
      } else {
        normalizedPattern = { ...pattern, base: normalize(pattern.base) };
      }
      if (normalizedPattern === candidateUri.fsPath || matchGlobPattern(pattern, candidateUri.fsPath)) {
        result = 10;
      } else {
        return 0;
      }
    }

    return result;
  } else {
    return 0;
  }
}

// node 和 worker 不一样
interface Performance {
  now(): number;
}

let performance: Performance | null = null;
export const setPerformance = (perf: Performance) => {
  performance = perf;
};
export const getPerformance = () => performance;

/**
 *
 * @description 记录插件进程中相关操作的耗时
 */
export const getDurationTimer = () => {
  const perf = getPerformance();
  const recorder = perf ? perf : Date;

  const startTime = recorder.now();

  return {
    end: () => {
      const cost = Math.round(recorder.now() - startTime);
      return cost;
    },
  };
};

export function targetsNotebooks(selector: LanguageSelector): boolean {
  if (typeof selector === 'string') {
    return false;
  } else if (Array.isArray(selector)) {
    return selector.some(targetsNotebooks);
  } else {
    return !!(selector as LanguageFilter).notebookType;
  }
}
