import { KTExtension } from '@opensumi/ide-extension/lib/hosted/vscode.extension';

import { mockService } from '../../../../tools/dev-tool/src/mock-injector';

describe('extension/__tests__/hosted/vscode.extension.test.ts', () => {
  beforeAll(() => {});

  it('the extension will not be activated repeatedly', async () => {
    const metadata = mockService({});
    let isActivated = false;
    const extensionService = mockService({
      isActivated: () => isActivated,
    });
    const mainThreadExtensionService = mockService({
      $activateExtension: jest.fn(() => {
        isActivated = true;
      }),
    });
    const exportsData = {
      api: '1.0',
    };
    const extendExportsData = {};
    const extension = new KTExtension(
      metadata,
      extensionService,
      mainThreadExtensionService,
      exportsData,
      extendExportsData,
    );

    const exportsData1 = await extension.activate();
    const exportsData2 = await extension.activate();

    // 激活插件函数只会调用一次
    expect(mainThreadExtensionService.$activateExtension).toBeCalledTimes(1);
    // 两次导出的结果应该是相同的
    expect(exportsData1).toEqual(exportsData2);
  });
});
