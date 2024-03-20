import { IMarker } from 'xterm';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { ITerminalController } from '@opensumi/ide-terminal-next';

import { AITerminaDebuglService } from './ai-terminal-debug.service';
import { AITerminalDecorationService } from './decoration/terminal-decoration';
import {
  JavaMatcher,
  LineMatcher,
  LineRecord,
  MatcherType,
  NPMMatcher,
  NodeMatcher,
  ShellMatcher,
  TSCMatcher,
} from './matcher';
import { TextStyle, TextWithStyle, ansiParser } from './utils/ansi-parser';

@Injectable()
export class AITerminalService extends Disposable {
  @Autowired(ITerminalController)
  private terminalController: ITerminalController;

  @Autowired(AITerminaDebuglService)
  private terminalDebug: AITerminaDebuglService;

  @Autowired(AITerminalDecorationService)
  private terminalDecorations: AITerminalDecorationService;

  private isTyping: boolean;

  private outputRecordMap: Map<string, LineRecord[]> = new Map();

  private inputRecordMap: Map<string, LineRecord[]> = new Map();

  private clientCurrentMarker: Map<string, IMarker | undefined> = new Map();

  private inputCache = '';

  private lastStyle: TextStyle;

  private outputMatcherList = [
    new NodeMatcher(),
    new TSCMatcher(),
    new NPMMatcher(),
    new ShellMatcher(),
    new JavaMatcher(),
  ];

  private currentMatcher: LineMatcher | null;

  public active() {
    this.disposables.push(this.terminalController.onDidOpenTerminal(({ id }) => this.listenTerminalEvent(id)));
  }

  private listenTerminalEvent(clientId: string) {
    const client = this.terminalController.clients.get(clientId);

    if (client) {
      this.disposables.push(
        client.onOutput(({ id, data }) => this.handleClientOutput(id, data)),
        client.onInput(({ id, data }) => this.handleClientInput(id, data)),
      );
      this.resetState(clientId);
    }
  }

  private resetState(clientId: string) {
    this.inputCache = '';
    this.inputRecordMap.set(clientId, []);
    this.outputRecordMap.set(clientId, []);
    this.clientCurrentMarker.set(clientId, undefined);
    this.currentMatcher = null;
  }
  /**
   * 按行解析输出文本
   */
  private handleClientOutput(clientId: string, data: string | ArrayBuffer) {
    if (!this.isTyping) {
      const client = this.terminalController.clients.get(clientId)!;
      const viewportCol = client.term.cols;

      const dataLine = data.toString().split('\r\n');
      let dataLineIndex = 0;

      dataLine.forEach((line, index) => {
        const { parts, currentStyle } = ansiParser(line, this.lastStyle);
        this.lastStyle = currentStyle;
        this.matchOutput(clientId, parts, dataLineIndex || index);
        // 一次渲染多个错误时，需要计算错误所在的行数
        // 因为终端窗口大小的关系，文字可能会换行，需要记录下实际的行数
        const lineText = parts.map((p) => p.content).join('');
        const dataRenderLineNum = Math.ceil(lineText.length / viewportCol);
        dataLineIndex += Math.max(1, dataRenderLineNum);
      });
    }
  }
  /**
   * 匹配错误日志， 两种情况
   * 1. 单行错误：匹配之后直接上报
   * 2. 多行错误：缓存当前匹配的 matcher，下一行继续使用
   *    2.1 如果匹配到，缓存该行内容
   *    2.2 如果没匹配到，直接上报前面多行的内容
   */
  private matchOutput(clientId: string, styleList: TextWithStyle[], dataLineIndex: number) {
    if (this.currentMatcher) {
      if (this.currentMatcher.match(styleList)) {
        this.outputRecordMap
          .get(clientId)
          ?.push({ type: this.currentMatcher.type, text: styleList.map((s) => s.content).join('') });
      } else {
        this.matchedEnd(clientId, this.currentMatcher);
      }
    } else {
      const matcher = this.outputMatcherList.find((m) => m.match(styleList));
      if (matcher) {
        this.registerMarker(clientId, dataLineIndex);
        this.outputRecordMap
          .get(clientId)
          ?.push({ type: matcher.type, text: styleList.map((s) => s.content).join('') });
        if (matcher.isMultiLine) {
          this.currentMatcher = matcher;
        } else {
          this.matchedEnd(clientId, matcher);
        }
      }
    }
  }

  private matchedEnd(clientId: string, matcher: LineMatcher) {
    const input = this.resolveDelControl(
      this.inputRecordMap
        .get(clientId)
        ?.map((r) => r.text)
        .join('\n'),
    );
    const output = this.outputRecordMap
      .get(clientId)
      ?.map((r) => r.text)
      .join('\n');
    this.addDecoration(clientId, matcher.type, input, output);
    this.report(matcher.type, input, output);
    this.resetState(clientId);
  }

  private addDecoration(clientId: string, type: MatcherType, input?: string, output?: string) {
    const client = this.terminalController.clients.get(clientId);
    const terminal = client?.term;
    const marker = this.clientCurrentMarker.get(clientId);

    if (terminal && output && marker) {
      const lines = output?.split('\n').length;

      this.terminalDecorations.addZoneDecoration(terminal, marker, lines, {
        text: 'AI Debug',
        onClick: () => {
          this.terminalDebug.debug(
            {
              type,
              input,
              errorText: output,
              operate: 'debug',
            },
            'terminal-explain',
          );
        },
      });
    }
  }

  private resolveDelControl(text = '') {
    const charArray = text.split('');
    let i = 0;

    while (i < charArray.length) {
      if (charArray[i].charCodeAt(0) === 127) {
        // 如果遇到 DEL 控制字符，删除其前面的字符
        const deleteIndex = Math.max(i - 1, 0);
        charArray.splice(deleteIndex, 1);
        i = deleteIndex;
      } else {
        i++;
      }
    }

    return charArray.join('');
  }

  private report(type: MatcherType, input?: string, output?: string) {
    // 上报埋点
  }

  private registerMarker(clientId: string, dataLineIndex: number) {
    const client = this.terminalController.clients.get(clientId);
    if (client) {
      const marker = client.term.registerMarker(dataLineIndex);

      this.clientCurrentMarker.set(clientId, marker);
      this.disposables.push(marker);
    }
  }

  private handleClientInput(clientId: string, data: string | ArrayBuffer) {
    const inputString = data.toString();
    const recordList = this.inputRecordMap.get(clientId);

    // 如果输入回车，则认为执行命令
    if (/[\r\n]/.test(inputString)) {
      this.isTyping = false;
      recordList?.push({ text: this.inputCache });
    } else {
      // 缓存输入
      this.inputCache += inputString;
      this.isTyping = true;
    }
  }
}
