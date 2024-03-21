import { TextWithStyle, isRedColor } from '../utils/ansi-parser';

import { BaseTerminalDetectionLineMatcher, MatcherType } from './base';

export class TSCMatcher extends BaseTerminalDetectionLineMatcher {
  type = MatcherType.typescript;
  isMultiLine = true;

  /**
   * typescript 情况
   * 1. 红色 ERROR
   * 2. TSxxxx
   * 3. Error:
   */
  doMatch(styleList: TextWithStyle[]) {
    let hasRedError = false;
    let hasErrorCode = false;
    let hasErrorText = false;

    styleList.forEach((style) => {
      if (/error/i.test(style.content) && isRedColor(style)) {
        hasRedError = true;
      }

      if (/TS\d+/.test(style.content)) {
        hasErrorCode = true;
      }

      if (/Error:/i.test(style.content)) {
        hasErrorText = true;
      }
    });

    return hasRedError || hasErrorCode || hasErrorText || this.isErrorStack(styleList);
  }

  private isErrorStack(styleList: TextWithStyle[]) {
    return this.isMatched && !!styleList.find((item) => /^\s+at\s/i.test(item.content));
  }
}
