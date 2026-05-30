import fs from 'fs';
import path from 'path';

import { URI } from '@opensumi/ide-core-browser';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkerExtProcessService } from '@opensumi/ide-extension/lib/browser/extension-worker.service';

import { IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../../../src/common';

import { MOCK_EXTENSIONS, setupExtensionServiceInjector } from './extension-service-mock-helper';

const workerHostPath = path.resolve(__dirname, '../../../lib/worker-host.js');

function expectWorkerHostArtifact() {
  if (!fs.existsSync(workerHostPath)) {
    throw new Error(`Missing worker-host artifact: ${workerHostPath}. Run yarn build:worker-host before E2E tests.`);
  }
}

describe('Extension service', () => {
  jest.setTimeout(20 * 1000);

  let workerService: WorkerExtProcessService;
  let injector: MockInjector;

  beforeAll(async () => {
    injector = setupExtensionServiceInjector();
    workerService = injector.get(WorkerExtProcessService);
  });

  it('initExtension should be work', async () => {
    await workerService.updateExtensionData(MOCK_EXTENSIONS);
    expect(workerService.getExtension(MOCK_EXTENSIONS[0].id)).toBeDefined();
    expect(workerService.getExtension(MOCK_EXTENSIONS[0].id)?.id).toBe(MOCK_EXTENSIONS[0].id);
  });

  it('activate worker host should be work', async () => {
    expectWorkerHostArtifact();
    await workerService.activate(true);
    expect(workerService.protocol).toBeDefined();
    const proxy = workerService.protocol.getProxy<IExtensionWorkerHost>(
      WorkerHostAPIIdentifier.ExtWorkerHostExtensionService,
    );
    expect(proxy).toBeDefined();
  });

  it('should have the default dev worker-host artifact before activation', () => {
    expectWorkerHostArtifact();
  });

  it('activate extension should be work', async () => {
    expectWorkerHostArtifact();
    await workerService.activeExtension(MOCK_EXTENSIONS[0], true);
    const activated = await workerService.getActivatedExtensions.bind(workerService)();
    expect(activated.find((e) => e.id === MOCK_EXTENSIONS[0].id)).toBeTruthy();
  });

  it('should get correct worker script uri', async () => {
    let extensionPath = '/__mocks__/extension';
    const workerMain = './worker.js';
    const getWorkerURI = () => {
      let extUri = new URI(extensionPath);
      if (!extUri.scheme) {
        extUri = URI.file(extensionPath);
      }
      const fixedWorkerMain = workerMain.replace(/^\.\//, '');
      return extUri.resolve(fixedWorkerMain);
    };

    expect(getWorkerURI().toString()).toBe(`file://${extensionPath}/worker.js`);

    extensionPath = 'kt-ext://host/__mocks__/extension';
    expect(getWorkerURI().toString()).toBe(`${extensionPath}/worker.js`);
  });
});
