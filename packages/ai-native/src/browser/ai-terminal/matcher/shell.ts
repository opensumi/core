import { TextWithStyle } from '../utils/ansi-parser';

import { LineMatcher, MatcherType } from './base';

export class ShellMatcher extends LineMatcher {
  type = MatcherType.shell;
  isMultiLine = false;
  /**
   * shell 脚本 情况
   * 1. command not found
   */
  doMatch(styleList: TextWithStyle[]) {
    return !!styleList.find((style) => /command\snot\sfound/.test(style.content));
  }
}
