import { MenuNode } from '../../base';

export interface CtxMenuParams {
  menuNodes: MenuNode[];
  context?: any; // 额外的参数传递给 menu 执行 execute 时调用
}

export interface CtxMenuRenderParams extends CtxMenuParams {
  anchor: MouseEvent | { x: number, y: number };
  onHide?: () => void;
}

export abstract class ICtxMenuRenderer {
  abstract show(payload: CtxMenuRenderParams): void;
}
