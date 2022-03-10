import { Injectable, Autowired } from '@opensumi/di';
import { IContextKey } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { DebugStackFrame, DebugThread } from '../../model';

import { CONTEXT_STACK_FRAME_SUPPORTS_RESTART, CONTEXT_CALLSTACK_ITEM_TYPE } from './../../../common/constants';
import { DebugContextKey } from './../../contextkeys/debug-contextkey.service';
import { DebugSession } from './../../debug-session';

@Injectable()
export class DebugCallStackService {
  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(DebugContextKey)
  private readonly debugContextKey: DebugContextKey;

  private stackFrameSupportsRestart: IContextKey<boolean>;
  private callStackItemType: IContextKey<string>;

  constructor() {
    if (!this.stackFrameSupportsRestart) {
      this.stackFrameSupportsRestart = CONTEXT_STACK_FRAME_SUPPORTS_RESTART.bind(this.debugContextKey.contextKeyScoped);
    }
    if (!this.callStackItemType) {
      this.callStackItemType = CONTEXT_CALLSTACK_ITEM_TYPE.bind(this.debugContextKey.contextKeyScoped);
    }
  }

  public handleContextMenu = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: DebugSession | DebugStackFrame | DebugThread,
  ): void => {
    this.stackFrameSupportsRestart.reset();
    event.stopPropagation();
    event.preventDefault();

    if (data instanceof DebugSession) {
      this.callStackItemType.set('session');
    } else if (data instanceof DebugThread) {
      this.callStackItemType.set('thread');
    } else if (data instanceof DebugStackFrame) {
      this.callStackItemType.set('stackFrame');
      this.stackFrameSupportsRestart.set(data.canRestart);
    } else {
      this.callStackItemType.reset();
    }

    const { x, y } = event.nativeEvent;

    const menus = this.contextMenuService.createMenu({
      id: MenuId.DebugCallStackContext,
      contextKeyService: this.debugContextKey.contextKeyScoped,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    const toArgs = () => {
      if (data instanceof DebugStackFrame) {
        if (data.source?.inMemory) {
          return data.source.raw.path || data.source.reference || data.source.name;
        }

        return data.source ? data.source.uri.toString() : '';
      }
      if (data instanceof DebugThread) {
        return data.id;
      }
      if (data instanceof DebugSession) {
        return data.id;
      }

      return '';
    };

    const toAgrsContext = () =>
      data instanceof DebugStackFrame
        ? {
            sessionId: data.session.id,
            threadId: data.thread.id,
            frameId: data.id,
          }
        : data instanceof DebugThread
        ? {
            sessionId: data.session.id,
            threadId: data.id,
          }
        : data instanceof DebugSession
        ? {
            sessionId: data.id,
          }
        : undefined;

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [toArgs(), toAgrsContext()],
      contextKeyService: this.debugContextKey.contextKeyScoped,
    });
  };
}
