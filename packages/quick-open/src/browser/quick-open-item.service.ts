import { Autowired, Injectable } from '@opensumi/di';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { IQuickPickItemButtonEvent, QuickInputButton } from '@opensumi/ide-core-browser/lib/quick-open';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { Emitter, Event, ThemeIcon, URI } from '@opensumi/ide-core-common';
import { IIconService, IThemeService, IconType } from '@opensumi/ide-theme';

import { iconPath2URI } from '../common/icon';

@Injectable()
export class QuickOpenItemService {
  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  private readonly onDidTriggerItemButtonEmitter: Emitter<IQuickPickItemButtonEvent> = new Emitter();

  get onDidTriggerItemButton(): Event<IQuickPickItemButtonEvent> {
    return this.onDidTriggerItemButtonEmitter.event;
  }

  fireDidTriggerItemButton(itemHandle: number, button: QuickInputButton): void {
    this.onDidTriggerItemButtonEmitter.fire({
      button,
      item: { handle: itemHandle },
    });
  }

  getButtons(buttons: QuickInputButton[]): QuickInputButton[] {
    if (buttons.length === 0) {
      return [];
    }
    return buttons.map((btn, i) => {
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
        handle: i,
      };
    });
  }

  getIconClass(data: { iconPath?: URI | { light: URI; dark: URI } | ThemeIcon; iconClass?: string }) {
    const { iconClass, iconPath } = data;

    if (iconClass) {
      return iconClass;
    }

    if (!iconPath) {
      return undefined;
    }

    if (ThemeIcon.isThemeIcon(iconPath)) {
      return getExternalIcon(iconPath.id);
    }

    const iconUri = iconPath2URI(iconPath, this.themeService.getCurrentThemeSync().type);
    const iconPathString = iconUri && this.staticResourceService.resolveStaticResource(iconUri).toString();
    const iconCls = iconPath && this.iconService.fromIcon('', iconPathString, IconType.Background);

    return iconCls;
  }
}
