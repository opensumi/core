import { IDisposable } from '@ali/ide-core-common';

export type ResizeDelegate = (exvent: (width: number) => void) => IDisposable;

export interface IWidget {
  id: string;
  name: string;
  drawed: boolean;
  styles: {
    flex: number,
  };

  focus(): void;
  resize(Iincrement: number): void;
  draw(dom: HTMLDivElement | null): void;
  erase(): void;
}

export interface IWidgetGroup {
  id: string;

  members: IWidget[];
  snapshot(): string;
}
