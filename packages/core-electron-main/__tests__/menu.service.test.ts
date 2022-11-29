import { EventEmitter } from 'events';

import { BrowserWindow, Menu } from 'electron';

import { Injector } from '@opensumi/di';
import { isWindows } from '@opensumi/ide-core-common';

import { mockService } from '../../../tools/dev-tool/src/mock-injector';
import { ElectronMainMenuService } from '../src/bootstrap/services/menu';

const mockedWindows = new Map<number, any>();

jest.mock('electron', () => ({
  Menu: mockService({
    buildFromTemplate: (p) => p,
  }),
  BrowserWindow: {
    fromId: (id) => {
      if (!mockedWindows.has(id)) {
        const eventEmitter = new EventEmitter();
        mockedWindows.set(
          id,
          mockService<any>({
            on: eventEmitter.on.bind(eventEmitter) as any,
            removeListener: eventEmitter.removeListener.bind(eventEmitter) as any,
            eventEmitter,
            isFocused: () => false,
          } as any),
        );
      }
      return mockedWindows.get(id);
    },
  },
}));

async function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

describe('electron main menu tests', () => {
  it('menu leak should not happen', async () => {
    if (isWindows) {
      return;
    }
    const injector = new Injector();

    const menuService: ElectronMainMenuService = injector.get(ElectronMainMenuService);

    menuService.setApplicationMenu(
      {
        label: 'test',
        submenu: [
          {
            label: 'test1',
          },
        ],
      },
      100,
    );

    const emitter: EventEmitter = (BrowserWindow.fromId(100)! as any).eventEmitter;

    expect(emitter.listenerCount('focus')).toBe(1);

    (Menu.setApplicationMenu as jest.Mock).mockClear();
    emitter.emit('focus');

    await delay(1);
    expect(Menu.setApplicationMenu).toBeCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'test1',
        }),
      ]),
    );

    menuService.setApplicationMenu(
      {
        label: 'test2',
        submenu: [
          {
            label: 'test2',
          },
        ],
      },
      100,
    );

    expect(emitter.listenerCount('focus')).toBe(1);

    (Menu.setApplicationMenu as jest.Mock).mockClear();
    emitter.emit('focus');
    await delay(1);
    expect(Menu.setApplicationMenu).toBeCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'test2',
        }),
      ]),
    );
  });
});
