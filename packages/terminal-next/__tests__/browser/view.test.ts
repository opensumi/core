import { uuid } from '@opensumi/ide-core-common';

import { Widget, WidgetGroup } from '../../src/browser/terminal.view';
import { ITerminalGroupViewService } from '../../src/common';

import { injector } from './inject';

describe('Terminal View Test', () => {
  let view: ITerminalGroupViewService;

  beforeAll(() => {
    view = injector.get(ITerminalGroupViewService);
  });

  it('Create Group', () => {
    const index = view.createGroup();
    view.selectGroup(index);
    expect(index).toBeGreaterThan(-1);
    const group = view.getGroup(index);
    expect(group).toBeInstanceOf(WidgetGroup);

    // 只是创建 Group 并不会创建 Widget
    expect(view.empty()).toBeTruthy();
  });

  it('Create Widget Without Id', () => {
    const group = view.currentGroup;
    const widget = view.createWidget(group);
    expect(widget).toBeInstanceOf(Widget);
    expect(view.empty()).toBeFalsy();
  });

  it('Remove Group', () => {
    const index = view.currentGroupIndex;
    view.removeGroup(index);
    expect(view.empty()).toBeTruthy();
  });

  it('Create Widget With Id', () => {
    const id = uuid();
    view.createGroup();
    const widget = view.createWidget(view.currentGroup, id);
    expect(view.empty()).toBeFalsy();
    expect(widget.id).toEqual(id);
  });

  it('Create Second Group And More Widgets', () => {
    const index1 = view.createGroup();
    // 为了测试占位，不创建后续的 widget
    const index2 = view.createGroup();
    const group1 = view.getGroup(index1);
    view.getGroup(index2);
    const widget11 = view.createWidget(group1);
    const widget12 = view.createWidget(group1);
    view.selectWidget(widget11.id);
    expect(view.currentWidgetId === widget11.id).toBeTruthy();
    view.selectWidget(widget12.id);
    expect(view.currentWidgetId === widget12.id).toBeTruthy();
  });

  it('Clear View And Clear Event', () => {
    const { dispose } = view.onWidgetEmpty(() => {
      expect(view.empty()).toBeTruthy();
      dispose();
    });
    view.clear();
  });

  it('Create And Dispose Event', () => {
    const { dispose: dispose1 } = view.onWidgetCreated((widget) => {
      expect(widget).toBeInstanceOf(Widget);
      expect(view.empty()).toBeFalsy();
      dispose1();
    });

    const { dispose: dispose2 } = view.onWidgetDisposed((widget) => {
      expect(widget).toBeInstanceOf(Widget);
      expect(view.empty()).toBeTruthy();
      dispose2();
    });

    const index = view.createGroup();
    const group = view.getGroup(index);
    const widget = view.createWidget(group);
    view.selectWidget(widget.id);
    view.removeWidget(view.currentWidgetId);
  });

  afterAll(() => {
    view.clear();
  });
});
