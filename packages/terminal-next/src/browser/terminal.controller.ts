import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, uuid, Emitter } from '@ali/ide-core-common';
import { CommandService } from '@ali/ide-core-browser';
import { toggleBottomPanel } from './terminal.command';
import { ITerminalController, IWidgetGroup, IWidget, ResizeDelegate, ITerminalExternalService } from '../common';
import { TerminalClient } from './terminal.client';

export class Widget extends Disposable implements IWidget {
  private _name: string;
  private _client: TerminalClient;
  private _uid = uuid();
  private _drawed: boolean;

  @observable
  styles: { flex: number } = { flex: 1 };

  constructor(name: string, flex: number, onResize: ResizeDelegate, protected readonly service: ITerminalExternalService) {
    super();
    this._name = name;
    this._setStyles(flex);
    this._client = new TerminalClient(this.service);
    this.addDispose(onResize((width) => this._handleResize(width)));
  }

  get name() {
    return this._name;
  }

  get drawed() {
    return this._drawed;
  }

  get id() {
    return this._uid;
  }

  private _setStyles(flex: number) {
    this.styles = { flex };
  }

  private _handleResize(flex: number) {
    this._setStyles(flex);
  }

  focus() {
    this._client.focus();
  }

  resize(increment: number) {
    this._setStyles(Math.round((this.styles.flex + increment) * 10000) / 10000);
  }

  draw(dom: HTMLDivElement | null) {
    if (dom && !this._drawed) {
      this._client.applyDomNode(dom);
      this._client.attach();
      this._client.show();
      this._drawed = true;
    }
  }

  erase() {
    this._client.hide();
    this._drawed = false;
  }
}

export class WidgetGroup extends Disposable implements IWidgetGroup {
  private _uid = uuid();

  @observable
  members: Widget[];

  emitters: Map<string, Emitter<number>>;

  constructor(protected readonly service: ITerminalExternalService) {
    super();
    this.members = observable.array([], { deep: false });
    this.emitters = new Map();
  }

  private _averageLayout() {
    const length = this.members.length;
    const flex = Math.floor(1.0 / length * 10000) / 10000;

    this.emitters.forEach((emitter) => {
      emitter.fire(flex);
    });
  }

  get id() {
    return this._uid;
  }

  add(name: string): Widget {
    const emitter = new Emitter<number>();
    const widget = new Widget(name, 1, emitter.event, this.service);
    this.emitters.set(widget.id, emitter);
    this.members.push(widget);
    this._averageLayout();
    return widget;
  }

  findIndex(id: string) {
    for (let i = 0; i < this.members.length; i++) {
      if (id === this.members[i].id) {
        return i;
      }
    }
    return -1;
  }

  del(index: number) {
    const widget = this.members[index];
    this.members.splice(index, 1);
    this.emitters.delete(widget.id);

    widget.dispose();

    this._averageLayout();
  }

  resize() {
    this._averageLayout();
  }

  get length() {
    return this.members.length;
  }

  get last() {
    return this.members[this.length - 1];
  }

  snapshot() {
    let intro = '';
    this.members.forEach((m, i) => {
      intro += `${m.name}${i !== (this.members.length - 1) ? ', ' : ''}`;
    });
    return intro;
  }
}

@Injectable()
export class TerminalController extends Disposable implements ITerminalController {
  @observable
  groups: WidgetGroup[];

  @observable
  state: { index: number };

  focusedId: string;

  @Autowired(ITerminalExternalService)
  service: ITerminalExternalService;

  @Autowired(CommandService)
  commands: CommandService;

  constructor() {
    super();
    this.groups = observable.array([], { deep: false });
    this.state = observable.object({ index: 0 });
  }

  get currentGroup() {
    return this.groups[this.state.index];
  }

  firstInitialize() {
    this.createGroup();
    this.focus(this.groups[0].members[0]);
  }

  selectGroup(group: WidgetGroup) {
    this.groups.forEach((_group, index) => {
      if (group === _group) {
        this.selectIndex(index);
      }
    });
  }

  selectIndex(index: number) {
    this.state = { index };
    this.focus(this.currentGroup.last);
  }

  focus(widget: Widget) {
    widget.focus();
    this.focusedId = widget.id;
  }

  split() {
    const current = this.currentGroup.add('bash');
    this.focus(current);
  }

  createGroup() {
    const group = new WidgetGroup(this.service);
    group.add('bash');
    this.groups.push(group);
    this.selectGroup(group);
  }

  removeGroup(index: number) {
    const group = this.groups[index];
    group.dispose();
    this.groups.splice(index, 1);
  }

  removeWidget(id: string) {
    const group = this.currentGroup;
    const index = group.findIndex(id);
    if (index > -1) {
      group.del(index);
      if (group.length > 0) {
        this.focus(group.last);
      } else {
        this.removeGroup(this.state.index);
        if (this.groups.length > 0) {
          this.selectIndex(Math.max(0, index - 1));
        } else {
          this.commands.executeCommand(toggleBottomPanel.id);
        }
      }
    }
  }

  removeFocus() {
    this.removeWidget(this.focusedId);
  }
}
