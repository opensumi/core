import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { AINativeSettingSectionsId, PreferenceScope } from '@opensumi/ide-core-common';

import {
  AIPanelLayoutService,
  AI_AGENTIC_CHAT_DEFAULT_SIZE,
  AI_AGENTIC_LAYOUT_STORAGE_KEY,
  AI_CLASSIC_CHAT_DEFAULT_SIZE,
  AI_PANEL_LAYOUT_CONTEXT,
  getPanelLayoutStorageKey,
  normalizePanelLayoutMode,
} from '../../src/browser/layout/panel-layout.service';
import { AI_CHAT_VIEW_ID } from '../../src/common';

describe('AIPanelLayoutService', () => {
  const createService = ({
    designLayout = 'classic',
    inspectValue: initialInspectValue = {},
    setError,
    aiChatPrevSize,
    aiChatVisible = false,
  }: {
    designLayout?: 'classic' | 'agentic';
    inspectValue?: { globalValue?: unknown; workspaceValue?: unknown; workspaceFolderValue?: unknown };
    setError?: Error;
    aiChatPrevSize?: number;
    aiChatVisible?: boolean;
  } = {}) => {
    let inspectValue = initialInspectValue;
    const contextKey = {
      set: jest.fn(),
    };
    let preferenceChangeCallback: (() => void) | undefined;
    const preferenceService = {
      ready: {
        then: jest.fn((callback: () => void) => {
          callback();
          return Promise.resolve();
        }),
      },
      inspect: jest.fn(() => inspectValue),
      set: jest.fn((_preferenceName, value) => {
        if (setError) {
          return Promise.reject(setError);
        }
        inspectValue = {
          ...inspectValue,
          globalValue: value,
        };
        return Promise.resolve();
      }),
      onSpecificPreferenceChange: jest.fn((_preferenceName, callback: () => void) => {
        preferenceChangeCallback = callback;
        return { dispose: jest.fn() };
      }),
    };
    const layoutService = {
      setLayoutStateKey: jest.fn(),
      toggleSlot: jest.fn(),
      isVisible: jest.fn(() => aiChatVisible),
      getTabbarService: jest.fn(() => ({
        prevSize: aiChatPrevSize,
      })),
    };
    const service = new AIPanelLayoutService();

    Object.defineProperty(service, 'preferenceService', {
      value: preferenceService,
    });
    Object.defineProperty(service, 'designLayoutConfig', {
      value: { panelLayout: designLayout },
    });
    Object.defineProperty(service, 'contextKeyService', {
      value: {
        createKey: jest.fn(() => contextKey),
      },
    });
    Object.defineProperty(service, 'layoutService', {
      value: layoutService,
    });

    return {
      contextKey,
      layoutService,
      preferenceService,
      service,
      triggerPreferenceChange: () => preferenceChangeCallback?.(),
    };
  };

  it('should preserve valid values and fall back to the default for unknown values', () => {
    expect(normalizePanelLayoutMode('agentic')).toBe('agentic');
    expect(normalizePanelLayoutMode('classic')).toBe('classic');
    expect(normalizePanelLayoutMode('unknown')).toBe('classic');
    expect(normalizePanelLayoutMode(undefined)).toBe('classic');
  });

  it('should map panel layout modes to isolated layout storage keys', () => {
    expect(getPanelLayoutStorageKey('classic')).toBe('layout');
    expect(getPanelLayoutStorageKey('agentic')).toBe(AI_AGENTIC_LAYOUT_STORAGE_KEY);
  });

  it('should default to classic without preference or app config', () => {
    const { service } = createService();

    expect(service.getLayoutMode()).toBe('classic');
  });

  it('should fall back to classic for an invalid user preference', () => {
    const { service } = createService({
      designLayout: 'agentic',
      inspectValue: { globalValue: 'unknown' },
    });

    expect(service.getLayoutMode()).toBe('classic');
  });

  it('should default design layout config to classic without an override', () => {
    const designLayoutConfig = new DesignLayoutConfig();

    expect(designLayoutConfig.panelLayout).toBe('classic');

    designLayoutConfig.setLayout({ panelLayout: 'agentic' });

    expect(designLayoutConfig.panelLayout).toBe('agentic');
  });

  it('should use app config when no user preference is set', () => {
    const { service } = createService({ designLayout: 'agentic' });

    expect(service.getLayoutMode()).toBe('agentic');
  });

  it('should let user preference override app config', () => {
    const { service } = createService({
      designLayout: 'classic',
      inspectValue: { globalValue: 'agentic' },
    });

    expect(service.getLayoutMode()).toBe('agentic');
  });

  it('should initialize layout state and context key from the current mode', () => {
    const { layoutService, service } = createService({ inspectValue: { globalValue: 'agentic' } });

    service.initialize();

    expect((service as any).contextKeyService.createKey).toHaveBeenCalledWith(AI_PANEL_LAYOUT_CONTEXT, 'agentic');
    expect(layoutService.setLayoutStateKey).toHaveBeenCalledWith(AI_AGENTIC_LAYOUT_STORAGE_KEY, {
      saveCurrent: false,
    });
  });

  it('should persist layout changes and reveal AI chat without reloading the shell', async () => {
    const { contextKey, layoutService, preferenceService, service } = createService({ designLayout: 'classic' });

    service.initialize();
    await service.setLayoutMode('agentic');

    expect((service as any).contextKeyService.createKey).toHaveBeenCalledWith(AI_PANEL_LAYOUT_CONTEXT, 'classic');
    expect(contextKey.set).toHaveBeenCalledWith('agentic');
    expect(layoutService.setLayoutStateKey).toHaveBeenCalledWith('layout', { saveCurrent: false });
    expect(layoutService.setLayoutStateKey).toHaveBeenCalledWith(AI_AGENTIC_LAYOUT_STORAGE_KEY, { saveCurrent: true });
    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_AGENTIC_CHAT_DEFAULT_SIZE);
    expect(preferenceService.set).toHaveBeenCalledWith(
      AINativeSettingSectionsId.PanelLayout,
      'agentic',
      PreferenceScope.User,
    );
  });

  it('should not update layout when persisting layout fails', async () => {
    const { contextKey, layoutService, service } = createService({ setError: new Error('write failed') });

    service.initialize();

    await expect(service.setLayoutMode('classic')).rejects.toThrow('write failed');
    expect(contextKey.set).not.toHaveBeenCalledWith('classic');
    expect(layoutService.toggleSlot).not.toHaveBeenCalled();
  });

  it('should open classic AI chat with the classic fallback size', () => {
    const { layoutService, service } = createService();

    service.showAIChatView('classic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_CLASSIC_CHAT_DEFAULT_SIZE);
  });

  it('should cap stale classic AI chat sizes when opening from the avatar', () => {
    const { layoutService, service } = createService({ aiChatPrevSize: 1794 });

    service.toggleAIChatView('classic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, undefined, 1080);
  });

  it('should not force a classic AI chat size when closing from the avatar', () => {
    const { layoutService, service } = createService({ aiChatVisible: true, aiChatPrevSize: 600 });

    service.toggleAIChatView('classic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, undefined, undefined);
  });

  it('should use the classic AI chat fallback size when opening from the avatar', () => {
    const { layoutService, service } = createService();

    service.toggleAIChatView('classic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, undefined, AI_CLASSIC_CHAT_DEFAULT_SIZE);
  });

  it('should use the agentic AI chat default size in agentic mode', () => {
    const { layoutService, service } = createService();

    service.showAIChatView('agentic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_AGENTIC_CHAT_DEFAULT_SIZE);
  });

  it('should close classic AI chat from the guarded hide path', () => {
    const { layoutService, service } = createService();

    service.hideAIChatView('classic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, false);
  });

  it('should keep agentic AI chat open from the guarded hide path', () => {
    const { layoutService, service } = createService();

    service.hideAIChatView('agentic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_AGENTIC_CHAT_DEFAULT_SIZE);
  });

  it('should keep visible agentic AI chat open when toggled from an AI-owned entry', () => {
    const { layoutService, service } = createService({ aiChatVisible: true });

    service.toggleAIChatView('agentic');

    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_AGENTIC_CHAT_DEFAULT_SIZE);
  });

  it('should default the agentic workbench to hidden in agentic mode', () => {
    const { service } = createService({ inspectValue: { globalValue: 'agentic' } });

    expect(service.isAgenticWorkbenchVisible()).toBe(false);
  });

  it('should not handle agentic workbench visibility outside agentic mode', () => {
    const { service } = createService({ inspectValue: { globalValue: 'classic' } });

    expect(service.isAgenticWorkbenchVisible()).toBeUndefined();
    expect(service.toggleAgenticWorkbenchVisibility()).toBeUndefined();
  });

  it('should toggle agentic workbench visibility and notify listeners', () => {
    const { service } = createService({ inspectValue: { globalValue: 'agentic' } });
    const listener = jest.fn();
    const disposable = service.onDidChangeAgenticWorkbenchVisibility(listener);

    expect(service.toggleAgenticWorkbenchVisibility()).toBe(true);
    expect(service.isAgenticWorkbenchVisible()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);

    expect(service.toggleAgenticWorkbenchVisibility(false)).toBe(false);
    expect(service.isAgenticWorkbenchVisible()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);

    disposable.dispose();
  });

  it('should reset agentic workbench visibility when layout mode changes', async () => {
    const { service } = createService({ inspectValue: { globalValue: 'agentic' } });

    expect(service.toggleAgenticWorkbenchVisibility(true)).toBe(true);

    await service.setLayoutMode('classic');
    expect(service.isAgenticWorkbenchVisible()).toBeUndefined();

    await service.setLayoutMode('agentic');
    expect(service.isAgenticWorkbenchVisible()).toBe(false);
  });

  it('should toggle both layout modes', async () => {
    const { layoutService, preferenceService, service } = createService({ inspectValue: { globalValue: 'agentic' } });

    await service.toggleLayoutMode();

    expect(preferenceService.set).toHaveBeenCalledWith(
      AINativeSettingSectionsId.PanelLayout,
      'classic',
      PreferenceScope.User,
    );
    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_CLASSIC_CHAT_DEFAULT_SIZE);
  });

  it('should apply external preference changes to the active layout shell', () => {
    const { contextKey, layoutService, service, triggerPreferenceChange } = createService({
      inspectValue: { globalValue: 'classic' },
    });

    service.initialize();
    triggerPreferenceChange();

    expect(contextKey.set).toHaveBeenCalledWith('classic');
    expect(layoutService.setLayoutStateKey).toHaveBeenCalledWith('layout', { saveCurrent: true });
    expect(layoutService.toggleSlot).toHaveBeenCalledWith(AI_CHAT_VIEW_ID, true, AI_CLASSIC_CHAT_DEFAULT_SIZE);
  });
});
