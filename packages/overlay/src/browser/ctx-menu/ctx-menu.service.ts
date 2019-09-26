import { observable, action } from 'mobx';
import { Injectable } from '@ali/common-di';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import { CtxMenuRenderParams } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { IBrowserCtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

@Injectable()
export class BrowserCtxMenuService implements IBrowserCtxMenuRenderer {
  @observable
  visible: boolean = false;

  @observable
  onHide: (() => any) | null = null;

  @observable
  position: React.CSSProperties | null = null;

  @observable
  context: any;

  @observable
  menuNodes: MenuNode[] = observable.array([]);

  @action
  public show(payload: CtxMenuRenderParams): void {
    const { anchor, onHide, context, menuNodes } = payload;

    this.context = context;
    this.menuNodes.splice(0, this.menuNodes.length, ...menuNodes);
    const { x, y } = anchor instanceof MouseEvent ? { x: anchor.clientX, y: anchor.clientY } : anchor;
    if (onHide) {
      this.onHide = onHide;
    }
    this.position = { left: x, top: y };
    this.visible = true;
  }

  @action
  public hide() {
    if (typeof this.onHide === 'function') {
      this.onHide();
    }
    this.reset();
  }

  @action
  private reset() {
    this.visible = false;
    this.onHide = null;
    this.context = null;
    this.position = null;
    this.menuNodes.splice(0, this.menuNodes.length);
  }
}
