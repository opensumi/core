import { Autowired, Injectable } from '@opensumi/di';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { QuickTitleButton, QuickTitleButtonSide } from '@opensumi/ide-core-browser/lib/quick-open';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { Emitter, Event, ThemeIcon, URI, isUndefined } from '@opensumi/ide-core-common';
import { derived, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';
import { IIconService, IThemeService, IconType } from '@opensumi/ide-theme';
import './quick-title-bar.less';

import { iconPath2URI } from '../common/icon';

@Injectable()
export class QuickTitleBar {
  @Autowired(IThemeService)
  public themeService: IThemeService;

  @Autowired()
  protected staticResourceService: StaticResourceService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  private readonly onDidTriggerButtonEmitter: Emitter<QuickTitleButton> = new Emitter();

  readonly isAttached = observableValue(this, false);
  readonly title = observableValue<string | undefined>(this, undefined);
  readonly step = observableValue<number | undefined>(this, undefined);
  readonly totalSteps = observableValue<number | undefined>(this, undefined);
  readonly buttons = observableValue<QuickTitleButton[]>(this, []);
  readonly leftButtons = derived<ReadonlyArray<QuickTitleButton>>(this, (reader) =>
    this.buttons.read(reader).filter((btn) => btn.side === QuickTitleButtonSide.LEFT),
  );

  readonly rightButtons = derived<ReadonlyArray<QuickTitleButton>>(this, (reader) =>
    this.buttons
      .read(reader)
      .filter((btn) => btn.side === QuickTitleButtonSide.RIGHT || typeof btn.side === 'undefined'),
  );

  get onDidTriggerButton(): Event<QuickTitleButton> {
    return this.onDidTriggerButtonEmitter.event;
  }

  fireDidTriggerButton(button: QuickTitleButton): void {
    this.onDidTriggerButtonEmitter.fire(button);
  }

  public attachTitleBar(
    title: string | undefined,
    step: number | undefined,
    totalSteps: number | undefined,
    buttons: QuickTitleButton[] | undefined,
  ): void {
    transaction((tx) => {
      this.title.set(title, tx);
      this.step.set(step, tx);
      this.totalSteps.set(totalSteps, tx);

      if (buttons) {
        this.buttons.set(
          buttons.map((btn, i) => {
            if (ThemeIcon.isThemeIcon(btn.iconPath)) {
              return {
                ...btn,
                iconClass: getExternalIcon(btn.iconPath.id),
                handle: i,
              };
            }
            const iconUri = iconPath2URI(
              btn.iconPath as URI | { light: URI; dark: URI },
              this.themeService.getCurrentThemeSync().type,
            );
            const iconPath = iconUri && this.staticResourceService.resolveStaticResource(iconUri).toString();
            const iconClass = iconPath && this.iconService.fromIcon('', iconPath, IconType.Background);
            return {
              ...btn,
              iconClass,
              handler: i,
            };
          }),
          tx,
        );
      }
      this.isAttached.set(true, tx);
    });
  }

  hide(): void {
    transaction((tx) => {
      this.title.set(undefined, tx);
      this.buttons.set([], tx);
      this.step.set(undefined, tx);
      this.totalSteps.set(undefined, tx);
      this.isAttached.set(false, tx);
    });
  }

  shouldShowTitleBar(
    title: string | undefined,
    step: number | undefined,
    buttons: QuickTitleButton[] | undefined,
  ): boolean {
    return !isUndefined(title) || !isUndefined(step) || (!isUndefined(buttons) && !!buttons.length);
  }
}
