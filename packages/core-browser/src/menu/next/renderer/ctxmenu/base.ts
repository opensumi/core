import { IContextKeyService } from '../../../../context-key';
import { MenuNode } from '../../base';
import { MenuId } from '../../menu-id';
import { IMenuNodeOptions } from '../../menu.interface';

export interface CtxMenuParams extends IMenuNodeOptions {
  menuNodes: MenuNode[] | MenuId | string;
  contextKeyService?: IContextKeyService; // 直接传递 MenuId 时可传递 scopedContextKeyService
}

export interface CtxMenuRenderParams extends CtxMenuParams {
  anchor: MouseEvent | { x: number; y: number };
  onHide?: (canceled: boolean) => void;
}

export abstract class ICtxMenuRenderer {
  abstract show(payload: CtxMenuRenderParams): void;
}
