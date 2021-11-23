import { Injectable, Injector, Autowired } from '@ide-framework/common-di';
import { IRPCProtocol } from '@ide-framework/ide-connection';
import { IMainThreadTheme } from '../../common/sumi/theme';
import { IExtHostTheme } from '../../common/sumi/theme';
import { ExtHostSumiAPIIdentifier } from '../../common/sumi';
import { IThemeService, getColorRegistry } from '@ide-framework/ide-theme';
import { Disposable } from '@ide-framework/ide-core-browser';

@Injectable({ multiple: true })
export class MainThreadTheme extends Disposable implements IMainThreadTheme {

  _proxy: IExtHostTheme;

  @Autowired(IThemeService)
  themeService: IThemeService;

  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostSumiAPIIdentifier.ExtHostTheme);

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
