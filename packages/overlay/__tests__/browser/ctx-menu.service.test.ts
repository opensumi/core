import { Injector } from '@opensumi/di';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { BrowserCtxMenuService } from '../../src/browser/ctx-menu/ctx-menu.service';

jest.useFakeTimers();

describe('test for packages/menu-bar/src/browser/menu-bar.store.ts', () => {
  let injector: MockInjector;
  let ctxMenuService: BrowserCtxMenuService;

  beforeEach(() => {
    injector = createBrowserInjector([], new Injector());

    injector.addProviders({
      token: IBrowserCtxMenu,
      useClass: BrowserCtxMenuService,
    });

    ctxMenuService = injector.get(IBrowserCtxMenu);
  });

  it('ok for default state', () => {
    expect(ctxMenuService.visible).toBeFalsy();
    expect(ctxMenuService.point).toBeUndefined();
    expect(ctxMenuService.onHide).toBeUndefined();
    expect(ctxMenuService.context).toBeUndefined();
    expect(ctxMenuService.menuNodes.length).toBe(0);
  });

  it('ok for show', () => {
    const clickEvent = new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 20,
    });
    const onHide = jest.fn();
    ctxMenuService.show({
      anchor: clickEvent,
      onHide,
      menuNodes: [new MenuNode({ id: 'test.command', label: 'test' })],
      args: [1, 2, 3],
    });
    expect(ctxMenuService.visible).toBeTruthy();
    expect(ctxMenuService.context).toEqual([1, 2, 3]);
    expect(ctxMenuService.point).toEqual({ pageX: 10, pageY: 20 });
    expect(ctxMenuService.menuNodes.length).toBe(1);

    ctxMenuService.hide(true);
    expect(onHide).toBeCalledTimes(1);
    expect(ctxMenuService.visible).toBeFalsy();

    ctxMenuService.show({
      anchor: { x: 15, y: 20 },
      menuNodes: [new MenuNode({ id: 'test1.command', label: 'test1' })],
    });

    expect(ctxMenuService.visible).toBeTruthy();
    expect(ctxMenuService.context).toBeUndefined();
    expect(ctxMenuService.point).toEqual({ pageX: 15, pageY: 20 });
    expect(ctxMenuService.menuNodes.length).toBe(1);
    expect(ctxMenuService.onHide).toBeUndefined();

    // 连续调用 show
    ctxMenuService.show({
      anchor: { x: 50, y: 60 },
      menuNodes: [
        new MenuNode({ id: 'test.command', label: 'test' }),
        new MenuNode({ id: 'test1.command', label: 'test1' }),
      ],
    });

    expect(ctxMenuService.visible).toBeTruthy();
    expect(ctxMenuService.context).toBeUndefined();
    expect(ctxMenuService.point).toEqual({ pageX: 50, pageY: 60 });
    expect(ctxMenuService.menuNodes.length).toBe(2);
    expect(ctxMenuService.onHide).toBeUndefined();

    ctxMenuService.hide(true);
    ctxMenuService.show({
      anchor: { x: 1, y: 2 },
      menuNodes: [],
    });

    expect(ctxMenuService.visible).toBeFalsy();
    expect(ctxMenuService.context).toBeUndefined();
    expect(ctxMenuService.point).toEqual({ pageX: 50, pageY: 60 });
    expect(ctxMenuService.menuNodes.length).toBe(2);
    expect(ctxMenuService.onHide).toBeUndefined();
  });

  it('ok for menuNodes is empty', () => {
    const clickEvent = new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 20,
    });
    const onHide = jest.fn();
    ctxMenuService.show({
      anchor: clickEvent,
      onHide,
      menuNodes: [],
      args: [1, 2, 3],
    });
    expect(ctxMenuService.visible).toBeFalsy();
    expect(ctxMenuService.point).toBeUndefined();
    expect(ctxMenuService.onHide).toBeUndefined();
    expect(ctxMenuService.context).toBeUndefined();
    expect(ctxMenuService.menuNodes.length).toBe(0);
  });
});
