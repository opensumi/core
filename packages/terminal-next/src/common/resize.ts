export interface IWidget {
  id: string;
  dynamic: number;
  shadowDynamic: number;
  resize: (dynamic?: number) => void;
  increase: (increment: number) => void;
  dispose: () => void;
}

export interface IWidgetGroup {
  id: string;
  length: number;
  widgets: IWidget[];
  last: IWidget;
  createWidget: () => IWidget;
  removeWidgetByIndex: (index: number) => IWidget;
  dispose: () => void;
}
