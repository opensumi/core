import { observable, computed } from 'mobx';
import { Disposable, uuid } from '@ali/ide-core-common';
import { IWidget, IWidgetGroup } from '../../common/resize';

export class Widget extends Disposable implements IWidget {
  private _id: string;

  @observable
  state: { dynamic: number, shadowDynamic: number };

  constructor(id?: string) {
    super();
    this._id = id || uuid();
    this.state = observable.object({ dynamic: 0, shadowDynamic: 0 });
  }

  get id() {
    return this._id;
  }

  @computed
  get dynamic() {
    return this.state.dynamic;
  }

  set dynamic(d: number) {
    this.state.dynamic = d;
  }

  @computed
  get shadowDynamic() {
    return this.state.shadowDynamic;
  }

  set shadowDynamic(d: number) {
    this.state.shadowDynamic = d;
  }

  resize(dynamic?: number) {
    this.dynamic = dynamic || this.shadowDynamic;
    this.shadowDynamic = this.dynamic;
  }

  increase(increment: number) {
    this.shadowDynamic += increment;
  }
}

export class WidgetGroup extends Disposable implements IWidgetGroup {

  static whole = 100;
  static float = 1000;

  private _id = uuid();

  @observable
  widgets: Widget[];

  widgetsMap: Map<string, Widget>;

  constructor() {
    super();

    this.widgets = observable.array([]);
    this.widgetsMap = new Map();
  }

  get id() {
    return this._id;
  }

  get length() {
    return this.widgets.length;
  }

  get last() {
    return this.widgets[this.length - 1];
  }

  createWidget(idOrWidget?: string | Widget) {
    const widget = (idOrWidget && typeof idOrWidget !== 'string') ? idOrWidget : new Widget(idOrWidget);
    this.widgets.push(widget);
    this.widgetsMap.set(widget.id, widget);
    this._averageLayout();

    return widget;
  }

  removeWidgetByIndex(index: number) {
    const widget = this.widgets.splice(index, 1);
    this.widgetsMap.delete(widget[0].id);
    widget[0].dispose();
    this._averageLayout();

    return widget[0];
  }

  private _isLast(widget: Widget) {
    return widget.id === this.widgets[this.widgets.length - 1].id;
  }

  private _averageLayout() {
    const average = Math.round((WidgetGroup.whole / this.widgets.length)
      * WidgetGroup.float) / WidgetGroup.float;
    this.widgets.forEach((widget) => {
      if (this._isLast(widget)) {
        widget.resize(WidgetGroup.whole - average * (this.widgets.length - 1));
      } else {
        widget.resize(average);
      }
    });
  }
}
