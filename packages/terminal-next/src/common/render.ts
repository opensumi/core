import { ThemeType } from '@opensumi/ide-theme/lib/common';

import { TerminalOptions } from './pty';

export enum ItemType {
  info = 0,
  add,
}

export interface ItemProps {
  id?: string;
  name?: string;
  selected?: boolean;
  type?: ItemType;
  editable?: boolean;
  options?: TerminalOptions;
  onClick?: () => void;
  onClose?: () => void;
  onInputBlur?: (id: string) => void;
  onInputEnter?: (id: string, name: string) => void;
  onDropdown?: (event: React.MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  provider: ITerminalRenderProvider;
  theme: ThemeType;
}

export const ITerminalRenderProvider = Symbol('TerminalRenderProvider');
export interface ITerminalRenderProvider {
  infoItemRender: React.FunctionComponent<ItemProps>;
  addItemRender: React.FunctionComponent<ItemProps>;
}
