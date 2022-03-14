import vscode from 'vscode';

import type {
  OnEnterRule,
  IndentationRule,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageConfiguration';

import * as types from './ext-types';
import { SerializedIndentationRule, SerializedRegExp, SerializedOnEnterRule } from './model.api';

/**
 * Returns `true` if the parameter has type "object" and not null, an array, a regexp, a date.
 */
export function isObject(obj: any): boolean {
  return (
    typeof obj === 'object' && obj !== null && !Array.isArray(obj) && !(obj instanceof RegExp) && !(obj instanceof Date)
  );
}

export function mixin(destination: any, source: any, overwrite = true): any {
  if (!isObject(destination)) {
    return source;
  }

  if (isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (key in destination) {
        if (overwrite) {
          if (isObject(destination[key]) && isObject(source[key])) {
            mixin(destination[key], source[key], overwrite);
          } else {
            destination[key] = source[key];
          }
        }
      } else {
        destination[key] = source[key];
      }
    });
  }
  return destination;
}

export function illegalArgument(message?: string): Error {
  if (message) {
    return new Error(`Illegal argument: ${message}`);
  } else {
    return new Error('Illegal argument');
  }
}

export function isLocationArray(array: any): array is types.Location[] {
  return Array.isArray(array) && array.length > 0 && array[0] instanceof types.Location;
}

export function isDefinitionLinkArray(array: any): array is vscode.DefinitionLink[] {
  return (
    Array.isArray(array) &&
    array.length > 0 &&
    // eslint-disable-next-line no-prototype-builtins
    array[0].hasOwnProperty('targetUri') &&
    // eslint-disable-next-line no-prototype-builtins
    array[0].hasOwnProperty('targetRange')
  );
}

export function reviveRegExp(regExp?: SerializedRegExp): RegExp | undefined {
  if (typeof regExp === 'undefined' || regExp === null) {
    return undefined;
  }
  return new RegExp(regExp.pattern, regExp.flags);
}

export function reviveIndentationRule(indentationRule?: SerializedIndentationRule): IndentationRule | undefined {
  if (typeof indentationRule === 'undefined' || indentationRule === null) {
    return undefined;
  }
  return {
    increaseIndentPattern: reviveRegExp(indentationRule.increaseIndentPattern)!,
    decreaseIndentPattern: reviveRegExp(indentationRule.decreaseIndentPattern)!,
    indentNextLinePattern: reviveRegExp(indentationRule.indentNextLinePattern),
    unIndentedLinePattern: reviveRegExp(indentationRule.unIndentedLinePattern),
  };
}

export function reviveOnEnterRule(onEnterRule: SerializedOnEnterRule): OnEnterRule {
  return {
    beforeText: reviveRegExp(onEnterRule.beforeText)!,
    afterText: reviveRegExp(onEnterRule.afterText),
    action: onEnterRule.action,
    previousLineText: reviveRegExp(onEnterRule.previousLineText),
  };
}

export function reviveOnEnterRules(onEnterRules?: SerializedOnEnterRule[]): OnEnterRule[] | undefined {
  if (typeof onEnterRules === 'undefined' || onEnterRules === null) {
    return undefined;
  }
  return onEnterRules.map(reviveOnEnterRule);
}

export function serializeEnterRules(rules?: vscode.OnEnterRule[]): SerializedOnEnterRule[] | undefined {
  if (typeof rules === 'undefined' || rules === null) {
    return undefined;
  }

  return rules.map(
    (r) =>
      ({
        action: r.action,
        beforeText: serializeRegExp(r.beforeText),
        afterText: serializeRegExp(r.afterText),
        previousLineText: serializeRegExp(r.previousLineText),
      } as SerializedOnEnterRule),
  );
}

export function serializeRegExp(regexp?: RegExp): SerializedRegExp | undefined {
  if (typeof regexp === 'undefined' || regexp === null) {
    return undefined;
  }

  return {
    pattern: regexp.source,
    flags: (regexp.global ? 'g' : '') + (regexp.ignoreCase ? 'i' : '') + (regexp.multiline ? 'm' : ''),
  };
}

export function serializeIndentation(indentationRules?: vscode.IndentationRule): SerializedIndentationRule | undefined {
  if (typeof indentationRules === 'undefined' || indentationRules === null) {
    return undefined;
  }

  return {
    increaseIndentPattern: serializeRegExp(indentationRules.increaseIndentPattern),
    decreaseIndentPattern: serializeRegExp(indentationRules.decreaseIndentPattern),
    indentNextLinePattern: serializeRegExp(indentationRules.indentNextLinePattern),
    unIndentedLinePattern: serializeRegExp(indentationRules.unIndentedLinePattern),
  };
}
