import { WSChannel } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { IContextKeyService } from '@opensumi/ide-core-browser/src';
import { Disposable } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-core-node';
import {
  DebugModelFactory,
  IDebugServer,
  IDebugSessionManager,
  IDebugSession,
  DebugSessionOptions,
} from '@opensumi/ide-debug';
import { DebugPreferences, DebugSessionContributionRegistry, DebugSession } from '@opensumi/ide-debug/lib/browser';
import { DebugConsoleFilterService } from '@opensumi/ide-debug/lib/browser/view/console/debug-console-filter.service';
import { DebugConsoleModelService } from '@opensumi/ide-debug/lib/browser/view/console/debug-console-tree.model.service';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { QuickPickService } from '@opensumi/ide-quick-open';
import { ITaskService } from '@opensumi/ide-task';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';
import { IVariableResolverService } from '@opensumi/ide-variable';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { MockDebugSession } from '../../../../__mocks__/debug-session';

describe('Debug console component Test Suites', () => {
  const mockInjector = createBrowserInjector([]);
  let debugConsoleModelService: DebugConsoleModelService;
  let debugConsoleFilterService: DebugConsoleFilterService;
  let container;

  const createMockSession = (sessionId: string, options: Partial<DebugSessionOptions>): IDebugSession =>
    new MockDebugSession(sessionId, options);

  const mockCtxMenuRenderer = {
    show: jest.fn(),
    onDidChangeContext: jest.fn(() => Disposable.create(() => {})),
  } as any;
  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => {})),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
    currentSession: undefined,
    updateCurrentSession: jest.fn((session: IDebugSession | undefined) => {}),
  } as any;

  beforeEach(() => {
    mockInjector.overrideProviders({
      token: WorkbenchEditorService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IMessageService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: DebugPreferences,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useValue: {
        onFilesChanged: jest.fn(),
      },
    });
    mockInjector.overrideProviders({
      token: ITerminalApiService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: OutputService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: DebugModelFactory,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IDebugServer,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: QuickPickService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: WSChannelHandler,
      useValue: {
        clientId: 'mock_id' + Math.random(),
        openChannel(id: string) {
          const channelSend = (content) => {
            //
          };
          return new WSChannel(channelSend, 'mock_wschannel' + id);
        },
      },
    });
    mockInjector.overrideProviders({
      token: DebugSessionContributionRegistry,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IVariableResolverService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: ITaskService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockCtxMenuRenderer,
    });
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    });
    mockInjector.overrideProviders({
      token: IMainLayoutService,
      useClass: LayoutService,
    });

    debugConsoleModelService = mockInjector.get(DebugConsoleModelService);
    debugConsoleFilterService = mockInjector.get(DebugConsoleFilterService);
    container = document.createElement('div');
    container.setAttribute('id', 'debugConsole');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('repl can be filter', async () => {
    const session = createMockSession('mock', {});
    mockDebugSessionManager.currentSession = session;
    await debugConsoleModelService.initTreeModel(session as DebugSession);
    const tree = debugConsoleModelService;
    const ensureVisible = jest.fn();
    debugConsoleModelService.handleTreeHandler({
      ensureVisible,
    } as any);

    await tree.execute('ABCD\n');
    await tree.execute('EFGH\n');
    await tree.execute('KTTQL\n');
    await tree.execute('KATATAQAL\n');
    await tree.execute('🐜\n');
    expect(ensureVisible).toBeCalledTimes(5);
    const filterString = 'KTTQL';
    debugConsoleFilterService.onDidValueChange((event) => {
      expect(event).toBe(filterString);
    });
    debugConsoleFilterService.setFilterText(filterString);
  });
});
