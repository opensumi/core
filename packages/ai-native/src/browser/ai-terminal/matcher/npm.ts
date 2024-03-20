import { TextWithStyle, isRedColor } from '../utils/ansi-parser';

import { LineMatcher, MatcherType } from './base';

export class NPMMatcher extends LineMatcher {
  type = MatcherType.npm;
  isMultiLine = true;
  maxSpaceLine = 1;
  /**
   * npm 情况
   * 1. 红色 ERR 多行
   */
  doMatch(styleList: TextWithStyle[]) {
    return !!styleList.find((style) => /ERR/.test(style.content) && isRedColor(style));
  }
}
