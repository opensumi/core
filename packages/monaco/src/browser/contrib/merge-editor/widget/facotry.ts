import { Injector } from '@opensumi/di';
import { ConstructorOf, Position } from '@opensumi/ide-core-browser';

import { LineRange } from '../model/line-range';

import { ResolveResultWidget } from './resolve-result-widget';
import { IMergeEditorShape } from './types';

export interface IWidgetFactory {
  hideWidget(id?: string): void;
  addWidget(range: LineRange, ...args: any[]): void;
  hasWidget(range: LineRange): boolean;
}

export type IWidgetPositionFactory = (range: LineRange) => Position;

export const defaultPositionFactory: IWidgetPositionFactory = (range) => new Position(range.endLineNumberExclusive, 1);

export class WidgetFactory implements IWidgetFactory {
  private widgetMap: Map<string, ResolveResultWidget>;

  constructor(
    private contentWidget: ConstructorOf<ResolveResultWidget>,
    private editor: IMergeEditorShape,
    private injector: Injector,
    protected positionFactory = defaultPositionFactory,
  ) {
    this.widgetMap = new Map();
  }

  hasWidget(range: LineRange): boolean {
    return this.widgetMap.get(range.id) !== undefined;
  }

  public hideWidget(id?: string): void {
    if (id) {
      const widget = this.widgetMap.get(id);
      if (widget) {
        widget.hide();
        this.widgetMap.delete(id);
      }
      return;
    }

    this.widgetMap.forEach((widget) => {
      widget.hide();
    });
    this.widgetMap.clear();
  }

  public addWidget(lineRange: LineRange, ...args: any[]): void {
    const id = lineRange.id;
    if (this.widgetMap.has(id)) {
      return;
    }

    const position = this.positionFactory(lineRange);

    const widget = this.injector.get(this.contentWidget, [id, this.editor, lineRange, ...args]);
    widget.show({ position });

    this.widgetMap.set(id, widget);
  }
}
