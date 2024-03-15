import * as constants from './constants';

export function prePromptHandler(prompt: string): string {
  // remove all empty lines
  prompt = prompt.replace(/^s*[\n]/gm, '');
  const arr = prompt.split('\n');
  // if the number of lines is greater than n, take the last n lines
  if (arr.length > constants.completionModel.completionPromptMaxLineSize) {
    prompt = arr.slice(-constants.completionModel.completionPromptMaxLineSize).join('\n');
  }
  return prompt;
}

export function preSuffixHandler(suffix: string): string {
  suffix = suffix.replace(/^s*[\n]/gm, '');
  const arr = suffix.split('\n');
  if (arr.length > constants.completionModel.completionSuffixMaxLineSize) {
    suffix = arr.slice(-constants.completionModel.completionSuffixMaxLineSize).join('\n');
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
