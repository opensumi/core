import { Injectable, Autowired } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';

import { IDebugBreakpoint } from '../../common';

import { IDebugSessionManager, DebugState } from './../../common/debug-session';
import { DebugBreakpoint } from './../breakpoint/breakpoint-marker';
import { DebugSessionManager } from './../debug-session-manager';
import { DebugBreakpointsService } from './../view/breakpoints/debug-breakpoints.service';

@Injectable()
export class DebugRunToCursorService {
  @Autowired(IDebugSessionManager)
  protected readonly sessionManager: DebugSessionManager;

  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(DebugBreakpointsService)
  protected readonly debugBreakpointsService: DebugBreakpointsService;

  constructor() {}

  /**
   * @param uri
   * @param isForce 为 true 表示强制运行到光标处，不管中间有没有启用的断点，它就是要畅通无阻
   * @returns
   */
  public async run(uri: URI, isForce = false): Promise<void> {
    const currentSession = this.sessionManager.currentSession;
    if (!currentSession) {
      return;
    }

    if (currentSession.state !== DebugState.Stopped) {
      return;
    }

    const currentEditor = this.workbenchEditorService.currentEditor;

    if (!currentEditor) {
      return;
    } else if (!currentEditor.monacoEditor) {
      return;
    }

    const { monacoEditor } = currentEditor;

    const position = monacoEditor.getPosition();
    if (!(monacoEditor.hasModel() && position)) {
      return;
    }

    const sessionModel = currentSession.getModel();
    if (!sessionModel) {
      return;
    }

    const bpExists = !!sessionModel.getBreakpoints(uri, { column: position.column, lineNumber: position.lineNumber })
      .length;

    let breakpointToRemove: IDebugBreakpoint | undefined;
    let threadToContinue = currentSession.currentThread;
    let enabledBreakpoints: IDebugBreakpoint[] = [];

    if (!bpExists) {
      if (isForce) {
        enabledBreakpoints = sessionModel
          .getBreakpoints()
          .filter((bk) => bk.enabled)
          .filter((bk) => bk.raw.column !== position.column && bk.raw.line !== position.lineNumber);
        // 先将所有断点禁用，并收集起来，continue 之后再恢复状态
        enabledBreakpoints.forEach((bk) => {
          this.debugBreakpointsService.toggleBreakpointEnable(bk);
        });
      }

      const addResult = await this.addBreakpoints(uri, position);
      if (!addResult) {
        this.recoverStatus(enabledBreakpoints);
        return;
      }

      if (addResult.thread) {
        threadToContinue = addResult.thread;
      }

      if (addResult.breakpoint) {
        breakpointToRemove = addResult.breakpoint;
      }
    }

    if (!threadToContinue) {
      this.recoverStatus(enabledBreakpoints);
      return;
    }

    const oneTimeListener = threadToContinue.session.onDidChangeState(() => {
      const state = currentSession.state;
      if (state === DebugState.Stopped || state === DebugState.Inactive) {
        if (breakpointToRemove) {
          currentSession.delBreakpoint(breakpointToRemove);
        }
        oneTimeListener.dispose();
      }
    });

    await threadToContinue.continue();
    this.recoverStatus(enabledBreakpoints);
  }

  private async addBreakpoints(uri: URI, position: Position) {
    const currentSession = this.sessionManager.currentSession;

    if (!currentSession) {
      return;
    }

    let column = 1;
    const currentFrame = currentSession.currentFrame;
    if (currentFrame && currentFrame.range().startLineNumber === position.lineNumber) {
      // https://github.com/microsoft/vscode/issues/102199
      column = position.column || 1;
    }

    const bp = DebugBreakpoint.create(uri, { line: position.lineNumber, column });

    await currentSession.addBreakpoint(bp, true);
    if (!bp) {
      return { breakpoint: undefined, thread: currentSession.currentThread };
    }

    // Look at paused threads for sessions that verified this bp. Prefer, in order:
    const enum Score {
      /** The focused thread */
      Focused,
      /** Any other stopped thread of a session that verified the bp */
      Verified,
      /** Any thread that verified and paused in the same file */
      VerifiedAndPausedInFile,
      /** The focused thread if it verified the breakpoint */
      VerifiedAndFocused,
    }

    let bestThread = currentSession.currentThread;
    let bestScore = Score.Focused;

    const threads = currentSession.threads.filter((t) => t.stopped);
    if (bestScore < Score.VerifiedAndFocused) {
      if (currentSession.currentThread && threads.includes(currentSession.currentThread)) {
        bestThread = currentSession.currentThread;
        bestScore = Score.VerifiedAndFocused;
      }
    }

    if (bestScore < Score.VerifiedAndPausedInFile) {
      const pausedInThisFile = threads.find((t) => t.topFrame);

      if (pausedInThisFile) {
        bestThread = pausedInThisFile;
        bestScore = Score.VerifiedAndPausedInFile;
      }
    }

    if (bestScore < Score.Verified) {
      bestThread = threads[0];
      bestScore = Score.VerifiedAndPausedInFile;
    }

    return { thread: bestThread, breakpoint: bp };
  }

  private recoverStatus(bks: IDebugBreakpoint[]): void {
    bks.forEach((bk) => {
      this.debugBreakpointsService.toggleBreakpointEnable(bk);
    });
  }
}
