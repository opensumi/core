import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  PreferenceService: class PreferenceService {},
  useInjectable: jest.fn(),
}));

jest.mock('../../../src/browser/acp/agentic-task-registry.service', () => ({
  AgenticTaskRegistryService: class AgenticTaskRegistryService {},
}));

jest.mock('../../../src/browser/acp/agentic-workspace-switch.service', () => ({
  AgenticWorkspaceSwitchService: class AgenticWorkspaceSwitchService {},
}));

import { IChatInternalService } from '../../../src/common';
import { AgenticTaskList } from '../../../src/browser/acp/components/AgenticTaskList';
import { AgenticTaskRegistryService } from '../../../src/browser/acp/agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

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

function createServices() {
  return {
    registry: {
      archive: jest.fn(() => Promise.resolve(true)),
      listActiveGroups: jest.fn(() => Promise.resolve([])),
      listArchivedGroups: jest.fn(() => Promise.resolve([])),
      listProjects: jest.fn(() => Promise.resolve([projectA, projectB])),
      onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
      unarchive: jest.fn(() => Promise.resolve(true)),
    },
    workspaceSwitch: {
      activateTask: jest.fn(() => Promise.resolve()),
      launchTask: jest.fn(() => Promise.resolve()),
      refreshProjectAvailability: jest.fn(() => Promise.resolve()),
      seedProjectCatalog: jest.fn(() => Promise.resolve()),
    },
    aiChatService: {
      enterAgenticTaskDraft: jest.fn(),
    },
    preferenceService: {
      get: jest.fn(() => ({})),
      set: jest.fn(),
    },
  };
}

describe('AgenticTaskList', () => {
  let chatView: HTMLDivElement;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    chatView = document.createElement('div');
    chatView.id = 'ai_chat_view';
    container = document.createElement('div');
    chatView.appendChild(container);
    document.body.appendChild(chatView);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    chatView.remove();
    jest.clearAllMocks();
  });

  async function renderTaskList(services = createServices()) {
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
      return services.preferenceService;
    });

    await act(async () => {
      root.render(<AgenticTaskList />);
      await flushPromises();
    });
    return services;
  }

  it('seeds the current Project before enabling the global first Task launcher', async () => {
    const services = createServices();
    const catalog: (typeof projectA)[] = [];
    services.registry.listProjects.mockImplementation(() => Promise.resolve([...catalog]));
    services.registry.listActiveGroups.mockResolvedValue([]);
    services.workspaceSwitch.seedProjectCatalog.mockImplementation(async () => {
      catalog.push(projectA);
    });

    await renderTaskList(services);

    expect(services.workspaceSwitch.seedProjectCatalog).toHaveBeenCalledTimes(1);
    expect(catalog).toEqual([projectA]);
    expect((container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('refreshes when the Task Registry records a newly created Task', async () => {
    const services = createServices();
    let taskAdded = false;
    let onRegistryChange: (() => void) | undefined;
    (services.registry as any).onDidChange = (listener: () => void) => {
      onRegistryChange = listener;
      return { dispose: jest.fn() };
    };
    services.registry.listActiveGroups.mockImplementation(() =>
      Promise.resolve(
        taskAdded
          ? [
              {
                project: projectA,
                tasks: [
                  {
                    sessionId: 'acp:new-task',
                    projectId: projectA.id,
                    agentId: 'agent-a',
                    title: 'New task',
                    createdAt: 1,
                    archived: false,
                    unread: false,
                  },
                ],
              },
            ]
          : [],
      ),
    );

    await renderTaskList(services);
    expect(container.querySelector('[data-testid="agentic-task-row-acp:new-task"]')).toBeNull();

    taskAdded = true;
    await act(async () => {
      onRegistryChange?.();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="agentic-task-row-acp:new-task"]')).not.toBeNull();
  });

  it('preserves registry Project and Task order while filtering immutable titles', async () => {
    const services = createServices();
    const groups = [
      {
        project: projectB,
        tasks: [
          {
            sessionId: 'acp:old',
            projectId: projectB.id,
            agentId: 'agent-b',
            title: 'Old task',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'ready' as const,
          },
        ],
      },
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:older-layout',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Fix layout later',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'ready' as const,
          },
          {
            sessionId: 'acp:layout',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Fix layout',
            createdAt: 2,
            archived: false,
            unread: false,
            status: 'running' as const,
          },
        ],
      },
    ];
    services.registry.listActiveGroups.mockResolvedValue(groups);
    services.registry.listProjects.mockResolvedValue([projectB, projectA]);
    await renderTaskList(services);

    const renderedGroups = container.querySelectorAll('[data-testid="agentic-task-project-group"]');
    expect(renderedGroups[0]?.textContent).toContain('Project B');
    expect(renderedGroups[1]?.textContent).toContain('Project A');
    expect(
      Array.from(container.querySelectorAll('[data-testid^="agentic-task-row-"]')).map((row) =>
        row.getAttribute('data-testid'),
      ),
    ).toEqual(['agentic-task-row-acp:old', 'agentic-task-row-acp:older-layout', 'agentic-task-row-acp:layout']);

    const input = container.querySelector('input[placeholder="Search tasks"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'layout');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain('Fix layout');
    expect(container.textContent).not.toContain('Old task');
    expect(groups[1].tasks.map((task) => task.sessionId)).toEqual(['acp:older-layout', 'acp:layout']);
    expect(container.querySelectorAll('[data-testid="agentic-task-project-group"]')[0]?.textContent).toContain(
      'Project A',
    );
    expect(container.querySelectorAll('[data-testid="agentic-task-row-acp:layout"]')).toHaveLength(1);
  });

  it('renders attention before status, archives eligible Tasks, and disables unavailable Projects', async () => {
    const services = createServices();
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:permission',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Await permission',
            createdAt: 3,
            archived: false,
            unread: true,
            status: 'running' as const,
            attention: 'permission' as const,
          },
          {
            sessionId: 'acp:ready',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Ready task',
            createdAt: 2,
            archived: false,
            unread: false,
            status: 'ready' as const,
          },
        ],
      },
      {
        project: { ...projectB, availability: 'unavailable' as const },
        tasks: [
          {
            sessionId: 'acp:unavailable',
            projectId: projectB.id,
            agentId: 'agent-b',
            title: 'Unavailable task',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'stopped' as const,
          },
        ],
      },
    ]);
    services.registry.listProjects.mockResolvedValue([projectA, { ...projectB, availability: 'unavailable' as const }]);
    await renderTaskList(services);

    expect(container.querySelector('[data-testid="agentic-task-attention-acp:permission"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-status-acp:permission"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-unread-acp:permission"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-archive-acp:ready"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.registry.archive).toHaveBeenCalledWith('acp:ready');

    const unavailable = container.querySelector(
      '[data-testid="agentic-task-row-acp:unavailable"]',
    ) as HTMLButtonElement;
    expect(unavailable.disabled).toBe(true);
    await act(async () => {
      unavailable.click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.activateTask).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="agentic-task-archive-acp:unavailable"]')).not.toBeNull();
  });

  it('launches a first Task from a catalog Project with no active Tasks', async () => {
    const services = createServices();
    services.registry.listProjects.mockResolvedValue([projectB]);
    services.registry.listActiveGroups.mockResolvedValue([]);
    services.preferenceService.get.mockReturnValue({
      'agent-b': {
        command: 'agent-b',
        description: 'Agent B',
      },
    });
    await renderTaskList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Project B')
        ?.click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agent B')
        ?.click();
      await flushPromises();
    });

    expect(services.workspaceSwitch.launchTask).toHaveBeenCalledWith(projectB, 'agent-b');
  });

  it('refreshes archived-only Projects and disables their archived Task rows', async () => {
    const unavailableProject = { ...projectB, availability: 'unavailable' as const };
    const services = createServices();
    services.registry.listProjects.mockResolvedValue([unavailableProject]);
    services.registry.listActiveGroups.mockResolvedValue([]);
    services.registry.listArchivedGroups.mockResolvedValue([
      {
        project: unavailableProject,
        tasks: [
          {
            sessionId: 'acp:archived-unavailable',
            projectId: unavailableProject.id,
            agentId: 'agent-b',
            title: 'Archived unavailable Task',
            createdAt: 1,
            archived: true,
            unread: false,
            status: 'stopped' as const,
          },
        ],
      },
    ]);
    await renderTaskList(services);

    expect(services.workspaceSwitch.refreshProjectAvailability).toHaveBeenCalledWith(unavailableProject);
    services.workspaceSwitch.refreshProjectAvailability.mockClear();
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Archived Tasks'))
        ?.click();
      await flushPromises();
    });

    expect(services.workspaceSwitch.refreshProjectAvailability).toHaveBeenCalledWith(unavailableProject);
    expect(
      (container.querySelector('[data-testid="agentic-task-row-acp:archived-unavailable"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('renders an accessible Unarchive action for an archived Task', async () => {
    const services = createServices();
    services.registry.listProjects.mockResolvedValue([projectA]);
    services.registry.listActiveGroups.mockResolvedValue([]);
    services.registry.listArchivedGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:archived-ready',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Archived ready Task',
            createdAt: 1,
            archived: true,
            unread: false,
            status: 'ready' as const,
          },
        ],
      },
    ]);
    await renderTaskList(services);

    const archivedArea = container.querySelector('[data-testid="agentic-archived-task-area"]');
    expect(archivedArea?.getAttribute('data-expanded')).toBe('false');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Archived Tasks'))
        ?.click();
      await flushPromises();
    });

    expect(archivedArea?.getAttribute('data-expanded')).toBe('true');

    const unarchive = container.querySelector('[data-testid="agentic-task-unarchive-acp:archived-ready"]');
    expect(unarchive?.getAttribute('aria-label')).toBe('Unarchive Archived ready Task');
    await act(async () => {
      (unarchive as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.registry.unarchive).toHaveBeenCalledWith('acp:archived-ready');
  });

  it('clamps local Task List resizing to the Agentic Chat Slot bounds', async () => {
    await renderTaskList();
    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;
    Object.defineProperty(handle, 'setPointerCapture', { configurable: true, value: jest.fn() });

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0 }));
      handle.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120 }));
      handle.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 120 }));
    });

    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });
});
