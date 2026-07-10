import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { Simulate, act } from 'react-dom/test-utils';

import { AIChatLogoAvatar } from '../../src/browser/layout/view/avatar/avatar.view';

const mockToggleAIChatView = jest.fn();
const mockSetLayoutMode = jest.fn();
const mockGetLayoutMode = jest.fn(() => 'agentic');
const layoutChangeListeners: Array<(mode: string) => void> = [];
const mockOnDidChangePanelLayout = jest.fn((listener: (mode: string) => void) => {
  layoutChangeListeners.push(listener);
  return {
    dispose: () => {
      const idx = layoutChangeListeners.indexOf(listener);
      if (idx >= 0) {
        layoutChangeListeners.splice(idx, 1);
      }
    },
  };
});

jest.mock('@opensumi/ide-core-browser', () => ({
  localize: (_key: string, defaultValue?: string) => defaultValue || _key,
  useInjectable: (token: any) => {
    if (token?.name === 'AIPanelLayoutService') {
      return {
        getLayoutMode: mockGetLayoutMode,
        setLayoutMode: mockSetLayoutMode,
        toggleAIChatView: mockToggleAIChatView,
        onDidChangePanelLayout: mockOnDidChangePanelLayout,
      };
    }
    return {};
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => {
  const React = require('react');
  return {
    AILogoAvatar: ({ iconClassName }: any) =>
      React.createElement('span', {
        'data-testid': 'ai-logo-avatar',
        className: iconClassName,
      }),
  };
});

jest.mock('../../src/browser/layout/panel-layout.service', () => ({
  AIPanelLayoutService: class AIPanelLayoutService {},
  getAIChatDefaultSize: (mode: string) => (mode === 'agentic' ? 840 : 360),
}));

jest.mock('../../src/browser/layout/view/avatar/avatar.module.less', () => ({
  ai_actions: 'ai_actions',
  ai_switch: 'ai_switch',
  avatar_icon_large: 'avatar_icon_large',
  layout_switch: 'layout_switch',
  layout_switch_button: 'layout_switch_button',
}));

describe('AIChatLogoAvatar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockGetLayoutMode.mockReturnValue('agentic');
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    layoutChangeListeners.length = 0;
    jest.clearAllMocks();
  });

  function renderAvatar(): void {
    act(() => {
      root.render(<AIChatLogoAvatar />);
    });
  }

  it('renders the layout switch button with the target agentic label', () => {
    mockGetLayoutMode.mockReturnValue('classic');
    renderAvatar();

    const button = container.querySelector<HTMLButtonElement>('[data-testid="layout-switch-button"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('ai.native.layout.openAgentic');
  });

  it('hides the AI icon while keeping the layout switch button in agentic layout', () => {
    renderAvatar();

    expect(container.querySelector('[data-testid="ai-logo-avatar"]')).toBeNull();

    const button = container.querySelector<HTMLButtonElement>('[data-testid="layout-switch-button"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('ai.native.layout.openClassic');
  });

  it('clicks the AI icon in classic layout without changing layout mode', () => {
    mockGetLayoutMode.mockReturnValue('classic');
    renderAvatar();

    const aiLogoAvatar = container.querySelector('[data-testid="ai-logo-avatar"]');
    expect(aiLogoAvatar).not.toBeNull();

    act(() => {
      Simulate.click(aiLogoAvatar!.parentElement as Element);
    });

    expect(mockToggleAIChatView).toHaveBeenCalledWith('classic');
    expect(mockSetLayoutMode).not.toHaveBeenCalled();
  });

  it('toggles the AI chat with the classic layout mode', () => {
    mockGetLayoutMode.mockReturnValue('classic');
    renderAvatar();

    const aiLogoAvatar = container.querySelector('[data-testid="ai-logo-avatar"]');
    expect(aiLogoAvatar).not.toBeNull();

    act(() => {
      Simulate.click(aiLogoAvatar!.parentElement as Element);
    });

    expect(mockToggleAIChatView).toHaveBeenCalledWith('classic');
  });

  it('switches to classic layout when the button is clicked from agentic layout', () => {
    renderAvatar();

    const button = container.querySelector<HTMLButtonElement>('[data-testid="layout-switch-button"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('ai.native.layout.openClassic');

    act(() => {
      Simulate.click(button!);
    });

    expect(mockSetLayoutMode).toHaveBeenCalledWith('classic');
    expect(mockToggleAIChatView).not.toHaveBeenCalled();
  });

  it('switches to agentic layout when the button is clicked from classic layout', () => {
    mockGetLayoutMode.mockReturnValue('classic');
    renderAvatar();

    const button = container.querySelector<HTMLButtonElement>('[data-testid="layout-switch-button"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('ai.native.layout.openAgentic');

    act(() => {
      Simulate.click(button!);
    });

    expect(mockSetLayoutMode).toHaveBeenCalledWith('agentic');
    expect(mockToggleAIChatView).not.toHaveBeenCalled();
  });

  it('reflects layout mode changes emitted by the service', () => {
    mockGetLayoutMode.mockReturnValueOnce('agentic');
    renderAvatar();

    act(() => {
      mockGetLayoutMode.mockReturnValue('classic');
      layoutChangeListeners.forEach((listener) => listener('classic'));
    });

    const button = container.querySelector<HTMLButtonElement>('[data-testid="layout-switch-button"]');
    expect(button!.textContent).toBe('ai.native.layout.openAgentic');
  });
});
