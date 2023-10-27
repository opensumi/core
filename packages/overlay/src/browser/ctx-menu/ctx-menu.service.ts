import { observable, action } from 'mobx';

import { Injectable } from '@opensumi/di';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { CtxMenuRenderParams } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

@Injectable()
export class BrowserCtxMenuService implements IBrowserCtxMenu {
  @observable
  visible = false;

  @observable
  onHide: ((canceled: boolean) => void) | undefined = undefined;

  @observable
  point: { pageX: number; pageY: number } | undefined = undefined;

  @observable
  context: any = undefined;

  @observable
  menuNodes: MenuNode[] = observable.array([]);

  @action
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
    this.visible = true;
  }

  @action.bound
  public hide(canceled: boolean) {
    if (typeof this.onHide === 'function') {
      this.onHide(canceled);
    }
    this.reset();
  }

  @action.bound
  private reset() {
    this.visible = false;
  }
}
