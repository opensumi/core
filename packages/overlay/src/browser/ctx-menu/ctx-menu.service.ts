import { Injectable } from '@opensumi/di';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { CtxMenuRenderParams } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { observableValue, transaction } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';

@Injectable()
export class BrowserCtxMenuService implements IBrowserCtxMenu {
  readonly visibleObservable = observableValue<boolean>(this, false);
  get visible() {
    return this.visibleObservable.get();
  }

  onHide: ((canceled: boolean) => void) | undefined = undefined;

  point: { pageX: number; pageY: number } | undefined = undefined;
  context: any = undefined;
  menuNodes: MenuNode[] = [];

  public show(payload: CtxMenuRenderParams): void {
    const { anchor, onHide, args: context, menuNodes } = payload;
    // 上层调用前已经将 MenuNodes 处理为数组了
    if (!Array.isArray(menuNodes) || !menuNodes.length) {
      return;
    }

    this.context = context;
    this.menuNodes.splice(0, this.menuNodes.length, ...menuNodes);
    const { x, y } = anchor instanceof window.MouseEvent ? { x: anchor.clientX, y: anchor.clientY } : anchor;
    this.onHide = onHide;
    this.point = { pageX: x, pageY: y };
    transaction((tx) => {
      this.visibleObservable.set(true, tx);
    });
  }

  public hide(canceled: boolean) {
    if (typeof this.onHide === 'function') {
      this.onHide(canceled);
    }
    this.reset();
  }

  private reset() {
    transaction((tx) => {
      this.visibleObservable.set(false, tx);
    });
  }
}
