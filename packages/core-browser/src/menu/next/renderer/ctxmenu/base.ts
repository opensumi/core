import { MenuNode } from '../../base';
import { IContextKeyService } from '../../../../context-key';
import { MenuId } from '../../menu-id';

export interface CtxMenuParams {
  menuNodes: MenuNode[] | MenuId | string;
  contextKeyService?: IContextKeyService; // 直接传递 MenuId 时可传递 scopedContextKeyService
  context?: any[]; // 额外的参数传递给 menu 执行 execute 时调用
}

export interface CtxMenuRenderParams extends CtxMenuParams {
  anchor: MouseEvent | { x: number, y: number };
  onHide?: () => void;
}

export abstract class ICtxMenuRenderer {
  abstract show(payload: CtxMenuRenderParams): void;
}
