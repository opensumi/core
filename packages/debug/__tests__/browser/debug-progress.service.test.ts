import { IContextKeyService, QuickPickService } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-core-common';
import { DebugPreferences } from '@opensumi/ide-debug/lib/browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks/file-service-client';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';

import { DebugProgressService } from './../../src/browser/debug-progress.service';
import { DebugSessionManager } from './../../src/browser/debug-session-manager';
import { DebugModelFactory } from './../../src/common/debug-model';
import { IDebugProgress } from './../../src/common/debug-progress';
import { IDebugServer } from './../../src/common/debug-service';
import { IDebugSessionManager } from './../../src/common/debug-session';


describe('DebugProgressService', () => {
  let debugProgressService: IDebugProgress;
  let injector: MockInjector;

  const debugSessionManager = {
    onDidChangeActiveDebugSession: jest.fn(),
    onDidCreateDebugSession: jest.fn(),
  };

  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IDebugProgress,
          useClass: DebugProgressService,
        },
        {
          token: IDebugSessionManager,
          useClass: DebugSessionManager,
        },
        {
          token: WorkbenchEditorService,
          useValue: {},
        },
        {
          token: DebugModelFactory,
          useValue: {},
        },
        {
          token: IFileServiceClient,
          useValue: MockFileServiceClient,
        },
        {
          token: IWorkspaceService,
          useValue: {},
        },
        {
          token: IDebugServer,
          useValue: {},
        },
        {
          token: QuickPickService,
          useValue: {},
        },
        {
          token: DebugPreferences,
          useValue: {},
        },
      ]),
    );
    debugProgressService = injector.get(IDebugProgress);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('should have enough API', () => {
    expect(typeof debugProgressService.run).toBe('function');
    expect(typeof debugProgressService.onDebugServiceStateChange).toBe('function');
  });

  it('run should be ok.', () => {
    debugProgressService.run(debugSessionManager as any);

    expect(debugSessionManager.onDidChangeActiveDebugSession).toBeCalledTimes(1);
    expect(debugSessionManager.onDidCreateDebugSession).toBeCalledTimes(1);
  });
});
