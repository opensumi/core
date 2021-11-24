import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { DebugHoverModel } from '@opensumi/ide-debug/lib/browser/editor/debug-hover-model';
import { Disposable } from '@opensumi/ide-core-common';

describe('Debug Hover Model', () => {
  const mockInjector = createBrowserInjector([]);
  let debugHoverModel: DebugHoverModel;
  const mockRoot = {
    watcher: {
      on: jest.fn(() => Disposable.create(() => {})),
    },
  } as any;

  beforeAll(() => {
    debugHoverModel = mockInjector.get(DebugHoverModel, [mockRoot]);
  });

  it('should have enough API', () => {
    expect(typeof debugHoverModel.init).toBe('function');
    expect(typeof debugHoverModel.onWillUpdate).toBe('function');
    expect(mockRoot.watcher.on).toBeCalledTimes(3);
  });

  it('init method should be work', () => {
    debugHoverModel.init(mockRoot);
    expect(mockRoot.watcher.on).toBeCalledTimes(6);
  });
});
