import { TextWithStyle, isRedColor } from '../utils/ansi-parser';

import { BaseTerminalDetectionLineMatcher, MatcherType } from './base';

export class NodeMatcher extends BaseTerminalDetectionLineMatcher {
  type = MatcherType.node;
  isMultiLine = true;
  maxSpaceLine = 1;

  /**
   * node 情况
   * 1. 整行都是红色
   * 2. 整行都是红色，但存在其他样式，导致列表数组长度未知
   */
  doMatch(styleList: TextWithStyle[]): boolean {
    return this.isSingleLineError(styleList) || this.isMultiPartError(styleList);
  }

  private isSingleLineError(styleList: TextWithStyle[]) {
    return (
      styleList.length === 1 &&
      isRedColor(styleList[0]) &&
      (this.isMatched || !this.isExcludeContent(styleList[0].content))
    );
  }

  private isMultiPartError(styleList: TextWithStyle[]) {
    return styleList.length > 1 && !styleList.some((item) => !isRedColor(item));
  }
  /**
   * 需要排除的一些场景
   * 1. 内容长度小于20
   * 2. 包含 mfsu 以及相关的解释信息 例如： - 不出现三层或以上的 ../ 相对路径查找。、
   */
  private isExcludeContent(content: string) {
    return content.length < 20 || /mfsu/i.test(content) || /\s-\s/.test(content);
  }
}
