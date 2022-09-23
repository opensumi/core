import { ThemeType } from '@opensumi/ide-theme/lib/common';

import { IShellLaunchConfig } from './pty';

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
  options?: IShellLaunchConfig;
  onClick?: () => void;
  onClose?: () => void;
  onInputBlur?: (id: string) => void;
  onInputEnter?: (id: string, name: string) => void;
  onDropdown?: (event: React.MouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  getKeybinding?: (command: string) => string;
  provider: ITerminalRenderProvider;
  theme: ThemeType;
}

export const ITerminalRenderProvider = Symbol('TerminalRenderProvider');
export interface ITerminalRenderProvider {
  infoItemRender: React.FunctionComponent<ItemProps>;
  addItemRender: React.FunctionComponent<ItemProps>;
}
