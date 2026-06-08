import { Autowired, Injectable } from '@opensumi/di';
import { IContextKeyService, PreferenceService, fastdom } from '@opensumi/ide-core-browser';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { LAYOUT_STATE } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { AINativeSettingSectionsId, Emitter, PanelLayoutMode, PreferenceScope } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID } from '../../common';

export const AI_PANEL_LAYOUT_CONTEXT = 'aiNative.panelLayout';
export const AI_PANEL_LAYOUT_MENU = 'aiNative/panelLayout';
export const AI_AGENTIC_LAYOUT_STORAGE_KEY = 'layout.ai.agentic';
export const AI_AGENTIC_CHAT_DEFAULT_SIZE = 840;
export const AI_CLASSIC_CHAT_DEFAULT_SIZE = 360;
const AI_CLASSIC_CHAT_MAX_SIZE = 1080;

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
  private isSettingLayoutMode = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    void this.preferenceService.ready.then(() => {
      const initialMode = this.getLayoutMode();
      this.applyLayoutMode(initialMode, false);
      this.updateContextKey(initialMode);
      this.onDidChangePanelLayoutEmitter.fire(initialMode);
    });
    this.preferenceService.onSpecificPreferenceChange(AINativeSettingSectionsId.PanelLayout, () => {
      if (this.isSettingLayoutMode) {
        return;
      }
      const mode = this.getLayoutMode();
      this.activateLayoutMode(mode, true);
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
    this.isSettingLayoutMode = true;
    try {
      await this.preferenceService.set(AINativeSettingSectionsId.PanelLayout, normalizedMode, PreferenceScope.User);
    } finally {
      this.isSettingLayoutMode = false;
    }
    this.activateLayoutMode(this.getLayoutMode(), true);
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

  private getAIChatOpenSize(mode: PanelLayoutMode): number {
    const normalizedMode = normalizePanelLayoutMode(mode);
    if (normalizedMode === 'agentic') {
      return getAIChatDefaultSize(normalizedMode);
    }

    const prevSize = this.layoutService.getTabbarService(AI_CHAT_VIEW_ID).prevSize;
    if (typeof prevSize === 'number' && Number.isFinite(prevSize) && prevSize > 0) {
      return Math.min(prevSize, AI_CLASSIC_CHAT_MAX_SIZE);
    }

    return getAIChatDefaultSize(normalizedMode);
  }

  showAIChatView(mode: PanelLayoutMode = this.getLayoutMode()): void {
    const normalizedMode = normalizePanelLayoutMode(mode);
    this.layoutService.toggleSlot(AI_CHAT_VIEW_ID, true, this.getAIChatOpenSize(normalizedMode));
  }

  toggleAIChatView(mode: PanelLayoutMode = this.getLayoutMode()): void {
    const normalizedMode = normalizePanelLayoutMode(mode);
    const isVisible = this.layoutService.isVisible(AI_CHAT_VIEW_ID);
    this.layoutService.toggleSlot(
      AI_CHAT_VIEW_ID,
      undefined,
      isVisible ? undefined : this.getAIChatOpenSize(normalizedMode),
    );
  }

  private activateLayoutMode(mode: PanelLayoutMode, restoreAIChat = false): void {
    this.applyLayoutMode(mode);
    if (restoreAIChat) {
      this.showAIChatView(mode);
      this.restoreLayoutAfterModeChange(mode);
    }
    this.updateContextKey(mode);
    this.onDidChangePanelLayoutEmitter.fire(mode);
  }

  private restoreLayoutAfterModeChange(mode: PanelLayoutMode): void {
    const layoutStateKey = getPanelLayoutStorageKey(mode);

    fastdom.measureAtNextFrame(() => {
      this.showAIChatView(mode);
      fastdom.measureAtNextFrame(() => {
        this.layoutService.setLayoutStateKey(layoutStateKey, { saveCurrent: false, forceRestore: true });
        this.showAIChatView(mode);
      });
    });
  }
}
