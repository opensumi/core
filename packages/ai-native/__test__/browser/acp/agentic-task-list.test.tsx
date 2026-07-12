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
    },
    workspaceSwitch: {
      activateTask: jest.fn(() => Promise.resolve()),
      launchTask: jest.fn(() => Promise.resolve()),
      refreshProjectAvailability: jest.fn(() => Promise.resolve()),
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
      return services.preferenceService;
    });

    await act(async () => {
      root.render(<AgenticTaskList />);
      await flushPromises();
    });
    return services;
  }

  it('sorts Project Groups and Task Rows and filters immutable titles', async () => {
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
    await renderTaskList(services);

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
    await renderTaskList(services);

    expect(container.querySelector('[data-testid="agentic-task-attention-acp:permission"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-status-acp:permission"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-unread-acp:permission"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-archive-acp:ready"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.registry.archive).toHaveBeenCalledWith('acp:ready', 'ready');

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
