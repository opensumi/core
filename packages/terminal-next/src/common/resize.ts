export interface IWidget {
  id: string;
  dynamic: number;
  resize: (dynamic: number) => void;
}

export interface IWidgetGroup {
  id: string;
  widgets: IWidget[];
  firstInitialize: () => void;
  createWidget: () => void;
  removeWidgetByIndex: (index: number) => void;
}
