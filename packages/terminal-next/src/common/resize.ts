export interface IWidget {
  id: string;
  dynamic: number;
  name: string;
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
  snapshot: string;
  createWidget: () => IWidget;
  removeWidgetByIndex: (index: number) => IWidget;
  dispose: () => void;
}
