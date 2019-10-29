import { Injectable, Autowired } from '@ali/common-di';
import { Menu as MenuWidget } from '@phosphor/widgets';

import { KeybindingRegistry, ResolvedKeybinding } from '../../../../keybinding';
import { MenuNode } from '../../base';
import { ICtxMenuRenderer, CtxMenuRenderParams } from './base';

export abstract class IBrowserCtxMenuRenderer extends ICtxMenuRenderer {
  visible: boolean;
  onHide: (() => void) | undefined;
  point?: {
    pageX: number;
    pageY: number;
  };
  context: any;
  menuNodes: MenuNode[];
  abstract hide(): void;
}

@Injectable()
export class CtxMenuRenderer implements ICtxMenuRenderer {
  @Autowired(KeybindingRegistry)
  protected readonly keybindings: KeybindingRegistry;

  @Autowired(IBrowserCtxMenuRenderer)
  protected readonly browserCtxMenuRenderer: IBrowserCtxMenuRenderer;

  public show(payload: CtxMenuRenderParams): void {
    this.browserCtxMenuRenderer.show(payload);
  }

  constructor() {
    // todo: 这段逻辑放到 menu service 取 menuNodes 时去做
    MenuWidget.Renderer.prototype.formatShortcut = (data) => {
      if (data.item && data.item.command) {
        const keybinding = this.keybindings.getKeybindingsForCommand(data.item.command) as ResolvedKeybinding[];
        if (keybinding.length > 0) {
          return keybinding[0]!.resolved![0].toString();
        }
      }
      return '';
    };
  }
}
