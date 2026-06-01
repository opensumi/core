import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { TabbarBehaviorConfig } from '@opensumi/ide-core-browser/lib/react-providers';
import { TabbarBehaviorHandler } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar-behavior-handler';

describe('TabbarBehaviorHandler', () => {
  it('resolves dynamic isLatter for each resize operation', () => {
    let isLatter = false;
    const config: TabbarBehaviorConfig = {
      isLatter: () => isLatter,
    };
    const resizeHandle: ResizeHandle = {
      setSize: jest.fn(),
      setRelativeSize: jest.fn(),
      getSize: jest.fn(() => 360),
      getRelativeSize: jest.fn(() => [1, 2]),
      lockSize: jest.fn(),
      setMaxSize: jest.fn(),
      hidePanel: jest.fn(),
    };

    const wrappedResizeHandle = new TabbarBehaviorHandler('AI-Chat', config).wrapResizeHandle(resizeHandle);

    wrappedResizeHandle.setSize(360);
    wrappedResizeHandle.setRelativeSize(1, 2);
    wrappedResizeHandle.getSize();
    wrappedResizeHandle.getRelativeSize();
    wrappedResizeHandle.lockSize(true);
    wrappedResizeHandle.setMaxSize(true);

    isLatter = true;
    wrappedResizeHandle.setSize(280);
    wrappedResizeHandle.setRelativeSize(2, 1);
    wrappedResizeHandle.getSize();
    wrappedResizeHandle.getRelativeSize();
    wrappedResizeHandle.lockSize(false);
    wrappedResizeHandle.setMaxSize(false);

    expect(resizeHandle.setSize).toHaveBeenNthCalledWith(1, 360, false);
    expect(resizeHandle.setSize).toHaveBeenNthCalledWith(2, 280, true);
    expect(resizeHandle.setRelativeSize).toHaveBeenNthCalledWith(1, 1, 2, false);
    expect(resizeHandle.setRelativeSize).toHaveBeenNthCalledWith(2, 2, 1, true);
    expect(resizeHandle.getSize).toHaveBeenNthCalledWith(1, false);
    expect(resizeHandle.getSize).toHaveBeenNthCalledWith(2, true);
    expect(resizeHandle.getRelativeSize).toHaveBeenNthCalledWith(1, false);
    expect(resizeHandle.getRelativeSize).toHaveBeenNthCalledWith(2, true);
    expect(resizeHandle.lockSize).toHaveBeenNthCalledWith(1, true, false);
    expect(resizeHandle.lockSize).toHaveBeenNthCalledWith(2, false, true);
    expect(resizeHandle.setMaxSize).toHaveBeenNthCalledWith(1, true, false);
    expect(resizeHandle.setMaxSize).toHaveBeenNthCalledWith(2, false, true);
  });
});
