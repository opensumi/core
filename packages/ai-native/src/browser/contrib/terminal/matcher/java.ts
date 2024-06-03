import { TextWithStyle } from '../utils/ansi-parser';

import { BaseTerminalDetectionLineMatcher, MatcherType } from './base';

export class JavaMatcher extends BaseTerminalDetectionLineMatcher {
  type = MatcherType.java;
  isMultiLine = true;

  /**
   * java 场景，多行，带堆栈信息
   * 1. caused by:
   * 2. xxxException:
   */
  doMatch(styleList: TextWithStyle[]): boolean {
    return this.isErrorStack(styleList) || this.isCasuseByError(styleList) || this.isExceptionError(styleList);
  }

  private isErrorStack(styleList: TextWithStyle[]) {
    return this.isMatched && !!styleList.find((item) => /^\s+at\s/i.test(item.content));
  }

  private isCasuseByError(styleList: TextWithStyle[]): boolean {
    return !!styleList.find((item) => /caused\sby:/i.test(item.content));
  }

  private isExceptionError(styleLIst: TextWithStyle[]) {
    return !!styleLIst.find((item) => /\w+Exception:/i.test(item.content));
  }
}
