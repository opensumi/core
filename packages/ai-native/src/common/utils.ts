import { CancellationToken, Emitter, Event } from '@opensumi/ide-core-common';

/**
 * 流转换器
 * 支持将任意输入格式的流转换为 Emitter<string> 的形式
 * 用于对接不同格式的 LLM 接口
 */
export type StreamTransformer = (stream: NodeJS.ReadableStream, token?: CancellationToken) => Emitter<string>;

const decoder = new TextDecoder();

export const LINEBREAKS = /^.*(\r?\n|$)/gm;

export function parseData(data: string) {
  return data.match(/^data:(.*)$/m)?.[1];
}

export function isDone(data: string) {
  return /\[DONE\]$/.test(data);
}

/**
 * 将可读流转换为事件
 * @param stream
 * @param token
 * @returns
 */
export function readableStreamTransformer(stream: NodeJS.ReadableStream, token?: CancellationToken): Emitter<string> {
  const emitter = new Emitter<string>();
  stream.on('data', (chunk) => {
    if (token?.isCancellationRequested) {
      return;
    }

    const rawStr = decoder.decode(chunk);
    const lines = (rawStr || '').match(LINEBREAKS);

    if (!lines) {
      return;
    }

    for (const lineChunk of lines) {
      const parsed = parseData(lineChunk.trim());
      if (parsed) {
        emitter.fire(parsed);
      }
    }
  });
  stream.on('end', () => {
    emitter.fire('[DONE]');
  });
  return emitter;
}

export type EventFilter = (emitter: Emitter<any>) => Event<any>;

/**
 * 将标准流事件过滤为仅包含代码块的事件
 * 根据指定缩进规则增加必要的空格
 * @param stremEvent
 * @returns
 */
export function codeEventFilter(stremEvent: Emitter<string>): Event<string> {
  let startCodeBlock = false;
  let endCodeBlock = false;
  let backtickSequences: string[] = [];

  return Event.filter<string>(stremEvent.event, (e) => {
    // console.log(e);
    if (isDone(e.trim())) {
      return true;
    }

    // 记录代码块开始和结束
    if (['`', '``', '```'].includes(e.trim())) {
      backtickSequences.push(...e.trim());
      if (startCodeBlock && backtickSequences.length >= 3) {
        endCodeBlock = true;
      }
      return false;
    }

    if (!startCodeBlock && backtickSequences.length >= 3) {
      startCodeBlock = true;
      return false;
    }

    // 当结束解析代码块
    if (startCodeBlock) {
      backtickSequences = [];
    }

    if (startCodeBlock && !endCodeBlock) {
      return true;
    }

    return false;
  });
}
