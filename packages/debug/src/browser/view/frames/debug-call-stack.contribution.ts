import { Autowired } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry, localize, IClipboardService } from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { DEBUG_COMMANDS } from '../../debug-contribution';

import {
  CONTEXT_CALLSTACK_ITEM_TYPE,
  CONTEXT_RESTART_FRAME_SUPPORTED,
  CONTEXT_STACK_FRAME_SUPPORTS_RESTART,
} from './../../../common/constants';
import { IDebugSessionManager } from './../../../common/debug-session';
import { CallStackContext } from './../../../common/types';
import { DebugSessionManager } from './../../debug-session-manager';
import { DebugStackFrame } from './../../model/debug-stack-frame';
import { DebugThread } from './../../model/debug-thread';

function isStackFrameContext(obj: any): obj is CallStackContext {
  return (
    obj && typeof obj.sessionId === 'string' && typeof obj.threadId === 'string' && typeof obj.frameId === 'string'
  );
}

function getFrame(debugService: DebugSessionManager, context: CallStackContext | unknown): DebugStackFrame | undefined {
  if (isStackFrameContext(context)) {
    const session = debugService.getSession(context.sessionId);
    if (session) {
      const thread = [session.currentThread, ...session.threads].find((t: DebugThread) => t.id === context.threadId);
      if (thread) {
        return thread.frames.find((sf: DebugStackFrame) => sf.id === context.frameId);
      }
    }
  }

  return undefined;
}

@Domain(MenuContribution, CommandContribution)
export class DebugCallStackContribution implements MenuContribution, CommandContribution {
  @Autowired(IDebugSessionManager)
  protected readonly debugSessionManager: DebugSessionManager;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(DEBUG_COMMANDS.RESTART_FRAME, {
      execute: async (_: string, context: CallStackContext) => {
        const frame = getFrame(this.debugSessionManager, context);
        if (frame) {
          await frame.restart();
        }
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COPY_STACK_TRACE, {
      execute: async (_: string, context: CallStackContext) => {
        const frame = getFrame(this.debugSessionManager, context);
        if (frame) {
          const callStacks = frame.thread.frames.map(
            (e: DebugStackFrame) =>
              `${e.raw && e.raw.name} (${e.raw && e.raw.source && e.raw.source.path}:${e.raw && e.raw.line})`,
          );
          this.clipboardService.writeText(callStacks.join('\n'));
        }
      },
    });
  }

  registerMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.DebugCallStackContext, {
      command: {
        id: DEBUG_COMMANDS.RESTART_FRAME.id,
        label: localize('deugger.menu.restartFrame'),
      },
      when: `${CONTEXT_CALLSTACK_ITEM_TYPE.equalsTo('stackFrame')} && ${CONTEXT_RESTART_FRAME_SUPPORTED.raw}`,
      enabledWhen: CONTEXT_STACK_FRAME_SUPPORTS_RESTART.raw,
      order: 10,
    });
    registry.registerMenuItem(MenuId.DebugCallStackContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_STACK_TRACE.id,
        label: localize('deugger.menu.copyCallstack'),
      },
      when: CONTEXT_CALLSTACK_ITEM_TYPE.equalsTo('stackFrame'),
      order: 20,
    });
  }
}
