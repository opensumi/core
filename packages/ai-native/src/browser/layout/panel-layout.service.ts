import { Autowired, Injectable } from '@opensumi/di';
import { IContextKeyService, PreferenceService } from '@opensumi/ide-core-browser';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { AINativeSettingSectionsId, Emitter, PanelLayoutMode, PreferenceScope } from '@opensumi/ide-core-common';

export const AI_PANEL_LAYOUT_CONTEXT = 'aiNative.panelLayout';
export const AI_PANEL_LAYOUT_MENU = 'aiNative/panelLayout';

export const DEFAULT_AI_PANEL_LAYOUT: PanelLayoutMode = 'classic';

export function normalizePanelLayoutMode(value: unknown): PanelLayoutMode {
  return value === 'agentic' ? 'agentic' : DEFAULT_AI_PANEL_LAYOUT;
}

@Injectable()
export class AIPanelLayoutService {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(DesignLayoutConfig)
  private readonly designLayoutConfig: DesignLayoutConfig;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  private readonly onDidChangePanelLayoutEmitter = new Emitter<PanelLayoutMode>();
  readonly onDidChangePanelLayout = this.onDidChangePanelLayoutEmitter.event;

  private panelLayoutContextKey?: ReturnType<IContextKeyService['createKey']>;
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.updateContextKey(this.getLayoutMode());
    this.preferenceService.onSpecificPreferenceChange(AINativeSettingSectionsId.PanelLayout, () => {
      const mode = this.getLayoutMode();
      this.updateContextKey(mode);
      this.onDidChangePanelLayoutEmitter.fire(mode);
    });
  }

  getLayoutMode(): PanelLayoutMode {
    const inspected = this.preferenceService.inspect<PanelLayoutMode>(AINativeSettingSectionsId.PanelLayout);
    const configuredValue =
      inspected?.workspaceFolderValue ??
      inspected?.workspaceValue ??
      inspected?.globalValue ??
      this.designLayoutConfig.panelLayout;

    return normalizePanelLayoutMode(configuredValue);
  }

  async setLayoutMode(mode: PanelLayoutMode): Promise<void> {
    const normalizedMode = normalizePanelLayoutMode(mode);
    await this.preferenceService.set(AINativeSettingSectionsId.PanelLayout, normalizedMode, PreferenceScope.User);
    const currentMode = this.getLayoutMode();
    this.updateContextKey(currentMode);
    this.onDidChangePanelLayoutEmitter.fire(currentMode);
  }

  async toggleLayoutMode(): Promise<void> {
    await this.setLayoutMode(this.getLayoutMode() === 'agentic' ? 'classic' : 'agentic');
  }

  private updateContextKey(mode: PanelLayoutMode): void {
    if (!this.panelLayoutContextKey) {
      this.panelLayoutContextKey = this.contextKeyService.createKey(AI_PANEL_LAYOUT_CONTEXT, mode);
      return;
    }
    this.panelLayoutContextKey.set(mode);
  }
}
