import { ResourceDocument, TokenizerName } from '../types';

import { WindowedMatcher, computeScore } from './matcher';
import { getTokenizer } from './tokenizer';

export interface CursorContextOptions {
  maxLineCount?: number;
  maxTokenLength?: number;
  tokenizerName?: TokenizerName;
  extensionPath?: string;
}

export const getCursorContext = (
  resource: ResourceDocument,
  option: CursorContextOptions = {},
): {
  context: string;
  lineCount: number;
  tokenLength: number;
  tokenizerName: TokenizerName;
} => {
  const baseOptions = {
    tokenizerName: TokenizerName.cl100k_base,
    ...option,
  };
  const tokenizer = getTokenizer(baseOptions.tokenizerName);
  if (baseOptions.maxLineCount && baseOptions.maxLineCount < 0) {
    throw new Error('maxLineCount must be non-negative if defined');
  }
  if (baseOptions.maxTokenLength && baseOptions.maxTokenLength < 0) {
    throw new Error('maxTokenLength must be non-negative if defined');
  }
  if (baseOptions.maxLineCount === 0 || baseOptions.maxTokenLength === 0) {
    return {
      context: '',
      lineCount: 0,
      tokenLength: 0,
      tokenizerName: baseOptions.tokenizerName,
    };
  }
  let context = resource.source.slice(0, resource.offset);
  if (baseOptions.maxLineCount) {
    context = context.split('\n').slice(-baseOptions.maxLineCount).join('\n');
  }
  return {
    context,
    lineCount: context.split('\n').length,
    tokenLength: tokenizer.encode(context).length,
    tokenizerName: baseOptions.tokenizerName,
  };
};

const getBasicWindowDelineations = (windowSize: number, lineArrays: string[]): [number, number][] => {
  const ranges: [number, number][] = [];
  const arrayLength = lineArrays.length;
  if (arrayLength === 0) {
    return [];
  }
  if (arrayLength < windowSize) {
    return [[0, arrayLength]];
  }
  for (let i = 0; i < arrayLength - windowSize + 1; i++) {
    ranges.push([i, i + windowSize]);
  }
  return ranges;
};

// 固定窗口大小的 Jaccard 匹配器
export class FixedWindowSizeJaccardMatcher extends WindowedMatcher {
  static factory(windowSize: number) {
    return {
      to: (doc: ResourceDocument) => new FixedWindowSizeJaccardMatcher(doc, windowSize),
    };
  }

  private readonly windowLength: number;

  constructor(doc: ResourceDocument, windowSize: number) {
    super(doc);
    this.windowLength = windowSize;
  }

  id() {
    return `fixed:${this.windowLength}`;
  }

  getWindowsDelineations(lines: string[]) {
    return getBasicWindowDelineations(this.windowLength, lines);
  }

  getCursorContextInfo(resource: ResourceDocument) {
    return getCursorContext(resource, { maxLineCount: this.windowLength });
  }

  similarityScore(set1: Set<string>, set2: Set<string>) {
    return computeScore(set1, set2);
  }
}
