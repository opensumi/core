import { Injectable, Injector, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Disposable } from '@opensumi/ide-core-browser';
import { IThemeService, getColorRegistry } from '@opensumi/ide-theme';

import { ExtHostSumiAPIIdentifier } from '../../common/sumi';
import { IMainThreadTheme } from '../../common/sumi/theme';
import { IExtHostTheme } from '../../common/sumi/theme';


@Injectable({ multiple: true })
export class MainThreadTheme extends Disposable implements IMainThreadTheme {
  _proxy: IExtHostTheme;

  @Autowired(IThemeService)
  themeService: IThemeService;

  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostSumiAPIIdentifier.ExtHostTheme);

    this.addDispose(
      this.themeService.onThemeChange(() => {
        this._proxy.$notifyThemeChanged();
      }),
    );
  }

  async $getThemeColors(): Promise<{ [key: string]: string }> {
    const currentTheme = this.themeService.getCurrentThemeSync();

    const exportedColors = getColorRegistry()
      .getColors()
      .reduce((colors, entry) => {
        const color = currentTheme.getColor(entry.id);
        if (color) {
          colors[entry.id.replace('.', '-')] = color.toString();
        }
        return colors;
      }, {} as { [key: string]: string });
    return exportedColors;
  }
}
