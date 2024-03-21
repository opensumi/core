import { TextWithStyle } from '../utils/ansi-parser';

import { BaseTerminalDetectionLineMatcher, MatcherType } from './base';

export class ShellMatcher extends BaseTerminalDetectionLineMatcher {
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
