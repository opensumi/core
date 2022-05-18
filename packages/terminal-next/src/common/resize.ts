import { Event } from '@opensumi/ide-core-common';
import { Disposable } from '@opensumi/ide-core-common';

import { IShellLaunchConfig } from './pty';

export interface IWidget extends Disposable {
  id: string;
  name: string;
  processName?: string;
  dynamic: number;
  shadowDynamic: number;
  element: HTMLDivElement;
  group: IWidgetGroup;
  reuse: boolean;
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
  id: string;
  name: string;
  options?: IShellLaunchConfig;
  editable: boolean;
  activated: boolean;
  length: number;
  widgets: IWidget[];
  widgetsMap: Map<string, IWidget>;
  last: IWidget;
  snapshot: string;
  addWidget(widget: IWidget): void;
  removeWidgetByIndex: (index: number) => IWidget;
  edit(): void;
  unedit(): void;
  rename(name: string): void;
  dispose: () => void;
}
