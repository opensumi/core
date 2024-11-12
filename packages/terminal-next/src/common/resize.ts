import { Disposable, Event } from '@opensumi/ide-core-common';
import { IObservable, ISettableObservable } from '@opensumi/ide-monaco/lib/common/observable';

import { IShellLaunchConfig } from './pty';

export interface IWidget extends Disposable {
  dynamic: IObservable<number>;
  shadowDynamic: IObservable<number>;
  name: ISettableObservable<string>;
  processName: ISettableObservable<string>;

  id: string;
  element: HTMLDivElement;
  group: IWidgetGroup;
  reuse: boolean;
  recovery: boolean;
  show: boolean;
  error: boolean;

  resize: (dynamic?: number) => void;
  increase: (increment: number) => void;
  rename(name: string): void;
  dispose: () => void;
  onRender: Event<void>;
  onResize: Event<void>;
  onShow: Event<boolean>;
  onError: Event<boolean>;
}

export interface IWidgetGroup extends Disposable {
  name: IObservable<string>;
  snapshot: IObservable<string>;
  activated: IObservable<boolean>;
  editable: IObservable<boolean>;
  widgets: IObservable<IWidget[]>;

  id: string;
  options?: IShellLaunchConfig;
  length: number;
  widgetsMap: Map<string, IWidget>;
  last: IWidget;
  addWidget(widget: IWidget): void;
  removeWidgetByIndex: (index: number) => IWidget;
  edit(): void;
  unedit(): void;
  rename(name: string): void;
  dispose: () => void;
}
