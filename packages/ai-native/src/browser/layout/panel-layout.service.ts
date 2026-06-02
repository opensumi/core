import { Autowired, Injectable } from '@opensumi/di';
import { IContextKeyService, PreferenceService } from '@opensumi/ide-core-browser';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { LAYOUT_STATE } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { AINativeSettingSectionsId, Emitter, PanelLayoutMode, PreferenceScope } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

export const AI_PANEL_LAYOUT_CONTEXT = 'aiNative.panelLayout';
export const AI_PANEL_LAYOUT_MENU = 'aiNative/panelLayout';
export const AI_AGENTIC_LAYOUT_STORAGE_KEY = 'layout.ai.agentic';
export const AI_AGENTIC_CHAT_DEFAULT_SIZE = 1080;
export const AI_CLASSIC_CHAT_DEFAULT_SIZE = 480;

export const DEFAULT_AI_PANEL_LAYOUT: PanelLayoutMode = 'agentic';

export function normalizePanelLayoutMode(value: unknown): PanelLayoutMode {
  return value === 'classic' || value === 'agentic' ? value : DEFAULT_AI_PANEL_LAYOUT;
}

export function getPanelLayoutStorageKey(mode: PanelLayoutMode): string {
  return normalizePanelLayoutMode(mode) === 'agentic' ? AI_AGENTIC_LAYOUT_STORAGE_KEY : LAYOUT_STATE.MAIN;
}

export function getAIChatDefaultSize(mode: PanelLayoutMode): number {
  return normalizePanelLayoutMode(mode) === 'agentic' ? AI_AGENTIC_CHAT_DEFAULT_SIZE : AI_CLASSIC_CHAT_DEFAULT_SIZE;
}

@Injectable()
export class AIPanelLayoutService {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(DesignLayoutConfig)
  private readonly designLayoutConfig: DesignLayoutConfig;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  private readonly onDidChangePanelLayoutEmitter = new Emitter<PanelLayoutMode>();
  readonly onDidChangePanelLayout = this.onDidChangePanelLayoutEmitter.event;

  private panelLayoutContextKey?: ReturnType<IContextKeyService['createKey']>;
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    const initialMode = this.getLayoutMode();
    this.applyLayoutMode(initialMode, false);
    this.updateContextKey(initialMode);
    this.preferenceService.onSpecificPreferenceChange(AINativeSettingSectionsId.PanelLayout, () => {
      const mode = this.getLayoutMode();
      this.applyLayoutMode(mode);
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
    this.applyLayoutMode(currentMode);
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

  private applyLayoutMode(mode: PanelLayoutMode, saveCurrent = true): void {
    this.layoutService.setLayoutStateKey(getPanelLayoutStorageKey(mode), { saveCurrent });
  }
}
