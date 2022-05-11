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
  onClick?: () => void;
  onClose?: () => void;
  onInputBlur?: (id: string) => void;
  onInputEnter?: (id: string, name: string) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  provider: ITerminalRenderProvider;
}

export const ITerminalRenderProvider = Symbol('TerminalRenderProvider');
export interface ITerminalRenderProvider {
  infoItemRender: React.FunctionComponent<ItemProps>;
  addItemRender: React.FunctionComponent<ItemProps>;
}
