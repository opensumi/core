import { observable, computed } from 'mobx';
import { Disposable, uuid } from '@ali/ide-core-common';
import { IWidget, IWidgetGroup } from '../../common/resize';

export class Widget extends Disposable implements IWidget {
  private _id = uuid();

  @observable
  state: { dynamic: number } = { dynamic: 0 };

  get id() {
    return this._id;
  }

  @computed
  get dynamic() {
    return this.state.dynamic;
  }

  resize(dynamic: number) {
    this.state.dynamic = dynamic;
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

  firstInitialize() {
    this.createWidget();
  }

  createWidget() {
    const widget = new Widget();
    this.widgets.push(widget);
    this.widgetsMap.set(widget.id, widget);
    this._averageLayout();
  }

  removeWidgetByIndex(index: number) {
    const widget = this.widgets.splice(index, 1);
    this.widgetsMap.delete(widget[0].id);
    widget[0].dispose();
    this._averageLayout();
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
