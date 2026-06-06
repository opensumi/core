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
    designLayout = 'agentic',
    inspectValue: initialInspectValue = {},
    setError,
  }: {
    designLayout?: 'classic' | 'agentic';
    inspectValue?: { globalValue?: 'classic' | 'agentic'; workspaceValue?: 'classic' | 'agentic' };
    setError?: Error;
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
    expect(normalizePanelLayoutMode('unknown')).toBe('agentic');
    expect(normalizePanelLayoutMode(undefined)).toBe('agentic');
  });

  it('should map panel layout modes to isolated layout storage keys', () => {
    expect(getPanelLayoutStorageKey('classic')).toBe('layout');
    expect(getPanelLayoutStorageKey('agentic')).toBe(AI_AGENTIC_LAYOUT_STORAGE_KEY);
  });

  it('should default to agentic without preference or app config', () => {
    const { service } = createService();

    expect(service.getLayoutMode()).toBe('agentic');
  });

  it('should use app config when no user preference is set', () => {
    const { service } = createService({ designLayout: 'classic' });

    expect(service.getLayoutMode()).toBe('classic');
  });

  it('should let user preference override app config', () => {
    const { service } = createService({
      designLayout: 'agentic',
      inspectValue: { globalValue: 'classic' },
    });

    expect(service.getLayoutMode()).toBe('classic');
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
