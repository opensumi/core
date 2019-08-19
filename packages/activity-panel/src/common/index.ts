import { URI } from '@ali/ide-core-common';

export interface View {
  id: string;
  name?: string;
  component: React.FunctionComponent<any>;
}

export interface ViewContainerOptions {
  iconClass?: string;
  icon?: URI;
  weight?: number;
  containerId?: string | number;
  title?: string;
  size?: number;
}

export interface ViewState {
  width: number;
  height: number;
  // TODO 关联viewId到containerId实现
  visible: boolean;
  opened: boolean;
}
