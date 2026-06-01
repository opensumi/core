import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { Simulate, act } from 'react-dom/test-utils';

import { AIChatLogoAvatar } from '../../src/browser/layout/view/avatar/avatar.view';
import { AI_CHAT_VIEW_ID } from '../../src/common';

const mockToggleSlot = jest.fn();
const mockToggleLayoutMode = jest.fn();

jest.mock('@opensumi/ide-main-layout', () => ({
  IMainLayoutService: 'IMainLayoutService',
}));

jest.mock('@opensumi/ide-core-browser', () => ({
  useInjectable: (token: any) => {
    if (token === 'IMainLayoutService') {
      return {
        toggleSlot: mockToggleSlot,
      };
    }
    if (token?.name === 'AIPanelLayoutService') {
      return {
        toggleLayoutMode: mockToggleLayoutMode,
      };
    }
    return {};
  },
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => {
  const React = require('react');
  return {
    Icon: ({ icon, className }: any) =>
      React.createElement('span', {
        'data-testid': `icon-${icon}`,
        className: `kticon-${icon} ${className || ''}`,
      }),
  };
});

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
}));

jest.mock('../../src/browser/layout/view/avatar/avatar.module.less', () => ({
  ai_actions: 'ai_actions',
  ai_switch: 'ai_switch',
  avatar_icon_large: 'avatar_icon_large',
  layout_switch: 'layout_switch',
  layout_icon: 'layout_icon',
}));

describe('AIChatLogoAvatar', () => {
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

  function renderAvatar(): void {
    act(() => {
      root.render(<AIChatLogoAvatar />);
    });
  }

  it('clicks the AI icon without toggling panel layout', () => {
    renderAvatar();

    const aiLogoAvatar = container.querySelector('[data-testid="ai-logo-avatar"]');
    expect(aiLogoAvatar).not.toBeNull();

    act(() => {
      Simulate.click(aiLogoAvatar!.parentElement as Element);
    });

    expect(mockToggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID);
    expect(mockToggleLayoutMode).not.toHaveBeenCalled();
  });

  it('clicks the layout icon without toggling chat visibility', () => {
    renderAvatar();

    const layoutIcon = container.querySelector('[data-testid="icon-layout"]');
    expect(layoutIcon).not.toBeNull();

    act(() => {
      Simulate.click(layoutIcon!.parentElement as Element);
    });

    expect(mockToggleLayoutMode).toHaveBeenCalledTimes(1);
    expect(mockToggleSlot).not.toHaveBeenCalled();
  });

  it('renders the layout icon', () => {
    renderAvatar();

    const layoutIcon = container.querySelector('[data-testid="icon-layout"]');

    expect(layoutIcon).not.toBeNull();
    expect(layoutIcon!.className).toContain('kticon-layout');
    expect(layoutIcon!.className).toContain('avatar_icon_large');
  });
});
