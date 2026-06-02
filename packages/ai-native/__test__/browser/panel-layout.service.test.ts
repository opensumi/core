import { AINativeSettingSectionsId, PreferenceScope } from '@opensumi/ide-core-common';

import {
  AIPanelLayoutService,
  AI_AGENTIC_LAYOUT_STORAGE_KEY,
  AI_PANEL_LAYOUT_CONTEXT,
  getPanelLayoutStorageKey,
  normalizePanelLayoutMode,
} from '../../src/browser/layout/panel-layout.service';

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
    const preferenceService = {
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
      onSpecificPreferenceChange: jest.fn(() => ({ dispose: jest.fn() })),
    };
    const layoutService = {
      setLayoutStateKey: jest.fn(),
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

    return { contextKey, layoutService, preferenceService, service };
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

  it('should persist layout changes and update context key', async () => {
    const { contextKey, layoutService, preferenceService, service } = createService({ designLayout: 'classic' });

    service.initialize();
    await service.setLayoutMode('agentic');

    expect((service as any).contextKeyService.createKey).toHaveBeenCalledWith(AI_PANEL_LAYOUT_CONTEXT, 'classic');
    expect(contextKey.set).toHaveBeenCalledWith('agentic');
    expect(layoutService.setLayoutStateKey).toHaveBeenCalledWith('layout', { saveCurrent: false });
    expect(layoutService.setLayoutStateKey).toHaveBeenCalledWith(AI_AGENTIC_LAYOUT_STORAGE_KEY, { saveCurrent: true });
    expect(preferenceService.set).toHaveBeenCalledWith(
      AINativeSettingSectionsId.PanelLayout,
      'agentic',
      PreferenceScope.User,
    );
  });

  it('should not update context key when persisting layout fails', async () => {
    const { contextKey, service } = createService({ setError: new Error('write failed') });

    service.initialize();

    await expect(service.setLayoutMode('classic')).rejects.toThrow('write failed');
    expect(contextKey.set).not.toHaveBeenCalledWith('classic');
  });

  it('should toggle both layout modes', async () => {
    const { preferenceService, service } = createService({ inspectValue: { globalValue: 'agentic' } });

    await service.toggleLayoutMode();

    expect(preferenceService.set).toHaveBeenCalledWith(
      AINativeSettingSectionsId.PanelLayout,
      'classic',
      PreferenceScope.User,
    );
  });
});
