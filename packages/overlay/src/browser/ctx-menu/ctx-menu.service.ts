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
  onHide: (() => void) | undefined = undefined;

  @observable
  position: React.CSSProperties | undefined = undefined;

  @observable
  context: any = undefined;

  @observable
  menuNodes: MenuNode[] = observable.array([]);

  @action
  public show(payload: CtxMenuRenderParams): void {
    const { anchor, onHide, context, menuNodes } = payload;

    this.context = context;
    this.menuNodes.splice(0, this.menuNodes.length, ...menuNodes);
    const { x, y } = anchor instanceof MouseEvent ? { x: anchor.clientX, y: anchor.clientY } : anchor;
    this.onHide = onHide;
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
    // this.onHide = undefined;
    // this.context = undefined;
    // this.position = undefined;
    // this.menuNodes.splice(0, this.menuNodes.length);
  }
}
