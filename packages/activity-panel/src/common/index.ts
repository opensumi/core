export interface View {
  id: string;
  name?: string;
  component?: React.FunctionComponent;
}

export interface ViewContainerOptions {
  iconClass?: string;
  icon?: string;
  weight?: number;
  containerId: string | number;
  title: string;
}
