import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  COMMON_COMMANDS: { OPEN_PREFERENCES: { id: 'preferences.open' } },
  CommandService: class CommandService {},
  PreferenceService: class PreferenceService {},
  getIcon: (icon: string) => `codicon codicon-${icon}`,
  localize: jest.fn((_key: string, fallback: string) => fallback),
  useInjectable: jest.fn(),
}));

jest.mock('../../../src/browser/acp/agentic-workspace-switch.service', () => ({
  AgenticWorkspaceSwitchService: class AgenticWorkspaceSwitchService {},
}));

jest.mock('../../../src/browser/chat/get-default-agent-type', () => ({
  getAvailableAgentConfigs: jest.fn(),
  getDefaultAgentType: jest.fn(),
}));

import { CommandService, PreferenceService, localize } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';
import { AgenticTaskLaunchMenu } from '../../../src/browser/acp/components/AgenticTaskLaunchMenu';
import { getAvailableAgentConfigs, getDefaultAgentType } from '../../../src/browser/chat/get-default-agent-type';

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
    const workspaceSwitch = { launchTask: jest.fn(() => Promise.resolve(true)) };
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
      return {};
    });
    (getAvailableAgentConfigs as jest.Mock).mockReturnValue(agentConfigs);
    (getDefaultAgentType as jest.Mock).mockReturnValue('agent-a');
    return { commandService, preferenceService, workspaceSwitch };
  }

  it('launches its contextual Project directly with its recalled Agent', async () => {
    const { workspaceSwitch } = configureServices({
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

    expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(project, 'agent-b');
    expect(container.textContent).not.toContain('Choose Project');
  });

  it('opens an anchored Agent menu from the chat header plus and launches its selected Agent', async () => {
    const { workspaceSwitch } = configureServices({
      'agent-a': { command: 'agent-a', description: 'Agent A' },
      'agent-b': { command: 'agent-b', description: 'Agent B' },
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
    });

    expect(workspaceSwitch.launchTask).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="agentic-task-agent-menu"]')).not.toBeNull();
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-option-agent-a"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(project, 'agent-a');
  });

  it('keeps the chat header plus enabled for Agent Configuration when no ACP Agent is configured', async () => {
    const { commandService } = configureServices({});

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });

    const launchButton = container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement;
    expect(launchButton.disabled).toBe(false);
    await act(async () => {
      launchButton.click();
      await Promise.resolve();
    });
    expect(localize).toHaveBeenCalledWith('aiNative.chat.agentSelector.configureAgents', 'Agent 配置');
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-agent-config-menu-item"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(commandService.executeCommand).toHaveBeenCalledWith('preferences.open', 'ai.native.agent.configs');
  });

  it('refreshes the header Agent menu when Agent configuration changes', async () => {
    const { preferenceService } = configureServices({});
    let agentConfigs: Record<string, { command: string; description: string }> = {};
    const preferenceListeners = new Map<string, () => void>();
    preferenceService.onSpecificPreferenceChange = jest.fn((preferenceId: string, listener: () => void) => {
      preferenceListeners.set(preferenceId, listener);
      return { dispose: jest.fn() };
    });
    (getAvailableAgentConfigs as jest.Mock).mockImplementation(() => agentConfigs);

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu {...({ project, variant: 'chat-header' } as any)} />);
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
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
    expect(launchButton.getAttribute('aria-label')).toBe('New Task for Project A');
    expect(container.querySelector('[data-testid="agentic-task-agent-menu-button"]')).toBeNull();
  });
});
