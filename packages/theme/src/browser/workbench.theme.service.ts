import { IThemeService } from '../common/theme.service';
import { Event } from '@ali/ide-core-common';

export class WorkbenchThemeService implements IThemeService {
  onCurrentThemeChange: Event<any>;

  getTheme() {

  }
}
