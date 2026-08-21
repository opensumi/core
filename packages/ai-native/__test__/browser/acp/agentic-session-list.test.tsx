import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  PreferenceService: class PreferenceService {},
  localize: jest.fn((key: string, fallback?: string) =>
    key === 'aiNative.agentic.project.manage' ? 'Manage {0}' : fallback || key,
  ),
  useInjectable: jest.fn(),
}));

jest.mock('@opensumi/ide-overlay', () => ({
  IMessageService: Symbol('IMessageService'),
  IWindowDialogService: Symbol('IWindowDialogService'),
}));

jest.mock('../../../src/browser/acp/agentic-task-registry.service', () => ({
  AgenticTaskRegistryService: class AgenticTaskRegistryService {},
}));

jest.mock('../../../src/browser/acp/agentic-workspace-switch.service', () => ({
  AgenticWorkspaceSwitchService: class AgenticWorkspaceSwitchService {},
}));

jest.mock('../../../src/browser/acp/components/AgenticTaskList', () => ({
  ProjectRenameModal: () => null,
  TaskListResizeHandle: () => require('react').createElement('div', { 'data-testid': 'session-list-resize' }),
}));

jest.mock('../../../src/browser/acp/components/AgenticTaskLaunchMenu', () => ({
  AgenticTaskLaunchMenu: ({ preferredAgentId }: { preferredAgentId?: string }) =>
    require('react').createElement('button', {
      'data-preferred-agent-id': preferredAgentId,
      'data-testid': 'agentic-task-launch-button',
      type: 'button',
    }),
}));

jest.mock('../../../src/browser/chat/get-default-agent-type', () => ({
  getAvailableAgentConfigs: jest.fn(() => ({ 'agent-a': { command: 'agent-a' } })),
  getDefaultAgentType: jest.fn(() => 'opencode'),
}));

import { PreferenceService } from '@opensumi/ide-core-browser';
import { localizationBundle as enUSLocalizationBundle } from '@opensumi/ide-i18n/lib/common/en-US.lang';
import { localizationBundle as zhCNLocalizationBundle } from '@opensumi/ide-i18n/lib/common/zh-CN.lang';
import { IMessageService, IWindowDialogService } from '@opensumi/ide-overlay';

import { AgenticTaskRegistryService } from '../../../src/browser/acp/agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';
import { AgenticSessionList } from '../../../src/browser/acp/components/AgenticSessionList';
import { IChatInternalService } from '../../../src/common';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const agenticLocalizationKeys = [
  'aiNative.chat.acp.skills.loading',
  'aiNative.chat.acp.skills.empty',
  'aiNative.agentic.session.discardDraftAndSwitch',
  'aiNative.agentic.session.switchDiscardDraft',
  'aiNative.chat.session.connectionUnavailable',
  'aiNative.chat.session.restoringConnection',
] as const;

const projectA = {
  id: 'project-a',
  workspaceUri: 'file:///work/a',
  workspacePath: '/work/a',
  label: 'Project A',
  joinedAt: 20,
  availability: 'available' as const,
};

const projectB = {
  id: 'project-b',
  workspaceUri: 'file:///work/b',
  workspacePath: '/work/b',
  label: 'Project B',
  joinedAt: 10,
  availability: 'available' as const,
};

function session(sessionId: string, cwd: string, title?: string, updatedAt?: string) {
  return {
    sessionId: `acp:${sessionId}`,
    agentSessionId: sessionId,
    agentId: 'agent-a',
    cwd,
    title,
    updatedAt,
  };
}

function createServices(initialSessions = [session('one', '/work/a', 'Agent title', '2026-08-19T10:00:00Z')]) {
  const sessionListeners = new Set<(sessionId: string) => void>();
  const catalogListeners = new Set<(sessions: ReturnType<typeof session>[]) => void>();
  const registryListeners = new Set<() => void>();
  let archivedSessions: Array<{ sessionId: string; agentId: string; cwd: string; archivedAt: number }> = [];
  return {
    registry: {
      archiveAgentSession: jest.fn(async (archivedSession) => {
        if (
          archivedSessions.some(
            (candidate) =>
              candidate.sessionId === archivedSession.sessionId &&
              candidate.agentId === archivedSession.agentId &&
              candidate.cwd === archivedSession.cwd,
          )
        ) {
          return false;
        }
        archivedSessions = [...archivedSessions, { ...archivedSession, archivedAt: Date.now() }];
        return true;
      }),
      listActiveGroups: jest.fn(),
      listArchivedAgentSessions: jest.fn(async () => archivedSessions),
      listProjects: jest.fn().mockResolvedValue([projectA, projectB]),
      onDidChange: jest.fn((listener: () => void) => {
        registryListeners.add(listener);
        return { dispose: () => registryListeners.delete(listener) };
      }),
      removeManagedSessionProject: jest.fn().mockResolvedValue(true),
      renameProject: jest.fn().mockResolvedValue(projectA),
      unarchiveAgentSession: jest.fn(async (archivedSession) => {
        const previousLength = archivedSessions.length;
        archivedSessions = archivedSessions.filter(
          (candidate) =>
            candidate.sessionId !== archivedSession.sessionId ||
            candidate.agentId !== archivedSession.agentId ||
            candidate.cwd !== archivedSession.cwd,
        );
        return archivedSessions.length !== previousLength;
      }),
    },
    workspaceSwitch: {
      addProject: jest.fn().mockResolvedValue(projectA),
      refreshProjectAvailability: jest.fn().mockResolvedValue(undefined),
      seedProjectCatalog: jest.fn().mockResolvedValue(undefined),
    },
    aiChatService: {
      activateAgentSession: jest.fn().mockResolvedValue({ status: 'activated' }),
      discardAgenticTaskDraft: jest.fn().mockResolvedValue(undefined),
      getActiveAgenticTaskTarget: jest.fn(),
      getAgentSessions: jest.fn(() => initialSessions),
      getInputDraft: jest.fn(() => undefined),
      isActiveAgenticTaskDraft: jest.fn(() => false),
      onChangeSession: jest.fn((listener: (sessionId: string) => void) => {
        sessionListeners.add(listener);
        return { dispose: () => sessionListeners.delete(listener) };
      }),
      onDidChangeAgentSessions: jest.fn((listener: (sessions: ReturnType<typeof session>[]) => void) => {
        catalogListeners.add(listener);
        return { dispose: () => catalogListeners.delete(listener) };
      }),
      refreshAgentSessions: jest.fn().mockResolvedValue(initialSessions),
      sessionModel: undefined,
    },
    preferenceService: { get: jest.fn(() => ({})) },
    messageService: { info: jest.fn(), warning: jest.fn().mockResolvedValue(undefined) },
    windowDialogService: { showOpenDialog: jest.fn().mockResolvedValue(undefined) },
    emitRegistryChange: () => registryListeners.forEach((listener) => listener()),
  };
}

describe('AgenticSessionList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  async function renderList(services = createServices()) {
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticTaskRegistryService) {
        return services.registry;
      }
      if (token === AgenticWorkspaceSwitchService) {
        return services.workspaceSwitch;
      }
      if (token === IChatInternalService) {
        return services.aiChatService;
      }
      if (token === IWindowDialogService) {
        return services.windowDialogService;
      }
      if (token === IMessageService) {
        return services.messageService;
      }
      if (token === PreferenceService) {
        return services.preferenceService;
      }
      throw new Error(`Unexpected injectable: ${String(token)}`);
    });
    await act(async () => {
      root.render(<AgenticSessionList />);
      await flushPromises();
    });
    return services;
  }

  it('renders only Agent-returned sessions in project order without legacy Task controls', async () => {
    const services = createServices([
      session('older', '/work/a', 'Older Agent title', '2026-08-18T10:00:00Z'),
      session('newer', '/work/a', 'Newer Agent title', '2026-08-19T10:00:00Z'),
      session('untitled', '/work/b'),
    ]);
    await renderList(services);

    expect(container.textContent).toContain('Agent Sessions');
    expect(container.textContent).toContain('Newer Agent title');
    expect(container.textContent).toContain('Older Agent title');
    expect(container.textContent).toContain('Untitled session');
    expect(container.textContent).not.toContain('Legacy local prompt title');
    expect(services.registry.listActiveGroups).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="agentic-session-archive-acp:newer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="agentic-session-refresh-button"]')).toBeNull();
    expect(container.querySelector('[aria-label*="Unread"]')).toBeNull();
    expect(container.querySelector('[aria-label*="attention"]')).toBeNull();
    expect(container.querySelector('.codicon-hubot')).toBeNull();
    expect(container.querySelector('[aria-label="Manage Project A"]')).not.toBeNull();

    const rows = Array.from(container.querySelectorAll('[data-testid^="agentic-session-row-"]'));
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Newer Agent title'),
      expect.stringContaining('Older Agent title'),
      expect.stringContaining('Untitled session'),
    ]);
  });

  it('registers the Agent Session UI strings in both supported language bundles', () => {
    for (const key of agenticLocalizationKeys) {
      expect(enUSLocalizationBundle.contents[key]).toBeTruthy();
      expect(zhCNLocalizationBundle.contents[key]).toBeTruthy();
    }
  });

  it('uses the configured default Agent when no active session supplies one', async () => {
    await renderList(createServices([]));

    expect(
      container.querySelector('[data-testid="agentic-task-launch-button"]')?.getAttribute('data-preferred-agent-id'),
    ).toBe('opencode');
  });

  it('archives and restores Agent sessions without closing or deleting them', async () => {
    const services = createServices([session('one', '/work/a', 'Agent title')]);
    await renderList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-session-archive-acp:one"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.registry.archiveAgentSession).toHaveBeenCalledWith({
      sessionId: 'acp:one',
      agentId: 'agent-a',
      cwd: '/work/a',
    });
    expect(container.querySelector('[data-testid="agentic-session-row-acp:one"]')).toBeNull();

    const archivedArea = container.querySelector('[data-testid="agentic-archived-session-area"]');
    expect(archivedArea).not.toBeNull();
    await act(async () => {
      (archivedArea?.querySelector('button') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="agentic-session-row-acp:one"]')).not.toBeNull();
    await act(async () => {
      (container.querySelector('[data-testid="agentic-session-unarchive-acp:one"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.registry.unarchiveAgentSession).toHaveBeenCalledWith({
      sessionId: 'acp:one',
      agentId: 'agent-a',
      cwd: '/work/a',
    });
    expect(container.querySelector('[data-testid="agentic-session-archive-acp:one"]')).not.toBeNull();
    expect(services.aiChatService.discardAgenticTaskDraft).not.toHaveBeenCalled();
  });

  it('shows a listed session when its project is registered after the initial layout refresh', async () => {
    const newlyDiscoveredSession = session('new', '/work/b', 'New Agent session');
    const services = createServices([]);
    services.registry.listProjects.mockResolvedValue([projectA]);
    await renderList(services);
    expect(container.textContent).not.toContain('New Agent session');

    services.registry.listProjects.mockResolvedValue([projectA, projectB]);
    services.aiChatService.refreshAgentSessions.mockResolvedValue([newlyDiscoveredSession]);
    await act(async () => {
      services.emitRegistryChange();
      await flushPromises();
      await flushPromises();
    });

    expect(services.aiChatService.refreshAgentSessions).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('New Agent session');
  });

  it('confirms before abandoning an unsent Agentic draft and cleans it up only after switching', async () => {
    const services = createServices([session('restored', '/work/a', 'Restored')]);
    services.aiChatService.sessionModel = { sessionId: 'acp:draft' };
    services.aiChatService.isActiveAgenticTaskDraft.mockReturnValue(true);
    services.aiChatService.getInputDraft.mockReturnValue({ message: 'keep me unless confirmed' });
    services.messageService.warning.mockResolvedValue('Discard Draft and Switch');
    await renderList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-session-row-acp:restored"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.messageService.warning).toHaveBeenCalledTimes(1);
    expect(services.aiChatService.activateAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'acp:restored' }),
      expect.any(Function),
    );
    expect(services.aiChatService.discardAgenticTaskDraft).toHaveBeenCalledTimes(1);
  });

  it('does not prompt or abandon the current draft-bound Session', async () => {
    const draftSession = session('draft', '/work/a', 'Draft session');
    const services = createServices([draftSession]);
    services.aiChatService.sessionModel = { sessionId: draftSession.sessionId };
    services.aiChatService.isActiveAgenticTaskDraft.mockReturnValue(true);
    services.aiChatService.getInputDraft.mockReturnValue({ message: 'keep editing' });
    await renderList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-session-row-acp:draft"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.messageService.warning).not.toHaveBeenCalled();
    expect(services.aiChatService.activateAgentSession).not.toHaveBeenCalled();
    expect(services.aiChatService.discardAgenticTaskDraft).not.toHaveBeenCalled();
  });

  it('marks a failed restore unavailable and retries the same session on another click', async () => {
    const services = createServices();
    services.aiChatService.activateAgentSession
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce({ status: 'activated' });
    await renderList(services);
    const row = container.querySelector('[data-testid="agentic-session-row-acp:one"]') as HTMLButtonElement;

    await act(async () => {
      row.click();
      await flushPromises();
    });
    expect(row.querySelector('[aria-label="Session unavailable"]')).not.toBeNull();
    expect(row.querySelector('.codicon-error')).not.toBeNull();

    await act(async () => {
      row.click();
      await flushPromises();
    });
    expect(services.aiChatService.activateAgentSession).toHaveBeenCalledTimes(2);
    expect(row.querySelector('[aria-label="Session unavailable"]')).toBeNull();
  });

  it('allows overlapping selections so the service can apply only the latest intent', async () => {
    const services = createServices([session('one', '/work/a', 'First'), session('two', '/work/a', 'Second')]);
    let resolveFirst!: (value: { status: 'superseded' }) => void;
    let resolveSecond!: (value: { status: 'activated' }) => void;
    services.aiChatService.activateAgentSession.mockImplementation(
      (selected: ReturnType<typeof session>) =>
        new Promise((resolve) => {
          if (selected.sessionId === 'acp:one') {
            resolveFirst = resolve as typeof resolveFirst;
          } else {
            resolveSecond = resolve as typeof resolveSecond;
          }
        }),
    );
    await renderList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-session-row-acp:one"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="agentic-session-row-acp:two"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(services.aiChatService.activateAgentSession).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="agentic-session-row-acp:two"] .codicon-loading')).not.toBeNull();

    await act(async () => {
      resolveSecond({ status: 'activated' });
      resolveFirst({ status: 'superseded' });
      await flushPromises();
    });
    expect(container.querySelector('[data-testid="agentic-session-row-acp:two"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
  });
});
