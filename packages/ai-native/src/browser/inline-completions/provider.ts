import * as constants from './constants';
/**
 * prompt数据前处理
 * 1: 去掉所有空行
 * 2: 如果行数超过{@link constants.codeFuseDefaultConfig.completionPromptMaxLineSize},取最近的{@link constants.codeFuseDefaultConfig.completionPromptMaxLineSize}行
 * @param prompt 代码上文
 * @returns
 */
export function prePromptHandler(prompt: string): string {
  prompt = prompt.replace(/^s*[\n]/gm, '');
  const arr = prompt.split('\n');
  if (arr.length > constants.codeFuseDefaultConfig.completionPromptMaxLineSize) {
    prompt = arr.slice(-constants.codeFuseDefaultConfig.completionPromptMaxLineSize).join('\n');
  }
  return prompt;
}

/**
 * suffix数据前处理
 * 1: 去掉所有空行
 * 2: 如果行数超过{@link constants.codeFuseDefaultConfig.completionPromptMaxLineSize},取最近的{@link constants.codeFuseDefaultConfig.completionPromptMaxLineSize}行
 * @param prompt 代码上文
 * @returns
 */
export function preSuffixHandler(suffix: string): string {
  suffix = suffix.replace(/^s*[\n]/gm, '');
  const arr = suffix.split('\n');
  if (arr.length > constants.codeFuseDefaultConfig.completionSuffixMaxLineSize) {
    suffix = arr.slice(-constants.codeFuseDefaultConfig.completionSuffixMaxLineSize).join('\n');
  }
  return suffix;
}

export class ReqStack {
  queue: any[];
  constructor() {
    this.queue = [];
  }
  addReq(reqRequest: { sendRequest: any; cancelRequest: any }) {
    this.queue.push(reqRequest);
  }
  runReq() {
    if (this.queue.length === 0) {
      return;
    }
    const fn = this.queue.pop();
    return fn.sendRequest();
  }
  cancleRqe() {
    if (this.queue.length === 0) {
      return;
    }
    this.queue.forEach((item) => {
      item.cancelRequest();
    });
    this.queue = [];
  }
}
