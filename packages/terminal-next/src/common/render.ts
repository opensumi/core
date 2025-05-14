import { ThemeType } from '@opensumi/ide-theme/lib/common';

import { IWidgetGroup } from '../index';

export enum ItemType {
  info = 0,
  add,
}

export interface ItemProps {
  group?: IWidgetGroup;
  selected?: boolean;
  type?: ItemType;
  onClick?: () => void;
  onClose?: () => void;
  onInputBlur?: (id: string) => void;
  onInputEnter?: (id: string, name: string) => void;
  onDropdown?: (event: React.MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  getKeybinding?: (command: string) => string;
  onDrop?: (event: React.DragEvent) => void;
  onDragStart?: (event: React.DragEvent) => void;
  provider: ITerminalRenderProvider;
  theme: ThemeType;
  draggable?: boolean;
}

export const ITerminalRenderProvider = Symbol('TerminalRenderProvider');
export interface ITerminalRenderProvider {
  infoItemRender: React.FunctionComponent<ItemProps>;
  addItemRender: React.FunctionComponent<ItemProps>;
}
