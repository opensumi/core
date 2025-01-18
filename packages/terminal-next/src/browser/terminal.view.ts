import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-browser';
import { derived, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

import {
  IShellLaunchConfig,
  ITerminalGroupViewService,
  ITerminalInternalService,
  IWidget,
  IWidgetGroup,
  userActionViewUuid,
} from '../common';

export class Widget extends Disposable implements IWidget {
  protected _group: WidgetGroup;
  protected _element: HTMLDivElement;
  protected _show: boolean;
  protected _error: boolean;

  readonly dynamic = observableValue<number>(this, 0);
  readonly shadowDynamic = observableValue<number>(this, 0);
  readonly name = observableValue<string>(this, '');
  readonly processName = observableValue<string>(this, '');

  constructor(public readonly id: string, public reuse: boolean = false, public recovery: boolean = false) {
    super();
  }

  get group() {
    return this._group;
  }

  set group(g: WidgetGroup) {
    this._group = g;
    g.addWidget(this);
  }

  get element() {
    return this._element;
  }

  set element(ele: HTMLDivElement) {
    if (!this._element) {
      this._element = ele;
      this._onRender.fire();
    }
  }

  get show() {
    return this._show;
  }

  set show(status: boolean) {
    this._show = status;
    this._onShow.fire(status);
  }

  get error() {
    return this._error;
  }

  set error(status: boolean) {
    this._error = status;
    this._onError.fire(status);
  }

  protected _onRender = new Emitter<void>();
  protected _onResize = new Emitter<void>();
  protected _onShow = new Emitter<boolean>();
  protected _onError = new Emitter<boolean>();
  onRender: Event<void> = this._onRender.event;
  onResize: Event<void> = this._onResize.event;
  onShow: Event<boolean> = this._onShow.event;
  onError: Event<boolean> = this._onError.event;

  resize(dynamic?: number) {
    transaction((tx) => {
      const dynamicValue = dynamic || this.shadowDynamic.get();

      this.dynamic.set(dynamicValue, tx);
      this.shadowDynamic.set(dynamicValue, tx);
    });
    this._onResize.fire();
  }

  increase(increment: number) {
    transaction((tx) => {
      const preValue = this.shadowDynamic.get();
      this.shadowDynamic.set(preValue + increment, tx);
    });
    this._onResize.fire();
  }

  rename(name: string) {
    transaction((tx) => {
      this.name.set(name, tx);
    });
  }
}

export class WidgetGroup extends Disposable implements IWidgetGroup {
  static whole = 100;
  static float = 1000;

  protected _id: string;
  protected _options: IShellLaunchConfig;
  protected _name: string;
  protected _activated: boolean;

  readonly widgets = observableValue<Widget[]>(this, []);
  readonly editable = observableValue<boolean>(this, false);
  readonly activated = observableValue<boolean>(this, false);
  readonly name = observableValue<string>(this, '');
  readonly currentId = observableValue<string>(this, '');

  widgetsMap: Map<string, Widget> = new Map();

  constructor(id?: string, options?: IShellLaunchConfig) {
    super();
    this._id = id || userActionViewUuid();
    this._options = options || {};
    this._activated = false;
  }

  get id() {
    return this._id;
  }

  get options() {
    return this._options;
  }

  get length() {
    return this.widgets.get().length;
  }

  get first() {
    return this.widgets.get()[0];
  }

  get last() {
    return this.widgets.get()[this.length - 1];
  }

  readonly current = derived(this, (reader) => {
    const currentId = this.currentId.read(reader);
    return this.widgetsMap.get(currentId);
  });

  readonly snapshot = derived(this, (reader) => {
    const current = this.current.read(reader);
    return this.name.read(reader) || current?.name.read(reader) || current?.processName.read(reader) || '';
  });

  addWidget(widget: Widget) {
    transaction((tx) => {
      const preWidgets = this.widgets.get();
      this.widgets.set([...preWidgets, widget], tx);
    });
    this.widgetsMap.set(widget.id, widget);

    if (!this.currentId.get()) {
      transaction((tx) => {
        this.currentId.set(widget.id, tx);
      });
    }
    this._averageLayout();
  }

  findWidget(widget: Widget) {
    return this.widgets.get().findIndex((item) => item.id === widget.id);
  }

  selectWidget(widget: Widget) {
    transaction((tx) => {
      this.currentId.set(widget.id, tx);
    });
  }

  removeWidgetByIndex(index: number) {
    const widgets = this.widgets.get();
    const widget = widgets.splice(index, 1);
    this.widgetsMap.delete(widget[0].id);
    transaction((tx) => {
      this.widgets.set(
        widgets.filter((w) => w !== widget[0]),
        tx,
      );
    });
    this._averageLayout();

    if (this.last) {
      this.selectWidget(this.last);
    }

    return widget[0];
  }

  edit() {
    transaction((tx) => {
      this.editable.set(true, tx);
    });
  }

  unedit() {
    transaction((tx) => {
      this.editable.set(false, tx);
    });
  }

  rename(name: string) {
    transaction((tx) => {
      this.name.set(name, tx);
      this.editable.set(false, tx);
    });
  }

  private _isLast(widget: Widget) {
    return widget.id === this.widgets.get()[this.widgets.get().length - 1].id;
  }

  private _averageLayout() {
    const average = Math.round((WidgetGroup.whole / this.widgets.get().length) * WidgetGroup.float) / WidgetGroup.float;
    this.widgets.get().forEach((widget) => {
      if (this._isLast(widget)) {
        widget.resize(WidgetGroup.whole - average * (this.widgets.get().length - 1));
      } else {
        widget.resize(average);
      }
    });
  }
}

@Injectable()
export class TerminalGroupViewService implements ITerminalGroupViewService {
  @Autowired(ITerminalInternalService)
  private readonly service: ITerminalInternalService;

  protected _widgets: Map<string, Widget> = new Map();

  readonly groups = observableValue<WidgetGroup[]>(this, []);
  readonly currentGroupIndex = observableValue<number>(this, -1);
  readonly currentGroupId = observableValue<string>(this, '');

  protected _onWidgetCreated = new Emitter<Widget>();
  protected _onWidgetSelected = new Emitter<Widget>();
  protected _onWidgetDisposed = new Emitter<Widget>();
  protected _onWidgetEmpty = new Emitter<void>();

  readonly currentGroup = derived(this, (reader) => {
    const groups = this.groups.read(reader);
    const index = this.currentGroupIndex.read(reader);
    return groups[index];
  });

  readonly currentWidget = derived(this, (reader) => {
    const group = this.currentGroup.read(reader);
    return group && this.getWidget(group.currentId.read(reader));
  });

  readonly currentWidgetId = derived(this, (reader) => {
    const group = this.currentGroup.read(reader);
    return group && group.currentId.read(reader);
  });

  onWidgetCreated = this._onWidgetCreated.event;
  onWidgetSelected = this._onWidgetSelected.event;
  onWidgetDisposed = this._onWidgetDisposed.event;
  onWidgetEmpty = this._onWidgetEmpty.event;

  getGroup(index: number): WidgetGroup {
    if (index > this.groups.get().length - 1) {
      throw new Error('out of groups length');
    }
    return this.groups.get()[index];
  }

  swapGroup(i: number, j: number) {
    const groups = this.groups.get();

    if (i === -1 || j === -1) {
      return;
    }

    const newGroups = [...groups];
    const temp = newGroups[i];
    newGroups[i] = newGroups[j];
    newGroups[j] = temp;

    transaction((tx) => {
      this.groups.set(newGroups, tx);
    });
  }

  private _doSelectGroup(index: number) {
    const group = this.getGroup(index);
    transaction((tx) => {
      this.currentGroupIndex.set(index, tx);
      this.currentGroupId.set(group.id, tx);
      group.activated.set(true, tx);
    });
    // 恢复的 group.current 为空，手动选择第一个 widget
    if (!group.current && group.first) {
      group.selectWidget(group.first);
    }
    const current = group.current.get();
    if (current) {
      this._onWidgetSelected.fire(current);
      this.resize();
    }
  }

  selectGroup(index: number) {
    this._doSelectGroup(index);
  }

  private _doCreateGroup(id?: string, options?: IShellLaunchConfig) {
    const group = new WidgetGroup(id, options);
    transaction((tx) => {
      const preGroups = this.groups.get();
      this.groups.set([...preGroups, group], tx);
    });
    return this.groups.get().length - 1;
  }

  createGroup(options?: IShellLaunchConfig) {
    const index = this._doCreateGroup(undefined, options);
    this.getGroup(index);
    return index;
  }

  private _checkIfEmpty(index: number) {
    if (this.empty()) {
      this._onWidgetEmpty.fire();
    } else {
      const currentGroupIndex = this.currentGroupIndex.get();
      if (index === currentGroupIndex) {
        this._doSelectGroup(this.groups.get().length - 1);
      }
      if (index < currentGroupIndex) {
        this._doSelectGroup(currentGroupIndex - 1);
      }
    }
  }

  private _doRemoveGroup(index: number) {
    const preGroups = this.groups.get();

    const [group] = preGroups.splice(index, 1);

    if (group) {
      group.widgets.get().forEach((widget) => {
        this._widgets.delete(widget.id);
        widget.dispose();
        this._onWidgetDisposed.fire(widget);
      });
      group.dispose();

      transaction((tx) => {
        this.groups.set(
          preGroups.filter((g) => g.id !== group.id),
          tx,
        );
      });
    }

    this._checkIfEmpty(index);
  }

  removeGroup(index: number) {
    this._doRemoveGroup(index);
  }

  getWidget(id: string) {
    const widget = this._widgets.get(id);

    if (!widget) {
      throw new Error('not find this widget');
    }

    return widget;
  }

  selectWidget(id: string) {
    const widget = this.getWidget(id);
    const group = widget.group;
    const index = this.groups.get().findIndex((g) => g.id === group.id);
    group.selectWidget(widget);
    this.selectGroup(index);
  }

  createWidget(group: WidgetGroup, id?: string, reuse?: boolean, isSimpleWidget = false, recovery = false) {
    const widget = new Widget(id || this.service.generateSessionId(), reuse, recovery);
    this._widgets.set(widget.id, widget);
    widget.group = group;
    if (!isSimpleWidget) {
      this._onWidgetCreated.fire(widget);
    }
    return widget;
  }

  private _checkIfGroupEmpty(index: number) {
    const group = this.getGroup(index);
    if (group.length === 0) {
      this._doRemoveGroup(index);
    }
  }

  removeWidget(id: string) {
    const widget = this.getWidget(id);
    const group = widget.group;

    const groupIndex = this.groups.get().findIndex((g) => group.id === g.id);
    const index = group.findWidget(widget);
    group.removeWidgetByIndex(index);

    this._widgets.delete(id);
    widget.dispose();
    this._onWidgetDisposed.fire(widget);
    this._checkIfGroupEmpty(groupIndex);

    const current = group.current.get();
    if (current) {
      this._onWidgetSelected.fire(current);
    }
  }

  resize() {
    const group = this.currentGroup.get();
    if (group) {
      group.widgets.get().forEach((widget) => {
        widget.resize();
      });
    }
  }

  empty() {
    return this._widgets.size === 0;
  }

  clear() {
    transaction((tx) => {
      this.groups.set([], tx);
    });
    this._widgets.clear();
    this._onWidgetEmpty.fire();
  }
}
