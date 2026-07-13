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

import { PreferenceService } from '@opensumi/ide-core-browser';

import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';
import { AgenticTaskLaunchMenu } from '../../../src/browser/acp/components/AgenticTaskLaunchMenu';
import { IChatInternalService } from '../../../src/common';

const projectB = {
  id: 'project-b',
  workspaceUri: 'file:///work/b',
  workspacePath: '/work/b',
  label: 'Project B',
  joinedAt: 10,
  availability: 'available' as const,
};

const projectA = {
  id: 'project-a',
  workspaceUri: 'file:///work/a',
  workspacePath: '/work/a',
  label: 'Project A',
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

  it('selects Project before Agent and leaves the default Agent preference unchanged', async () => {
    const workspaceSwitch = {
      launchTask: jest.fn(() => Promise.resolve(true)),
    };
    const activeChatService = { enterAgenticTaskDraft: jest.fn() };
    const preferenceService = {
      get: jest.fn(() => ({
        'agent-b': {
          command: 'agent-b',
          description: 'Agent B',
        },
      })),
      set: jest.fn(),
    };

    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticWorkspaceSwitchService) {
        return workspaceSwitch;
      }
      if (token === PreferenceService) {
        return preferenceService;
      }
      if (token === IChatInternalService) {
        return activeChatService;
      }
      return {};
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu projects={[projectB]} />);
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain('Project B');
    expect(container.textContent).not.toContain('Agent B');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Project B')
        ?.click();
    });
    expect(container.textContent).toContain('Agent B');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agent B')
        ?.click();
      await Promise.resolve();
    });

    expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(projectB, 'agent-b');
    expect(activeChatService.enterAgenticTaskDraft).not.toHaveBeenCalled();
    expect(preferenceService.set).not.toHaveBeenCalled();
  });

  it('keeps registry catalog Project order in the picker', async () => {
    const workspaceSwitch = {
      launchTask: jest.fn(() => Promise.resolve()),
    };
    const preferenceService = {
      get: jest.fn(() => ({})),
      set: jest.fn(),
    };
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticWorkspaceSwitchService) {
        return workspaceSwitch;
      }
      if (token === PreferenceService) {
        return preferenceService;
      }
      return {};
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu projects={[projectB, projectA]} />);
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
    });

    expect(Array.from(container.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent)).toEqual([
      'Project B',
      'Project A',
    ]);
  });

  it('disables New Task when every Project is unavailable', async () => {
    const workspaceSwitch = { launchTask: jest.fn(() => Promise.resolve()) };
    const preferenceService = { get: jest.fn(() => ({})), set: jest.fn() };
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticWorkspaceSwitchService) {
        return workspaceSwitch;
      }
      if (token === PreferenceService) {
        return preferenceService;
      }
      return {};
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu projects={[{ ...projectA, availability: 'unavailable' }]} />);
      await Promise.resolve();
    });

    expect((container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('preselects the active Project and Agent while requiring both confirmations', async () => {
    const workspaceSwitch = { launchTask: jest.fn(() => Promise.resolve()) };
    const preferenceService = {
      get: jest.fn(() => ({
        'agent-a': { command: 'agent-a', description: 'Agent A' },
        'agent-b': { command: 'agent-b', description: 'Agent B' },
      })),
      set: jest.fn(),
    };
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticWorkspaceSwitchService) {
        return workspaceSwitch;
      }
      if (token === PreferenceService) {
        return preferenceService;
      }
      return {};
    });

    await act(async () => {
      root.render(
        <AgenticTaskLaunchMenu
          {...({
            preferredAgentId: 'agent-b',
            preferredProjectId: projectA.id,
            projects: [projectB, projectA],
          } as any)}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
    });

    const projectAButton = Array.from(container.querySelectorAll('[role="menuitem"]')).find(
      (button) => button.textContent === 'Project A',
    ) as HTMLButtonElement;
    expect(projectAButton.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(projectAButton);
    expect(workspaceSwitch.launchTask).not.toHaveBeenCalled();

    await act(async () => {
      projectAButton.click();
    });

    const agentBButton = Array.from(container.querySelectorAll('[role="menuitem"]')).find(
      (button) => button.textContent === 'Agent B',
    ) as HTMLButtonElement;
    expect(agentBButton.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(agentBButton);
    expect(workspaceSwitch.launchTask).not.toHaveBeenCalled();
  });

  it('filters unavailable Projects from a non-empty Project picker', async () => {
    const workspaceSwitch = { launchTask: jest.fn(() => Promise.resolve()) };
    const preferenceService = { get: jest.fn(() => ({})), set: jest.fn() };
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: unknown) => {
      if (token === AgenticWorkspaceSwitchService) {
        return workspaceSwitch;
      }
      if (token === PreferenceService) {
        return preferenceService;
      }
      return {};
    });

    await act(async () => {
      root.render(<AgenticTaskLaunchMenu projects={[projectA, { ...projectB, availability: 'unavailable' }]} />);
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="agentic-task-launch-button"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('Project A');
    expect(container.textContent).not.toContain('Project B');
    expect(container.textContent).not.toContain('Unavailable');
  });
});
