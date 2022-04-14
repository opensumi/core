import { Injectable, Autowired } from '@opensumi/di';
import { IQuickPickItemButtonEvent, QuickInputButton } from '@opensumi/ide-core-browser/lib/quick-open';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { IconType, IIconService, IThemeService } from '@opensumi/ide-theme';

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
      const iconUri = iconPath2URI(btn.iconPath, this.themeService.getCurrentThemeSync().type);
      const iconPath = iconUri && this.staticResourceService.resolveStaticResource(iconUri).toString();
      const iconClass = iconPath && this.iconService.fromIcon('', iconPath, IconType.Background);
      return {
        ...btn,
        iconClass,
        handle: i,
      };
    });
  }
}
