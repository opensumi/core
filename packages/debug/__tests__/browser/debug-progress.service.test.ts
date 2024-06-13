import { IContextKeyService, QuickPickService } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-core-common';
import { DebugPreferences } from '@opensumi/ide-debug/lib/browser/debug-preferences';
import { createBrowserInjector, getBrowserMockInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { MockFileServiceClient } from '@opensumi/ide-file-service/__mocks__/file-service-client';
import { MockContextKeyService } from '@opensumi/ide-monaco/__mocks__/monaco.context-key.service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

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
  };

  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      getBrowserMockInjector([
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

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('should have enough API', () => {
    expect(typeof debugProgressService.run).toBe('function');
    expect(typeof debugProgressService.onDebugServiceStateChange).toBe('function');
  });

  it('run should be ok.', () => {
    debugProgressService.run(debugSessionManager as any);

    expect(debugSessionManager.onDidChangeActiveDebugSession).toHaveBeenCalledTimes(1);
  });
});
