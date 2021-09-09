import { ContextKeyService } from '@ali/monaco-editor-core/esm/vs/platform/contextkey/browser/contextKeyService';
import { IContextKeyServiceTarget } from '@ali/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { URI } from '@ali/ide-core-common';
import { Disposable } from '@ali/ide-core-common';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { DebugCallStackService } from '@ali/ide-debug/lib/browser/view/frames/debug-call-stack.service';
import { DebugStackFrame } from '@ali/ide-debug/lib/browser';
import { IContextKeyService } from '@ali/ide-core-browser';
import { AbstractContextMenuService } from '@ali/ide-core-browser/lib/menu/next';

describe('Debug Call Frames Service', () => {
  const mockInjector = createBrowserInjector([]);
  let debugCallStackService: DebugCallStackService;

  const mockCtxMenuRenderer = {
    show: jest.fn(),
  } as any;

  const mockContextKeyService = {
    createScoped: jest.fn((target?: IContextKeyServiceTarget | ContextKeyService | undefined) => mockContextKeyService),
    createKey: jest.fn(() => ({
      set: jest.fn(),
      reset: jest.fn(),
    })),
    contextKeyScoped: jest.fn(),
  } as any;

  const mockAbstractContextMenuService = {
    createMenu: jest.fn(() => ({
      getMergedMenuNodes: jest.fn(),
      dispose: jest.fn(() => Disposable.create(() => { })),
    })),
  } as any;

  beforeAll(() => {
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
    });
    mockInjector.overrideProviders({
      token: ICtxMenuRenderer,
      useValue: mockCtxMenuRenderer,
    });
    mockInjector.overrideProviders({
      token: AbstractContextMenuService,
      useValue: mockAbstractContextMenuService,
    });
    debugCallStackService = mockInjector.get(DebugCallStackService);
  }),

    it('handleContextMenu method should be work', () => {
      const mockNode: DebugStackFrame = {
        source: {
          uri: URI.file('/test'),
        },
        session: {
          id: '1',
        },
        thread: {
          id: '2',
        },
        raw: {
          id: '3',
        },
      } as any;
      const mockEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
        nativeEvent: {
          x: 1,
          y: 1,
        },
      } as any;
      debugCallStackService.handleContextMenu(mockEvent, mockNode);
      expect(mockCtxMenuRenderer.show).toBeCalledTimes(1);
      expect(mockEvent.stopPropagation).toBeCalledTimes(1);
      expect(mockEvent.preventDefault).toBeCalledTimes(1);

    });
});
