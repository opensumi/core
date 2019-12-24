import { Injectable, Injector, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadTheme } from '../../common/kaitian/theme';
import { IExtHostTheme } from '../../common/kaitian/theme';
import { ExtHostKaitianAPIIdentifier } from '../../common/kaitian';
import { IThemeService, getColorRegistry } from '@ali/ide-theme';
import { Disposable } from '@ali/ide-core-browser';

@Injectable({ multiple: true })
export class MainThreadTheme extends Disposable implements IMainThreadTheme {

  _proxy: IExtHostTheme;

  @Autowired(IThemeService)
  themeService: IThemeService;

  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostKaitianAPIIdentifier.ExtHostTheme);

    this.addDispose(this.themeService.onThemeChange(() => {
      this._proxy.$notifyThemeChanged();
    }));
  }

  async $getThemeColors(): Promise<{ [key: string]: string; }> {
    const currentTheme = this.themeService.getCurrentThemeSync();

    const exportedColors = getColorRegistry().getColors().reduce((colors, entry) => {
      const color = currentTheme.getColor(entry.id);
      if (color) {
        colors[entry.id.replace('.', '-')] = color.toString();
      }
      return colors;
    }, {} as { [key: string]: string });
    return exportedColors;
  }

}
