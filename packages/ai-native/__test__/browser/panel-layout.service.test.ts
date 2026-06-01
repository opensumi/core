import { AINativeSettingSectionsId, PreferenceScope } from '@opensumi/ide-core-common';

import {
  AIPanelLayoutService,
  AI_PANEL_LAYOUT_CONTEXT,
  normalizePanelLayoutMode,
} from '../../src/browser/layout/panel-layout.service';

describe('AIPanelLayoutService', () => {
  const createService = ({
    designLayout = 'classic',
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

    return { contextKey, preferenceService, service };
  };

  it('should normalize unknown values to classic', () => {
    expect(normalizePanelLayoutMode('agentic')).toBe('agentic');
    expect(normalizePanelLayoutMode('unknown')).toBe('classic');
  });

  it('should default to classic without preference or app config', () => {
    const { service } = createService();

    expect(service.getLayoutMode()).toBe('classic');
  });

  it('should use app config when no user preference is set', () => {
    const { service } = createService({ designLayout: 'agentic' });

    expect(service.getLayoutMode()).toBe('agentic');
  });

  it('should let user preference override app config', () => {
    const { service } = createService({
      designLayout: 'agentic',
      inspectValue: { globalValue: 'classic' },
    });

    expect(service.getLayoutMode()).toBe('classic');
  });

  it('should persist layout changes and update context key', async () => {
    const { contextKey, preferenceService, service } = createService();

    service.initialize();
    await service.setLayoutMode('agentic');

    expect((service as any).contextKeyService.createKey).toHaveBeenCalledWith(AI_PANEL_LAYOUT_CONTEXT, 'classic');
    expect(contextKey.set).toHaveBeenCalledWith('agentic');
    expect(preferenceService.set).toHaveBeenCalledWith(
      AINativeSettingSectionsId.PanelLayout,
      'agentic',
      PreferenceScope.User,
    );
  });

  it('should not update context key when persisting layout fails', async () => {
    const { contextKey, service } = createService({ setError: new Error('write failed') });

    service.initialize();

    await expect(service.setLayoutMode('agentic')).rejects.toThrow('write failed');
    expect(contextKey.set).not.toHaveBeenCalledWith('agentic');
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
