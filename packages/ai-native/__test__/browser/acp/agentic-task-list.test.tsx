import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  KeybindingRegistry: class KeybindingRegistry {},
  PreferenceService: class PreferenceService {},
  useInjectable: jest.fn(),
}));

jest.mock('../../../src/browser/acp/agentic-task-registry.service', () => ({
  AgenticTaskRegistryService: class AgenticTaskRegistryService {},
}));

jest.mock('../../../src/browser/acp/agentic-workspace-switch.service', () => ({
  AgenticWorkspaceSwitchService: class AgenticWorkspaceSwitchService {},
  isAgenticTaskStatusArchivable: (status: string | undefined) =>
    status === 'ready' || status === 'stopped' || status === 'error',
}));

jest.mock('../../../src/browser/chat/get-default-agent-type', () => ({
  getAvailableAgentConfigs: jest.fn(),
  getConfiguredAgentConfigs: jest.fn(),
  getDefaultAgentType: jest.fn(),
}));

jest.mock('@opensumi/ide-components/lib/modal', () => ({
  Modal: ({ cancelText, children, onCancel, onOk, okText, title, visible }: any) => {
    if (!visible) {
      return null;
    }
    const React = require('react');
    return React.createElement(
      'div',
      { 'aria-label': title, role: 'dialog' },
      children,
      React.createElement('button', { onClick: onCancel, type: 'button' }, cancelText),
      React.createElement('button', { onClick: onOk, type: 'button' }, okText),
    );
  },
}));

jest.mock('@opensumi/ide-components/lib/popover', () => ({
  Popover: ({ children, id, onVisibleChange, overlay, visible }: any) => {
    const React = require('react');
    const content = typeof overlay === 'function' ? overlay() : overlay;
    return React.createElement(
      'div',
      {
        'data-popover-id': id,
        onBlur: () => onVisibleChange?.(false),
        onFocus: () => onVisibleChange?.(true),
        onMouseEnter: () => onVisibleChange?.(true),
        onMouseLeave: () => onVisibleChange?.(false),
      },
      children,
      visible ? React.createElement('div', { role: 'tooltip' }, content) : null,
    );
  },
  PopoverPosition: { right: 'right' },
  PopoverTriggerType: { focus: 'focus', hover: 'hover' },
}));

import { KeybindingRegistry } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { IWindowDialogService } from '@opensumi/ide-overlay';

import { AgenticTaskRegistryService } from '../../../src/browser/acp/agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';
import { AgenticTaskList } from '../../../src/browser/acp/components/AgenticTaskList';
import chatStyles from '../../../src/browser/chat/chat.module.less';
import {
  getAvailableAgentConfigs,
  getConfiguredAgentConfigs,
  getDefaultAgentType,
} from '../../../src/browser/chat/get-default-agent-type';
import { IChatInternalService } from '../../../src/common';

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

function createTask(project: typeof projectA, sessionId: string, title: string) {
  return {
    sessionId,
    projectId: project.id,
    agentId: 'agent-a',
    title,
    createdAt: 1,
    archived: false,
    unread: false,
  };
}

function createServices() {
  return {
    registry: {
      archive: jest.fn(() => Promise.resolve(true)),
      archiveUnavailable: jest.fn(() => Promise.resolve(true)),
      listActiveGroups: jest.fn(() => Promise.resolve([])),
      listArchivedGroups: jest.fn(() => Promise.resolve([])),
      listProjects: jest.fn(() => Promise.resolve([projectA, projectB])),
      getTask: jest.fn(() => Promise.resolve(undefined)),
      onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
      renameProject: jest.fn(() => Promise.resolve(projectA)),
      removeManagedProject: jest.fn(() => Promise.resolve(true)),
      unarchive: jest.fn(() => Promise.resolve(true)),
    },
    workspaceSwitch: {
      activateTask: jest.fn(() => Promise.resolve({ status: 'activated' })),
      addProject: jest.fn(() => Promise.resolve(projectA)),
      archiveTask: jest.fn(() => Promise.resolve({ status: 'archived' })),
      isTaskLaunchPending: false,
      launchTask: jest.fn(() => Promise.resolve()),
      onDidChangeTaskLaunchPending: jest.fn(() => ({ dispose: jest.fn() })),
      refreshProjectAvailability: jest.fn(() => Promise.resolve()),
      seedProjectCatalog: jest.fn(() => Promise.resolve()),
    },
    keybindingRegistry: {
      acceleratorFor: jest.fn(() => []),
      getKeybindingsForCommand: jest.fn(() => []),
      onKeybindingsChanged: jest.fn(() => ({ dispose: jest.fn() })),
    },
    aiChatService: {
      enterAgenticTaskDraft: jest.fn(),
      isAgenticTaskSessionObserved: jest.fn(() => true),
    },
    preferenceService: {
      get: jest.fn(() => ({})),
      set: jest.fn(),
    },
    windowDialogService: {
      showOpenDialog: jest.fn(() => Promise.resolve([URI.file('/work/added-project')])),
    },
  };
}

describe('AgenticTaskList', () => {
  let chatView: HTMLDivElement;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (getAvailableAgentConfigs as jest.Mock).mockReturnValue({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });
    (getConfiguredAgentConfigs as jest.Mock).mockReturnValue({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });
    (getDefaultAgentType as jest.Mock).mockReturnValue('agent-a');
    chatView = document.createElement('div');
    window.sessionStorage.removeItem('agentic.task-list-width.v1');
    chatView.id = `${chatStyles.ai_chat_view}___runtime`;
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

  async function renderTaskList(services = createServices(), chatSlotWidth?: number) {
    if (chatSlotWidth !== undefined) {
      Object.defineProperty(chatView, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: chatSlotWidth }),
      });
    }
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
      if (token === KeybindingRegistry) {
        return services.keybindingRegistry;
      }
      return services.preferenceService;
    });

    await act(async () => {
      root.render(<AgenticTaskList />);
      await flushPromises();
    });
    return services;
  }

  it('seeds the current Project without rendering a global Task launcher in the Task List', async () => {
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
    expect(container.querySelector('[data-testid="agentic-task-list"]')?.getAttribute('aria-label')).toBe(
      'Agent Tasks',
    );
    expect(container.querySelector('h2')?.textContent).toBe('Agent Tasks');
    expect(container.querySelector('[data-testid="agentic-task-list-resize-handle"]')?.getAttribute('aria-label')).toBe(
      'Resize Agent Tasks',
    );
    expect(container.querySelector('[data-testid="agentic-task-launch-button"]')).toBeNull();
  });

  it('adds a selected directory from the Task List without showing a global New Task picker', async () => {
    const services = await renderTaskList();
    const addProject = container.querySelector('[data-testid="agentic-project-add-button"]') as HTMLButtonElement;

    expect(addProject).not.toBeNull();
    await act(async () => {
      addProject.click();
      await flushPromises();
    });

    expect(services.windowDialogService.showOpenDialog).toHaveBeenCalledWith({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Add Project',
    });
    expect(services.workspaceSwitch.addProject).toHaveBeenCalledWith(URI.file('/work/added-project'));
    expect(container.querySelector('[data-testid="agentic-task-launch-button"]')).toBeNull();
    expect(addProject.querySelector('.codicon.codicon-new-folder')).not.toBeNull();
    expect(addProject.querySelector('.codicon.codicon-add')).toBeNull();
  });

  it('renders an empty manually managed Project Group with a contextual New Task action', async () => {
    const services = createServices();
    const unnamedManagedProject = { ...projectA, label: undefined, managed: true as const };
    services.registry.listProjects.mockResolvedValue([unnamedManagedProject]);
    services.registry.listActiveGroups.mockResolvedValue([{ project: unnamedManagedProject, tasks: [] }]);

    await renderTaskList(services);

    const projectGroup = container.querySelector('[data-testid="agentic-task-project-group"]');
    expect(projectGroup?.textContent).toContain('a');
    const launchButton = projectGroup?.querySelector('[data-testid="agentic-task-launch-button"]');
    expect(launchButton?.textContent).toBe('');
    expect(launchButton?.querySelector('.codicon.codicon-add')).not.toBeNull();
    expect(launchButton?.getAttribute('aria-label')).toBe('New Task for a');
    expect(projectGroup?.querySelector('[data-testid="agentic-task-agent-menu-button"]')).toBeNull();
  });

  it('uses the active Task Agent before the user default for an empty Project Group', async () => {
    const services = createServices();
    const emptyManagedProject = { ...projectA, label: undefined, managed: true as const };
    services.registry.listProjects.mockResolvedValue([emptyManagedProject]);
    services.registry.listActiveGroups.mockResolvedValue([{ project: emptyManagedProject, tasks: [] }]);
    services.registry.getTask.mockResolvedValue({ agentId: 'agent-b' });
    services.aiChatService.sessionModel = { requests: [], sessionId: 'acp:active' };
    services.aiChatService.onChangeSession = jest.fn(() => ({ dispose: jest.fn() }));
    (getAvailableAgentConfigs as jest.Mock).mockReturnValue({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });
    (getConfiguredAgentConfigs as jest.Mock).mockReturnValue({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });
    (getDefaultAgentType as jest.Mock).mockReturnValue('agent-a');

    await renderTaskList(services);
    await act(async () => {
      await flushPromises();
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.workspaceSwitch.launchTask).toHaveBeenCalledWith(emptyManagedProject, 'agent-b');
  });

  it('keeps Project management actions in an overflow menu and removes only an empty managed Project', async () => {
    const services = createServices();
    const unnamedManagedProject = { ...projectA, label: undefined, managed: true as const };
    services.registry.listProjects.mockResolvedValue([unnamedManagedProject]);
    services.registry.listActiveGroups.mockResolvedValue([{ project: unnamedManagedProject, tasks: [] }]);
    await renderTaskList(services);

    const menu = container.querySelector('[aria-label="Manage a"]') as HTMLButtonElement;
    expect(menu).not.toBeNull();
    await act(async () => {
      menu.click();
    });

    expect(container.querySelector('[aria-label="Rename a"]')).not.toBeNull();
    const remove = container.querySelector('[aria-label="Remove a"]') as HTMLButtonElement;
    expect(remove).not.toBeNull();
    await act(async () => {
      remove.click();
      await flushPromises();
    });
    expect(services.registry.removeManagedProject).toHaveBeenCalledWith(unnamedManagedProject.id);
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

  it('collapses and re-expands Project Groups independently', async () => {
    const services = createServices();
    services.registry.listActiveGroups.mockResolvedValue([
      { project: projectA, tasks: [createTask(projectA, 'acp:project-a', 'Project A task')] },
      { project: projectB, tasks: [createTask(projectB, 'acp:project-b', 'Project B task')] },
    ]);
    await renderTaskList(services);

    const projectAToggle = container.querySelector(
      '[data-testid="agentic-task-project-toggle-project-a"]',
    ) as HTMLButtonElement;
    await act(async () => {
      projectAToggle.click();
    });

    expect(container.querySelector('[data-testid="agentic-task-row-acp:project-a"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-row-acp:project-b"]')).not.toBeNull();

    await act(async () => {
      projectAToggle.click();
    });

    expect(container.querySelector('[data-testid="agentic-task-row-acp:project-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-row-acp:project-b"]')).not.toBeNull();
  });

  it('exposes the Project Group expansion state and chevron direction', async () => {
    const services = createServices();
    services.registry.listActiveGroups.mockResolvedValue([
      { project: projectA, tasks: [createTask(projectA, 'acp:project-a', 'Project A task')] },
    ]);
    await renderTaskList(services);

    const toggle = container.querySelector(
      '[data-testid="agentic-task-project-toggle-project-a"]',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse Project A');
    expect(toggle.querySelector('.codicon.codicon-chevron-down')).not.toBeNull();
    expect(toggle.querySelector('.codicon.codicon-chevron-right')).toBeNull();
    expect(toggle.querySelector(`[title="${projectA.workspacePath}"]`)?.textContent).toBe('Project A');
    expect(toggle.querySelector('.project_count')?.textContent).toBe('1');

    await act(async () => {
      toggle.click();
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Expand Project A');
    expect(toggle.querySelector('.codicon.codicon-chevron-right')).not.toBeNull();
    expect(toggle.querySelector('.codicon.codicon-chevron-down')).toBeNull();
  });

  it('temporarily expands matching Project Groups during search and restores their collapse state', async () => {
    const services = createServices();
    services.registry.listActiveGroups.mockResolvedValue([
      { project: projectA, tasks: [createTask(projectA, 'acp:matching', 'Matching task')] },
    ]);
    await renderTaskList(services);

    const toggle = container.querySelector(
      '[data-testid="agentic-task-project-toggle-project-a"]',
    ) as HTMLButtonElement;
    await act(async () => {
      toggle.click();
    });
    expect(container.querySelector('[data-testid="agentic-task-row-acp:matching"]')).toBeNull();

    const search = container.querySelector('input[type="search"]') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, '  Matching  ');
    await act(async () => {
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
    });

    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:matching"]')).not.toBeNull();

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, '');
    await act(async () => {
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
    });

    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:matching"]')).toBeNull();
  });

  it('does not render an interactive disclosure for an empty Project Group', async () => {
    const services = createServices();
    const managedProject = { ...projectA, managed: true as const };
    services.registry.listProjects.mockResolvedValue([managedProject]);
    services.registry.listActiveGroups.mockResolvedValue([{ project: managedProject, tasks: [] }]);
    await renderTaskList(services);

    const projectGroup = container.querySelector('[data-testid="agentic-task-project-group"]');
    expect(projectGroup?.querySelector('[data-testid^="agentic-task-project-toggle-"]')).toBeNull();
    expect(projectGroup?.querySelector('.project_chevron')).not.toBeNull();
    expect(projectGroup?.querySelector('.project_chevron.codicon')).toBeNull();
  });

  it('retains a Project Group collapse state across Registry refreshes', async () => {
    const services = createServices();
    let onRegistryChange: (() => void) | undefined;
    let title = 'Initial task';
    (services.registry as any).onDidChange = (listener: () => void) => {
      onRegistryChange = listener;
      return { dispose: jest.fn() };
    };
    services.registry.listActiveGroups.mockImplementation(() =>
      Promise.resolve([{ project: projectA, tasks: [createTask(projectA, 'acp:refresh', title)] }]),
    );
    await renderTaskList(services);

    const toggle = container.querySelector(
      '[data-testid="agentic-task-project-toggle-project-a"]',
    ) as HTMLButtonElement;
    await act(async () => {
      toggle.click();
    });

    title = 'Refreshed task';
    await act(async () => {
      onRegistryChange?.();
      await flushPromises();
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:refresh"]')).toBeNull();

    await act(async () => {
      toggle.click();
    });

    expect(container.querySelector('[data-testid="agentic-task-row-acp:refresh"]')?.textContent).toContain(
      'Refreshed task',
    );
  });

  it('selects a newly registered Task after Chat switches to its session', async () => {
    const services = createServices();
    let onRegistryChange: (() => void) | undefined;
    let onSessionChange: (() => void) | undefined;
    const oldTask = {
      ...createTask(projectA, 'acp:old-session', 'Old session'),
      status: 'running' as const,
    };
    let tasks = [oldTask];
    services.workspaceSwitch.activateTask.mockResolvedValue({ status: 'activated' });
    (services.registry as any).onDidChange = (listener: () => void) => {
      onRegistryChange = listener;
      return { dispose: jest.fn() };
    };
    services.registry.listActiveGroups.mockImplementation(() => Promise.resolve([{ project: projectA, tasks }]));
    services.registry.getTask.mockImplementation((sessionId: string) =>
      Promise.resolve(tasks.find((task) => task.sessionId === sessionId)),
    );
    services.aiChatService.sessionModel = { requests: [], sessionId: 'acp:old-session' };
    services.aiChatService.onChangeSession = jest.fn((listener: () => void) => {
      onSessionChange = listener;
      return { dispose: jest.fn() };
    });
    await renderTaskList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-row-acp:old-session"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:old-session"]')?.getAttribute('aria-current'),
    ).toBe('true');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:old-session"]')?.className).toContain(
      'task_row_selected',
    );
    expect(
      container
        .querySelector('[data-testid="agentic-task-row-acp:old-session"]')
        ?.querySelector('[data-testid="agentic-task-status-acp:old-session"]')?.textContent,
    ).toBe('');

    services.aiChatService.sessionModel = { requests: [], sessionId: 'acp:new-session' };
    await act(async () => {
      onSessionChange?.();
      await flushPromises();
    });

    tasks = [createTask(projectA, 'acp:new-session', 'New session'), oldTask];
    await act(async () => {
      onRegistryChange?.();
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:new-session"]')?.getAttribute('aria-current'),
    ).toBe('true');
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:old-session"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('keeps the latest Task selected when an older Task lookup resolves late', async () => {
    const services = createServices();
    let onSessionChange: ((sessionId?: string) => void) | undefined;
    let resolveOldTask: (task: ReturnType<typeof createTask>) => void;
    const oldTask = createTask(projectA, 'acp:old-session', 'Old session');
    const newTask = createTask(projectA, 'acp:new-session', 'New session');
    const delayedOldTask = new Promise<ReturnType<typeof createTask>>((resolve) => {
      resolveOldTask = resolve;
    });
    services.registry.listActiveGroups.mockResolvedValue([{ project: projectA, tasks: [newTask, oldTask] }]);
    services.registry.getTask.mockImplementation((sessionId: string) =>
      sessionId === oldTask.sessionId ? delayedOldTask : Promise.resolve(newTask),
    );
    services.aiChatService.sessionModel = { requests: [], sessionId: oldTask.sessionId };
    services.aiChatService.onChangeSession = jest.fn((listener: (sessionId?: string) => void) => {
      onSessionChange = listener;
      return { dispose: jest.fn() };
    });
    await renderTaskList(services);

    services.aiChatService.sessionModel = { requests: [], sessionId: newTask.sessionId };
    await act(async () => {
      onSessionChange?.(newTask.sessionId);
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:new-session"]')?.getAttribute('aria-current'),
    ).toBe('true');

    await act(async () => {
      resolveOldTask!(oldTask);
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:new-session"]')?.getAttribute('aria-current'),
    ).toBe('true');
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:old-session"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('prunes collapse state after a Project is removed from the Registry', async () => {
    const services = createServices();
    let onRegistryChange: (() => void) | undefined;
    let projectPresent = true;
    (services.registry as any).onDidChange = (listener: () => void) => {
      onRegistryChange = listener;
      return { dispose: jest.fn() };
    };
    services.registry.listProjects.mockImplementation(() => Promise.resolve(projectPresent ? [projectA] : []));
    services.registry.listActiveGroups.mockImplementation(() =>
      Promise.resolve(
        projectPresent ? [{ project: projectA, tasks: [createTask(projectA, 'acp:readded', 'Re-added task')] }] : [],
      ),
    );
    await renderTaskList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-project-toggle-project-a"]') as HTMLButtonElement).click();
    });

    projectPresent = false;
    await act(async () => {
      onRegistryChange?.();
      await flushPromises();
    });
    projectPresent = true;
    await act(async () => {
      onRegistryChange?.();
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="agentic-task-project-toggle-project-a"]')?.getAttribute('aria-expanded'),
    ).toBe('true');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:readded"]')).not.toBeNull();
  });

  it('keeps New Task and Project management actions separate from the collapse toggle', async () => {
    const services = createServices();
    const managedProject = { ...projectA, managed: true as const };
    services.registry.listProjects.mockResolvedValue([managedProject]);
    services.registry.listActiveGroups.mockResolvedValue([
      { project: managedProject, tasks: [createTask(managedProject, 'acp:actions', 'Action task')] },
    ]);
    await renderTaskList(services);

    const toggle = container.querySelector(
      '[data-testid="agentic-task-project-toggle-project-a"]',
    ) as HTMLButtonElement;
    const projectGroup = toggle.closest('[data-testid="agentic-task-project-group"]');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      (projectGroup?.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:actions"]')).not.toBeNull();

    await act(async () => {
      (projectGroup?.querySelector('[aria-label="Manage Project A"]') as HTMLButtonElement).click();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:actions"]')).not.toBeNull();
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
    expect(container.querySelector('[data-testid="agentic-task-status-acp:layout"]')?.textContent).toBe('');
    expect(container.querySelector('[data-testid="agentic-task-archive-acp:layout"]')).toBeNull();
  });

  it('keeps a live Task Row compact while revealing full metadata through hover and keyboard focus', async () => {
    const services = createServices();
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:compact',
            projectId: projectA.id,
            agentId: 'agent-b',
            title: 'A deliberately long Task Title for compact presentation',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'running' as const,
          },
        ],
      },
    ]);

    await renderTaskList(services);

    const row = container.querySelector('[data-testid="agentic-task-row-acp:compact"]') as HTMLButtonElement;
    expect(row.getAttribute('title')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-agent-acp:compact"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-status-acp:compact"]')?.textContent).toBe('');
    expect(row.getAttribute('aria-label')).toBe(
      'A deliberately long Task Title for compact presentation. Agent: Agent B (agent-b). Status: Running.',
    );
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    const popover = container.querySelector('[data-popover-id="agentic-task-tooltip-acp:compact"]') as HTMLElement;
    await act(async () => {
      popover.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await flushPromises();
    });
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain(
      'A deliberately long Task Title for compact presentation',
    );
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('Agent: Agent B (agent-b)');
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('Status: Running');

    await act(async () => {
      row.focus();
      await flushPromises();
    });
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();

    await act(async () => {
      row.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      await flushPromises();
    });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('renders exceptional Task metadata, keeps ready rows silent and archive-eligible, and filters unavailable Projects', async () => {
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
            sessionId: 'acp:input',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Await input',
            createdAt: 3,
            archived: false,
            unread: false,
            status: 'stopped' as const,
            attention: 'input' as const,
          },
          {
            sessionId: 'acp:running',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Running task',
            createdAt: 3,
            archived: false,
            unread: false,
            status: 'running' as const,
          },
          {
            sessionId: 'acp:stopped',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Stopped task',
            createdAt: 3,
            archived: false,
            unread: false,
            status: 'stopped' as const,
          },
          {
            sessionId: 'acp:error',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Error task',
            createdAt: 3,
            archived: false,
            unread: false,
            status: 'error' as const,
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
          {
            sessionId: 'acp:unknown',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Unknown status task',
            createdAt: -1,
            archived: false,
            unread: false,
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

    const expectMetadata = (testId: string, kind: string, iconClass: string, toneClass: string) => {
      const metadata = container.querySelector(`[data-testid="${testId}"]`);
      expect(metadata?.getAttribute('data-agentic-task-meta-kind')).toBe(kind);
      expect(metadata?.textContent).toBe('');
      expect(metadata?.className).toContain(toneClass);
      const icon = metadata?.querySelector(`.codicon.${iconClass}`);
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    };

    expectMetadata('agentic-task-attention-acp:permission', 'permission', 'codicon-shield', 'task_meta_warning');
    expectMetadata('agentic-task-attention-acp:input', 'input', 'codicon-edit', 'task_meta_warning');
    expectMetadata('agentic-task-status-acp:running', 'running', 'codicon-loading', 'task_meta_information');
    expect(
      container
        .querySelector('[data-testid="agentic-task-status-acp:running"] .codicon.codicon-modifier-spin')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expectMetadata('agentic-task-status-acp:stopped', 'stopped', 'codicon-circle-slash', 'task_meta_secondary');
    expectMetadata('agentic-task-status-acp:error', 'error', 'codicon-error', 'task_meta_error');
    expect(container.querySelector('[data-testid="agentic-task-status-acp:permission"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-unread-acp:permission"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:permission"]')?.getAttribute('aria-label'),
    ).toContain('Status: Permission required.');
    expect(container.querySelector('[data-testid="agentic-task-row-acp:input"]')?.getAttribute('aria-label')).toContain(
      'Status: Input needed.',
    );
    expect(container.querySelector('.task_state')).toBeNull();

    const readyRow = container.querySelector('[data-testid="agentic-task-row-acp:ready"]');
    expect(readyRow?.textContent).toContain('Ready task');
    expect(readyRow?.textContent).not.toContain('ready');
    expect(readyRow?.textContent).not.toContain('Agent A');
    expect(container.querySelector('[data-testid="agentic-task-status-acp:ready"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-status-acp:unknown"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-archive-acp:unknown"]')).toBeNull();

    const archive = container.querySelector('[data-testid="agentic-task-archive-acp:ready"]');
    expect(archive?.textContent).toBe('');
    expect(archive?.getAttribute('aria-label')).toBe('Archive Ready task');
    expect(archive?.getAttribute('title')).toBe('Archive Ready task');
    expect(archive?.querySelector('.codicon.codicon-archive')).not.toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-row-acp:ready"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.activateTask).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'acp:ready' }),
    );

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-archive-acp:ready"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.archiveTask).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'acp:ready' }),
      { conversationUnavailable: false },
    );

    expect(container.querySelector('[data-testid="agentic-task-row-acp:unavailable"]')).toBeNull();
    expect(container.textContent).not.toContain('Unavailable task');
    expect(container.textContent).not.toContain('Unavailable');
  });

  it('keeps the active Task Row when the requested Task session fails to activate', async () => {
    const services = createServices();
    services.workspaceSwitch.activateTask
      .mockResolvedValueOnce({ status: 'activated' })
      .mockResolvedValueOnce({ status: 'conversation-unavailable' });
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:active',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Active task',
            createdAt: 2,
            archived: false,
            unread: false,
          },
          {
            sessionId: 'acp:failed',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Failed task',
            createdAt: 1,
            archived: false,
            unread: false,
          },
        ],
      },
    ]);
    await renderTaskList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-row-acp:active"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-row-acp:failed"]') as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="agentic-task-row-acp:active"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:failed"]')?.getAttribute('aria-current'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-availability-acp:failed"]')?.textContent).toBe('');
    expect(
      container.querySelector('[data-testid="agentic-task-availability-acp:failed"] .codicon.codicon-history'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:failed"]')?.getAttribute('aria-label'),
    ).toContain('Status: History unavailable. Select the task to retry loading its history.');

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-row-acp:failed"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.activateTask).toHaveBeenCalledTimes(3);
  });

  it('selects only the most recent Task Row after rapid successful activation requests', async () => {
    const services = createServices();
    let resolveFirstActivation: (result: { status: 'activated' }) => void;
    let resolveSecondActivation: (result: { status: 'activated' }) => void;
    const firstActivation = new Promise<{ status: 'activated' }>((resolve) => {
      resolveFirstActivation = resolve;
    });
    const secondActivation = new Promise<{ status: 'activated' }>((resolve) => {
      resolveSecondActivation = resolve;
    });
    services.workspaceSwitch.activateTask.mockReturnValueOnce(firstActivation).mockReturnValueOnce(secondActivation);
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:first',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'First task',
            createdAt: 2,
            archived: false,
            unread: false,
          },
          {
            sessionId: 'acp:second',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Second task',
            createdAt: 1,
            archived: false,
            unread: false,
          },
        ],
      },
    ]);
    await renderTaskList(services);

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-row-acp:first"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="agentic-task-row-acp:second"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    await act(async () => {
      resolveFirstActivation!({ status: 'activated' });
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:first"]')?.getAttribute('aria-current'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:second"]')?.getAttribute('aria-current'),
    ).toBeNull();

    await act(async () => {
      resolveSecondActivation!({ status: 'activated' });
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="agentic-task-row-acp:second"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('shows the originating Agent and marks persisted ACP status as last known until the session is observed', async () => {
    const services = createServices();
    services.aiChatService.isAgenticTaskSessionObserved.mockReturnValue(false);
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:last-known',
            projectId: projectA.id,
            agentId: 'agent-b',
            title: 'Background task',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'running' as const,
          },
        ],
      },
    ]);

    await renderTaskList(services);

    expect(container.querySelector('[data-testid="agentic-task-agent-acp:last-known"]')).toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-status-acp:last-known"]')?.textContent).toBe('');
    expect(
      container.querySelector('[data-testid="agentic-task-status-acp:last-known"] .codicon.codicon-history'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="agentic-task-status-acp:last-known"] .codicon-modifier-spin'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="agentic-task-row-acp:last-known"]')?.getAttribute('aria-label'),
    ).toContain('Status: Last known status: Running.');
  });

  it('validates Last-known status before archive and archives a missing Task Conversation without rewriting status', async () => {
    const services = createServices();
    services.aiChatService.isAgenticTaskSessionObserved.mockReturnValue(false);
    services.workspaceSwitch.archiveTask
      .mockResolvedValueOnce({ status: 'not-archivable' })
      .mockResolvedValueOnce({ status: 'archived', availability: 'conversation-unavailable' });
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:archive-validation',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Validate before archive',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'running' as const,
          },
        ],
      },
    ]);

    await renderTaskList(services);
    const archive = container.querySelector(
      '[data-testid="agentic-task-archive-acp:archive-validation"]',
    ) as HTMLButtonElement;

    await act(async () => {
      archive.click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.archiveTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sessionId: 'acp:archive-validation' }),
      { conversationUnavailable: false },
    );

    await act(async () => {
      archive.click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.archiveTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sessionId: 'acp:archive-validation' }),
      { conversationUnavailable: false },
    );
  });

  it('keeps a Task from a missing Agent visible, disables activation, and allows unavailable archive', async () => {
    const services = createServices();
    (getAvailableAgentConfigs as jest.Mock).mockReturnValue({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
    });
    services.aiChatService.isAgenticTaskSessionObserved.mockReturnValue(false);
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:missing-agent',
            projectId: projectA.id,
            agentId: 'agent-b',
            title: 'Retained Agent B task',
            createdAt: 1,
            archived: false,
            unread: false,
            status: 'running' as const,
          },
        ],
      },
    ]);

    await renderTaskList(services);

    const row = container.querySelector('[data-testid="agentic-task-row-acp:missing-agent"]') as HTMLButtonElement;
    expect(row.disabled).toBe(false);
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector('[data-testid="agentic-task-availability-acp:missing-agent"]')?.textContent).toBe(
      '',
    );
    expect(
      container.querySelector(
        '[data-testid="agentic-task-availability-acp:missing-agent"] .codicon.codicon-debug-disconnect',
      ),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="agentic-task-agent-acp:missing-agent"]')).toBeNull();
    expect(row.getAttribute('aria-label')).toContain('Status: Agent unavailable.');
    await act(async () => {
      row.focus();
      row.click();
      await flushPromises();
    });
    expect(document.activeElement).toBe(row);
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-archive-acp:missing-agent"]') as HTMLButtonElement).click();
      await flushPromises();
    });
    expect(services.workspaceSwitch.archiveTask).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'acp:missing-agent' }),
      { conversationUnavailable: false },
    );
    expect(services.workspaceSwitch.activateTask).not.toHaveBeenCalled();
  });

  it('keeps unread visible and dismisses the Task metadata Tooltip when the Archive action receives focus', async () => {
    const services = createServices();
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: projectA,
        tasks: [
          {
            sessionId: 'acp:action-disclosure',
            projectId: projectA.id,
            agentId: 'agent-a',
            title: 'Unread archive candidate',
            createdAt: 1,
            archived: false,
            unread: true,
            status: 'ready' as const,
          },
        ],
      },
    ]);

    await renderTaskList(services);

    const row = container.querySelector('[data-testid="agentic-task-row-acp:action-disclosure"]') as HTMLButtonElement;
    const archive = container.querySelector(
      '[data-testid="agentic-task-archive-acp:action-disclosure"]',
    ) as HTMLButtonElement;
    const unread = container.querySelector('[data-testid="agentic-task-unread-acp:action-disclosure"]');

    await act(async () => {
      row.focus();
      await flushPromises();
    });
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();

    await act(async () => {
      archive.focus();
      await flushPromises();
    });
    expect(document.activeElement).toBe(archive);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(unread).not.toBeNull();
    expect(row.querySelector('.task_action_space')).not.toBeNull();
  });

  it('refreshes archived-only Projects and filters unavailable archived Task rows', async () => {
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
    expect(container.querySelector('[data-testid="agentic-task-row-acp:archived-unavailable"]')).toBeNull();
    expect(container.textContent).not.toContain('Archived unavailable Task');
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
    expect(archivedArea?.querySelector(`[title="${projectA.workspacePath}"]`)?.textContent).toContain('Project A');

    const unarchive = container.querySelector('[data-testid="agentic-task-unarchive-acp:archived-ready"]');
    expect(unarchive?.textContent).toBe('');
    expect(unarchive?.getAttribute('aria-label')).toBe('Unarchive Archived ready Task');
    expect(unarchive?.getAttribute('title')).toBe('Unarchive Archived ready Task');
    expect(unarchive?.querySelector('.codicon.codicon-archive')).not.toBeNull();
    await act(async () => {
      (unarchive as HTMLButtonElement).click();
      await flushPromises();
    });

    expect(services.registry.unarchive).toHaveBeenCalledWith('acp:archived-ready');
  });

  it('clamps local Task List resizing to the Agentic Chat Slot bounds', async () => {
    await renderTaskList();
    Object.defineProperty(chatView, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1000 }),
    });
    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240 }));
    });

    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });

  it('keeps 360px for the Main Conversation Area in a narrow Chat Slot', async () => {
    await renderTaskList(createServices(), 640);
    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240 }));
    });

    expect(handle.getAttribute('aria-valuemax')).toBe('280');
    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });

  it('recalculates the resize bound when the Chat Slot changes before a drag begins', async () => {
    await renderTaskList(createServices(), 1000);
    Object.defineProperty(chatView, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 640 }),
    });
    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240 }));
    });

    expect(handle.getAttribute('aria-valuemax')).toBe('280');
    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });

  it('restores the preferred Task List width after a temporary narrow-slot clamp', async () => {
    let chatSlotWidth = 1000;
    Object.defineProperty(chatView, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: chatSlotWidth }),
    });
    await renderTaskList();
    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 162 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 162 }));
    });
    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');

    act(() => root.unmount());
    chatView.remove();
    chatSlotWidth = 594.59;
    chatView = document.createElement('div');
    chatView.id = `${chatStyles.ai_chat_view}___narrow`;
    Object.defineProperty(chatView, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: chatSlotWidth }),
    });
    container = document.createElement('div');
    chatView.appendChild(container);
    document.body.appendChild(chatView);
    root = createRoot(container);
    await renderTaskList();
    const narrowHandle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;
    await act(async () => {
      narrowHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 0 }));
    });
    expect(Number.parseFloat(chatView.style.getPropertyValue('--agentic-task-list-width'))).toBeCloseTo(234.59);

    act(() => root.unmount());
    chatView.remove();
    chatSlotWidth = 1000;
    chatView = document.createElement('div');
    chatView.id = `${chatStyles.ai_chat_view}___wide`;
    Object.defineProperty(chatView, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: chatSlotWidth }),
    });
    container = document.createElement('div');
    chatView.appendChild(container);
    document.body.appendChild(chatView);
    root = createRoot(container);
    await renderTaskList();
    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });

  it('resizes from desktop mouse movement after the pointer leaves the narrow handle', async () => {
    await renderTaskList(createServices(), 1000);
    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]') as HTMLDivElement;

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240 }));
    });

    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });

  it('clamps a previously stored Task List width to the current maximum', async () => {
    window.sessionStorage.setItem('agentic.task-list-width.v1', '480');

    await renderTaskList(createServices(), 1000);

    const handle = container.querySelector('[data-testid="agentic-task-list-resize-handle"]');
    expect(handle?.getAttribute('aria-valuemax')).toBe('280');
    expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
  });

  it('uses the cwd leaf when a Project has no custom name while retaining the full cwd', async () => {
    const services = createServices();
    const unnamedProject = { ...projectA, label: undefined, workspacePath: '/ossfs/w/' };
    services.registry.listProjects.mockResolvedValue([unnamedProject]);
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: unnamedProject,
        tasks: [
          {
            sessionId: 'acp:unnamed-project',
            projectId: unnamedProject.id,
            agentId: 'agent-a',
            title: 'Task for unnamed Project',
            createdAt: 1,
            archived: false,
            unread: false,
          },
        ],
      },
    ]);

    await renderTaskList(services);

    expect(container.querySelector('[data-testid="agentic-task-project-group"]')?.textContent).toContain('w');
    expect(container.querySelector('[title="/ossfs/w/"]')).not.toBeNull();
    const manage = container.querySelector('[aria-label="Manage w"]') as HTMLButtonElement;
    await act(async () => {
      manage.click();
    });
    const rename = container.querySelector('[aria-label="Rename w"]') as HTMLButtonElement;
    expect(rename).not.toBeNull();

    await act(async () => {
      rename.click();
    });
    const input = document.querySelector('[aria-label="Project name"]') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('w');
    expect(document.body.textContent).toContain('/ossfs/w/');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Payments');
    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
    });
    await act(async () => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save')
        ?.click();
      await flushPromises();
    });

    expect(services.registry.renameProject).toHaveBeenCalledWith(unnamedProject.id, 'Payments');
  });

  it('keeps collision-aware default Project labels stable while filtering Task titles', async () => {
    const services = createServices();
    const firstProject = { ...projectA, id: 'project-first', label: undefined, workspacePath: '/ossfs/a/w' };
    const secondProject = { ...projectB, id: 'project-second', label: undefined, workspacePath: '/work/b/w' };
    services.registry.listProjects.mockResolvedValue([firstProject, secondProject]);
    services.registry.listActiveGroups.mockResolvedValue([
      {
        project: firstProject,
        tasks: [
          {
            sessionId: 'acp:first-project',
            projectId: firstProject.id,
            agentId: 'agent-a',
            title: 'First Project Task',
            createdAt: 2,
            archived: false,
            unread: false,
          },
        ],
      },
      {
        project: secondProject,
        tasks: [
          {
            sessionId: 'acp:second-project',
            projectId: secondProject.id,
            agentId: 'agent-b',
            title: 'Second Project Task',
            createdAt: 1,
            archived: false,
            unread: false,
          },
        ],
      },
    ]);

    await renderTaskList(services);

    expect(container.textContent).toContain('a/w');
    expect(container.textContent).toContain('b/w');

    const search = container.querySelector('input[type="search"]') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'First');
    await act(async () => {
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain('a/w');
  });
});
