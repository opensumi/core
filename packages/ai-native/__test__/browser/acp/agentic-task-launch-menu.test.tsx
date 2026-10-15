import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  COMMON_COMMANDS: { OPEN_PREFERENCES: { id: 'preferences.open' } },
  CommandService: class CommandService {},
  KeybindingRegistry: class KeybindingRegistry {},
  PreferenceService: class PreferenceService {},
  fastdom: { measureAtNextFrame: (callback: () => void) => callback() },
  getIcon: (icon: string) => `codicon codicon-${icon}`,
  localize: jest.fn((_key: string, fallback: string) => fallback),
  useInjectable: jest.fn(),
}));

jest.mock('../../../src/browser/acp/agentic-workspace-switch.service', () => ({
  AgenticWorkspaceSwitchService: class AgenticWorkspaceSwitchService {},
}));

jest.mock('../../../src/browser/chat/get-default-agent-type', () => ({
  getAvailableAgentConfigs: jest.fn(),
  getConfiguredAgentConfigs: jest.fn(),
  getDefaultAgentType: jest.fn(),
}));

import { CommandService, KeybindingRegistry, PreferenceService, localize } from '@opensumi/ide-core-browser';
import { ChatInputRegistryToken } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';
import { AgenticTaskLaunchMenu } from '../../../src/browser/acp/components/AgenticTaskLaunchMenu';
import { AI_CHAT_NEW_TASK } from '../../../src/browser/chat/acp-new-draft.commands';
import {
  getAvailableAgentConfigs,
  getConfiguredAgentConfigs,
  getDefaultAgentType,
} from '../../../src/browser/chat/get-default-agent-type';

const project = {
  id: 'project-a',
  workspaceUri: 'file:///work/a',
  workspacePath: '/work/a',
  label: 'Project A',
  lastAgentId: 'agent-b',
  joinedAt: 20,
  availability: 'available' as const,
};

describe('AgenticTaskLaunchMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  function configureServices(agentConfigs: Record<string, { command: string; description: string }>) {
    const commandService = { executeCommand: jest.fn() };
    const chatInputRegistry = {
      focusActiveInput: jest.fn(),
      isActiveInputFocused: jest.fn(() => true),
    };
    const taskLaunchListeners = new Set<(pending: boolean) => void>();
    let taskLaunchPending = false;
    const workspaceSwitch = {
      get isTaskLaunchPending() {
        return taskLaunchPending;
      },
      launchTask: jest.fn(() => Promise.resolve(true)),
      onDidChangeTaskLaunchPending: jest.fn((listener: (pending: boolean) => void) => {
        taskLaunchListeners.add(listener);
        return { dispose: jest.fn(() => taskLaunchListeners.delete(listener)) };
      }),
    };
    const keybindingRegistry = {
      acceleratorFor: jest.fn(() => ['Ctrl+Alt+N']),
      getKeybindingsForCommand: jest.fn(() => [{ keybinding: 'ctrlcmd+alt+n', priority: 0, resolved: [{}] }]),
      onKeybindingsChanged: jest.fn(() => ({ dispose: jest.fn() })),
    };
    const preferenceService = { get: jest.fn(() => agentConfigs), set: jest.fn(() => Promise.resolve()) };
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticWorkspaceSwitchService) {
        return workspaceSwitch;
      }
      if (token === PreferenceService) {
        return preferenceService;
      }
      if (token === CommandService) {
        return commandService;
      }
      if (token === ChatInputRegistryToken) {
        return chatInputRegistry;
      }
      if (token === KeybindingRegistry) {
        return keybindingRegistry;
      }
      return {};
    });
    (getAvailableAgentConfigs as jest.Mock).mockReturnValue(agentConfigs);
    (getConfiguredAgentConfigs as jest.Mock).mockReturnValue(agentConfigs);
    (getDefaultAgentType as jest.Mock).mockReturnValue('agent-a');
    return {
      chatInputRegistry,
      commandService,
      preferenceService,
      setTaskLaunchPending: (pending: boolean) => {
        taskLaunchPending = pending;
        taskLaunchListeners.forEach((listener) => listener(pending));
      },
      workspaceSwitch,
    };
  }

  it('launches its contextual Project with the current Agent selection', async () => {
    const { chatInputRegistry, workspaceSwitch } = configureServices({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, preferredAgentId: 'agent-a' } as any)} />);
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(project, 'agent-a');
    expect(chatInputRegistry.focusActiveInput).toHaveBeenCalled();
    expect(container.textContent).not.toContain('Choose Project');
  });

  it('launches the default Agent directly and keeps a separate Agent override menu', async () => {
    const { commandService, workspaceSwitch } = configureServices({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });
    expect((container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).title).toBe('');
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(commandService.executeCommand).toHaveBeenCalledWith(AI_CHAT_NEW_TASK.id, 'agent-a');
    expect(workspaceSwitch.launchTask).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="agentic-task-agent-menu"]')).toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="agentic-task-agent-menu"]')).not.toBeNull();
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-option-agent-a"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(commandService.executeCommand).toHaveBeenLastCalledWith(AI_CHAT_NEW_TASK.id, 'agent-a');
  });

  it('keeps Agent Configuration reachable when no ACP Agent is configured', async () => {
    const { commandService } = configureServices({});

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });

    const launchButton = container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement;
    const menuButton = container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement;
    expect(launchButton.disabled).toBe(true);
    expect(launchButton.title).toBe('');
    expect(menuButton.disabled).toBe(false);
    await act(async () => {
      menuButton.click();
      await Promise.resolve();
    });
    expect(localize).toHaveBeenCalledWith('aiNative.chat.agentSelector.configureAgents', 'Agent 配置');
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-config-menu-item"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(commandService.executeCommand).toHaveBeenCalledWith('preferences.open', 'ai.native.agent.configs');
  });

  it('disables both header actions while shared Task Launch is pending', async () => {
    const { setTaskLaunchPending } = configureServices({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });
    await act(async () => {
      setTaskLaunchPending(true);
    });

    expect((container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('refreshes the header Agent menu when Agent configuration changes', async () => {
    const { preferenceService } = configureServices({});
    let agentConfigs: Record<string, { command: string; description: string }> = {};
    const preferenceListeners = new Map<string, () => void>();
    preferenceService.onSpecificPreferenceChange = jest.fn((preferenceId: string, listener: () => void) => {
      preferenceListeners.set(preferenceId, listener);
      return { dispose: jest.fn() };
    });
    (getConfiguredAgentConfigs as jest.Mock).mockImplementation(() => agentConfigs);

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-menu-button"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="agentic-task-agent-option-agent-a"]')).toBeNull();

    agentConfigs = { 'agent-a': { command: 'agent-a', description: 'Agent A' } };
    await act(async () => {
      preferenceListeners.get(AINativeSettingSectionsId.AgentConfigs)?.();
    });

    expect(container.querySelector('[data-testid="agentic-task-agent-option-agent-a"]')).not.toBeNull();
  });

  it('renders a task-list launcher as one icon-only button without an Agent menu', async () => {
    configureServices({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, projectLabel: 'Project A' } as any)} />);
    });

    const launchButton = container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement;
    expect(launchButton.querySelector('.codicon-add')).not.toBeNull();
    expect(launchButton.getAttribute('aria-label')).toBe('New session for Project A');
    expect(container.querySelector('[data-testid="agentic-task-agent-menu-button"]')).toBeNull();
  });
});
