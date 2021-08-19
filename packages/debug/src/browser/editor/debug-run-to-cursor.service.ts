import { DebugBreakpoint } from './../breakpoint/breakpoint-marker';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { Position } from '@ali/monaco-editor-core/esm/vs/editor/common/core/position';
import { URI } from '@ali/ide-core-common';
import { DebugSessionManager } from './../debug-session-manager';
import { Injectable, Autowired } from '@ali/common-di';
import { IDebugSessionManager, DebugState } from './../../common/debug-session';

@Injectable()
export class DebugRunToCursorService {

  @Autowired(IDebugSessionManager)
  protected readonly sessionManager: DebugSessionManager;

  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

  constructor() {}

  public async run(uri: URI): Promise<void> {
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

    const bpExists = !!(sessionModel.getBreakpoints(uri, { column: position.column, lineNumber: position.lineNumber }).length);

    let breakpointToRemove: DebugBreakpoint | undefined;
    let threadToContinue = currentSession.currentThread;
    if (!bpExists) {
      const addResult = await this.addBreakpoints(uri, position);
      if (!addResult) {
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
      const pausedInThisFile = threads.find((t) => {
        return t.topFrame;
      });

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

}
