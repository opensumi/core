import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';

import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { mockExtensions } from '../../../../__mocks__/extensions';
import { MainThreadLayout } from '../../../../src/browser/sumi/main.thread.layout';
import { MainThreadSumiAPIIdentifier } from '../../../../src/common/sumi';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import { createLayoutAPIFactory, ExtHostLayout } from '../../../../src/hosted/api/sumi/ext.host.layout';
import { ExtHostCommands } from '../../../../src/hosted/api/vscode/ext.host.command';

const extension = mockExtensions[0];

describe('packages/extension/__tests__/hosted/api/sumi/ext.host.layout.test.ts', () => {
  let ktLayout: ExtHostLayout;
  let mainLayout: MainThreadLayout;
  let layoutApi;
  const viewId = 'TestViewId';

  const map = new Map();
  const rpcProtocol: IRPCProtocol = {
    getProxy: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
      return value;
    },
    get: (r) => map.get(r),
  };

  beforeAll(async () => {
    mainLayout = mockService({});
    const mainCommands = mockService({});
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mainCommands);
    rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadLayout, mainLayout);
    const extCommands = new ExtHostCommands(rpcProtocol);
    ktLayout = new ExtHostLayout(rpcProtocol);
    layoutApi = createLayoutAPIFactory(extCommands, ktLayout, extension);
  });

  it('get tabbar handle', () => {
    const tabbar = layoutApi.getTabbarHandler(viewId);
    expect(tabbar).toBeDefined();
    expect(tabbar.id).toBe(`${extension.id}:${viewId}`);
  });

  it('setIcon', async (done) => {
    mainLayout.$setIcon = jest.fn((id, iconPath) => {
      expect(id).toBe(`${extension.id}:${viewId}`);
      expect(iconPath).toBe('extension');
      done();
    });
    const tabbar = layoutApi.getTabbarHandler(viewId);
    tabbar.setIcon('extension');
  });

  it('setTitle', async (done) => {
    mainLayout.$setTitle = jest.fn((id, title) => {
      expect(id).toBe(`${extension.id}:${viewId}`);
      expect(title).toBe('New Title');
      done();
    });
    const tabbar = layoutApi.getTabbarHandler(viewId);
    tabbar.setTitle('New Title');
  });

  it('setBadge', async (done) => {
    mainLayout.$setBadge = jest.fn((id, badge) => {
      expect(id).toBe(`${extension.id}:${viewId}`);
      expect(badge).toBe('10');
      done();
    });
    const tabbar = layoutApi.getTabbarHandler(viewId);
    tabbar.setBadge('10');
  });
});
