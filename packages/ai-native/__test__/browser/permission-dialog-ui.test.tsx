/**
 * Tests for PermissionDialogWidget rendering and keyboard accessibility.
 *
 * Uses raw React + DOM APIs since @testing-library/react is not installed.
 *
 * Verifies:
 * - data-testid attributes are present for ui_assert
 * - Options render correctly
 * - Keyboard navigation (ArrowUp/ArrowDown/Enter/Escape) works
 * - Dialog closes on decision or close button click
 */
import * as React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';

import { PermissionDialogWidget } from '../../src/browser/components/permission-dialog-widget';

// Mock the services that PermissionDialogWidget depends on
// These must be mocked before the component is imported to avoid DI decorator issues
jest.mock('../../src/browser/acp/permission-bridge.service', () => ({
  AcpPermissionBridgeService: jest.fn(),
}));

jest.mock('../../src/browser/acp/permission-dialog-container', () => ({
  PermissionDialogManager: jest.fn(),
}));

// Mock the Less module
jest.mock('../../src/browser/components/permission-dialog-widget.module.less', () => ({
  permission_dialog_container: 'permission_dialog_container',
  permission_dialog: 'permission_dialog',
  header: 'header',
  has_content: 'has_content',
  title: 'title',
  warning_icon: 'warning_icon',
  close_button: 'close_button',
  content: 'content',
  options: 'options',
  option_button: 'option_button',
  option_key: 'option_key',
  option_text: 'option_text',
}));

// Mock core-browser injectable
jest.mock('@opensumi/ide-core-browser', () => ({
  useInjectable: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  getIcon: (name: string) => `icon-${name}`,
}));

function createMockDialogManager(initialDialogs: any[] = []) {
  const listeners: Array<(dialogs: any[]) => void> = [];
  let dialogs = [...initialDialogs];

  return {
    subscribe: jest.fn((fn: (d: any[]) => void) => {
      listeners.push(fn);
      return () => {};
    }),
    getDialogs: jest.fn(() => [...dialogs]),
    addDialog: jest.fn((d: any) => {
      dialogs.push(d);
      listeners.forEach((fn) => fn([...dialogs]));
    }),
    removeDialog: jest.fn((requestId: string) => {
      dialogs = dialogs.filter((d) => d.requestId !== requestId);
      listeners.forEach((fn) => fn([...dialogs]));
    }),
    clearAll: jest.fn(() => {
      dialogs = [];
      listeners.forEach((fn) => fn([]));
    }),
    getDialogsForSession: jest.fn((sessionId: string | undefined) => {
      if (!sessionId) return [];
      return dialogs.filter((d) => d.params.sessionId === sessionId);
    }),
    clearDialogsForSession: jest.fn(),
  };
}

function createMockPermissionBridgeService() {
  const listeners: Array<(sessionId: string | undefined) => void> = [];
  let activeSessionId: string | undefined = 'test-session';

  return {
    onActiveSessionChange: jest.fn((fn: (id: string | undefined) => void) => {
      listeners.push(fn);
      return { dispose: jest.fn() };
    }),
    getActiveSession: jest.fn(() => activeSessionId),
    setActiveSession: jest.fn((id: string | undefined) => {
      activeSessionId = id;
      listeners.forEach((fn) => fn(id));
    }),
    handleUserDecision: jest.fn(),
    handleDialogClose: jest.fn(),
    onDidRequestPermission: { event: jest.fn() },
    onDidReceivePermissionResult: { event: jest.fn() },
  };
}

const mockPermissionBridge = createMockPermissionBridgeService();

const editDialogParams = {
  requestId: 'req-edit-1',
  sessionId: 'test-session',
  title: 'Edit Permission',
  kind: 'edit',
  content: 'Write to file: src/index.ts',
  locations: [{ path: 'src/index.ts', line: 10 }],
  options: [
    { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
    { optionId: 'allow_always', name: 'Always Allow', kind: 'allow_always' },
    { optionId: 'reject', name: 'Reject', kind: 'reject' },
  ],
  timeout: 60000,
};

const executeDialogParams = {
  requestId: 'req-exec-1',
  sessionId: 'test-session',
  title: 'Execute Permission',
  kind: 'execute',
  command: 'rm -rf /tmp/test',
  options: [
    { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
    { optionId: 'reject', name: 'Reject', kind: 'reject' },
  ],
  timeout: 60000,
};

describe('PermissionDialogWidget - Rendering', () => {
  let container: HTMLDivElement;
  let dialogManager: ReturnType<typeof createMockDialogManager>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.clearAllMocks();
    (mockPermissionBridge as any).getActiveSession.mockReturnValue('test-session');
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(mockPermissionBridge);
  });

  afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
  });

  it('renders null when no dialogs exist', () => {
    dialogManager = createMockDialogManager([]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with all data-testid attributes', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    expect(container.querySelector('[data-testid="acp-permission-dialog"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-permission-dialog-title"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-permission-dialog-content"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-permission-dialog-options"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-permission-dialog-close"]')).not.toBeNull();
  });

  it('renders option buttons with indexed data-testid', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    expect(container.querySelector('[data-testid="acp-permission-dialog-option-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-permission-dialog-option-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-permission-dialog-option-2"]')).not.toBeNull();
  });

  it('renders correct title for edit kind', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    const titleEl = container.querySelector('[data-testid="acp-permission-dialog-title"]');
    expect(titleEl?.textContent).toContain('Make this edit to');
    expect(titleEl?.textContent).toContain('index.ts');
  });

  it('renders correct title for execute kind', () => {
    dialogManager = createMockDialogManager([
      { requestId: executeDialogParams.requestId, params: executeDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    const titleEl = container.querySelector('[data-testid="acp-permission-dialog-title"]');
    expect(titleEl?.textContent).toContain('Allow this bash command?');
  });

  it('shows option names from params', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    expect(container.textContent).toContain('Allow Once');
    expect(container.textContent).toContain('Always Allow');
    expect(container.textContent).toContain('Reject');
  });

  it('uses optionId as fallback when name is missing', () => {
    const dialogWithoutNames = {
      requestId: 'req-no-name',
      params: {
        ...editDialogParams,
        options: [
          { optionId: 'allow_once', kind: 'allow_once' },
          { optionId: 'reject', kind: 'reject' },
        ],
      },
    };
    dialogManager = createMockDialogManager([dialogWithoutNames]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    expect(container.textContent).toContain('allow_once');
    expect(container.textContent).toContain('reject');
  });
});

describe('PermissionDialogWidget - Keyboard Navigation', () => {
  let container: HTMLDivElement;
  let dialogManager: ReturnType<typeof createMockDialogManager>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.clearAllMocks();
    (mockPermissionBridge as any).getActiveSession.mockReturnValue('test-session');
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(mockPermissionBridge);
  });

  afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
  });

  function fireEventKeyDown(key: string) {
    const event = new KeyboardEvent('keydown', { key });
    window.dispatchEvent(event);
  }

  it('ArrowDown moves focus to next option', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    const firstOption = container.querySelector('[data-testid="acp-permission-dialog-option-0"]');
    expect(firstOption?.className).toContain('focused');

    act(() => {
      fireEventKeyDown('ArrowDown');
    });

    const secondOption = container.querySelector('[data-testid="acp-permission-dialog-option-1"]');
    expect(secondOption?.className).toContain('focused');
  });

  it('ArrowUp at first option stays at first', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    act(() => {
      fireEventKeyDown('ArrowUp');
    });

    const firstOption = container.querySelector('[data-testid="acp-permission-dialog-option-0"]');
    expect(firstOption?.className).toContain('focused');
  });

  it('ArrowDown at last option stays at last', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    // Move to last option
    act(() => {
      fireEventKeyDown('ArrowDown');
      fireEventKeyDown('ArrowDown');
    });

    const lastOption = container.querySelector('[data-testid="acp-permission-dialog-option-2"]');
    expect(lastOption?.className).toContain('focused');

    // Stay at last
    act(() => {
      fireEventKeyDown('ArrowDown');
    });
    expect(lastOption?.className).toContain('focused');
  });

  it('Enter triggers user decision on focused option', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    // Move to second option
    act(() => {
      fireEventKeyDown('ArrowDown');
    });

    act(() => {
      fireEventKeyDown('Enter');
    });

    expect(mockPermissionBridge.handleUserDecision).toHaveBeenCalledWith(
      'req-edit-1',
      'allow_always',
      'allow_always',
    );
    expect(dialogManager.removeDialog).toHaveBeenCalledWith('req-edit-1');
  });

  it('Escape triggers dialog close', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    act(() => {
      fireEventKeyDown('Escape');
    });

    expect(mockPermissionBridge.handleDialogClose).toHaveBeenCalledWith('req-edit-1');
    expect(dialogManager.removeDialog).toHaveBeenCalledWith('req-edit-1');
  });

  it('close button click triggers dialog close', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    const closeBtn = container.querySelector('[data-testid="acp-permission-dialog-close"]');
    act(() => {
      (closeBtn as HTMLElement)?.click();
    });

    expect(mockPermissionBridge.handleDialogClose).toHaveBeenCalledWith('req-edit-1');
    expect(dialogManager.removeDialog).toHaveBeenCalledWith('req-edit-1');
  });

  it('mouse enter changes focused option', () => {
    dialogManager = createMockDialogManager([
      { requestId: editDialogParams.requestId, params: editDialogParams },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });

    const thirdOption = container.querySelector('[data-testid="acp-permission-dialog-option-2"]');
    // React's onMouseEnter uses mouseover/mouseout, not mouseenter/mouseleave
    act(() => {
      thirdOption?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    // Re-query after state update
    const thirdOptionAfter = container.querySelector('[data-testid="acp-permission-dialog-option-2"]');
    expect(thirdOptionAfter?.className).toContain('focused');
  });
});

describe('PermissionDialogWidget - Session Isolation', () => {
  let container: HTMLDivElement;
  let dialogManager: ReturnType<typeof createMockDialogManager>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.clearAllMocks();
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(mockPermissionBridge);
  });

  afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
  });

  it('does not render dialogs from non-active session', () => {
    (mockPermissionBridge as any).getActiveSession.mockReturnValue('active-session');

    dialogManager = createMockDialogManager([
      {
        requestId: 'req-other',
        params: { ...editDialogParams, requestId: 'req-other', sessionId: 'other-session' },
      },
    ]);
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager, bottom: 40 }), container);
    });
    expect(container.innerHTML).toBe('');
  });

  it('shows dialogs when session becomes active', () => {
    const dialogManager2 = createMockDialogManager([
      {
        requestId: 'req-target',
        params: { ...editDialogParams, requestId: 'req-target', sessionId: 'target-session' },
      },
    ]);

    (mockPermissionBridge as any).getActiveSession.mockReturnValue('other-session');
    act(() => {
      render(React.createElement(PermissionDialogWidget, { dialogManager: dialogManager2, bottom: 40 }), container);
    });
    expect(container.innerHTML).toBe('');

    // Simulate session change to target-session
    (mockPermissionBridge as any).getActiveSession.mockReturnValue('target-session');
    const sessionChangeListeners = (mockPermissionBridge.onActiveSessionChange as jest.Mock).mock.calls[0];
    const sessionChangeListener = sessionChangeListeners[0];
    act(() => {
      sessionChangeListener('target-session');
    });

    expect(container.querySelector('[data-testid="acp-permission-dialog"]')).not.toBeNull();
  });
});
