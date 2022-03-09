import { observable, computed, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { QuickTitleButton, QuickTitleButtonSide } from '@opensumi/ide-core-browser/lib/quick-open';
import { Emitter, Event, isUndefined, URI } from '@opensumi/ide-core-common';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import './quick-title-bar.less';
import { IconType, IIconService, IThemeService } from '@opensumi/ide-theme';

@Injectable()
export class QuickTitleBar {
  @Autowired(IThemeService)
  public themeService: IThemeService;

  @Autowired()
  protected staticResourceService: StaticResourceService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  public readonly onDidTriggerButtonEmitter: Emitter<QuickTitleButton> = new Emitter();

  @observable
  private _isAttached: boolean;

  @observable
  private _title: string | undefined;

  @computed
  public get title() {
    return this._title;
  }

  @observable
  private _step: number | undefined;

  @observable
  private _totalSteps: number | undefined;

  @observable.shallow
  private _buttons: QuickTitleButton[] = [];

  get onDidTriggerButton(): Event<QuickTitleButton> {
    return this.onDidTriggerButtonEmitter.event;
  }

  @computed
  get isAttached(): boolean {
    return this._isAttached;
  }

  @computed
  get step(): number | undefined {
    return this._step;
  }

  @computed
  get totalSteps(): number | undefined {
    return this._totalSteps;
  }

  @computed
  get buttons(): QuickTitleButton[] {
    if (this._buttons === undefined || this._buttons.length === 0) {
      return [];
    }
    return this._buttons.map((btn, i) => {
      const iconUri = this.iconPath2URI(btn.iconPath);
      const iconPath = iconUri && this.staticResourceService.resolveStaticResource(iconUri).toString();
      const iconClass = iconPath && this.iconService.fromIcon('', iconPath, IconType.Background);
      return {
        ...btn,
        iconClass,
        handler: i,
      };
    });
  }

  @computed
  get leftButtons(): ReadonlyArray<QuickTitleButton> {
    return this.buttons.filter((btn) => btn.side === QuickTitleButtonSide.LEFT);
  }

  @computed
  get rightButtons(): ReadonlyArray<QuickTitleButton> {
    return this.buttons.filter((btn) => btn.side === QuickTitleButtonSide.RIGHT || typeof btn.side === 'undefined');
  }

  private iconPath2URI(iconPath): URI | undefined {
    if (URI.isUri(iconPath)) {
      return iconPath;
    }

    if (iconPath.dark || iconPath.light) {
      return this.themeService.currentThemeId === 'ide-dark'
        ? new URI(iconPath.dark.toString())
        : new URI(iconPath.light.toString());
    }
  }

  @action
  public attachTitleBar(
    title: string | undefined,
    step: number | undefined,
    totalSteps: number | undefined,
    buttons: QuickTitleButton[] | undefined,
  ): void {
    this._title = title;
    this._step = step;
    this._totalSteps = totalSteps;

    if (buttons) {
      this._buttons = buttons;
    }
    this._isAttached = true;
  }

  @action
  hide(): void {
    this._title = undefined;
    this._buttons = [];
    this._step = undefined;
    this._totalSteps = undefined;
    this._isAttached = false;
  }

  shouldShowTitleBar(
    title: string | undefined,
    step: number | undefined,
    buttons: QuickTitleButton[] | undefined,
  ): boolean {
    return !isUndefined(title) || !isUndefined(step) || (!isUndefined(buttons) && !!buttons.length);
  }
}
