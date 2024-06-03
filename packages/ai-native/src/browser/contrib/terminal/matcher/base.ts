import { TextWithStyle } from '../utils/ansi-parser';

export enum MatcherType {
  base,
  npm,
  typescript,
  node,
  shell,
  java,
}

export interface LineRecord {
  type?: MatcherType;
  text: string;
}

export abstract class BaseTerminalDetectionLineMatcher {
  type: MatcherType = MatcherType.base;
  // 是否多行报错
  isMultiLine = false;
  // 记录是否已匹配到错误，配合多行匹配使用
  isMatched = false;
  // 如果是多行，可能会存在空行，需要设置非连续报错的间隔
  maxSpaceLine = 0;
  // 记录已经匹配到的空行，当前空行数等于maxSpaceLine时，认为是连续报错结束
  currentSpaceLine = 0;

  match(output: TextWithStyle[]): boolean {
    if (this.doMatch(output)) {
      this.isMatched = true;
      this.currentSpaceLine = 0;
      return true;
    } else if (this.isMultiLine && this.isMatched && this.currentSpaceLine < this.maxSpaceLine) {
      this.currentSpaceLine++;
      return true;
    }

    this.isMatched = false;
    return false;
  }
  // 返回是否匹配
  abstract doMatch(output: TextWithStyle[]): boolean;
}
