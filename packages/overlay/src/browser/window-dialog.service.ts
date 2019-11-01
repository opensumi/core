import { IWindowDialogService, IOpenDialogOptions } from '../common';
import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronRenderer, electronEnv, URI } from '@ali/ide-core-browser';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';

@Injectable()
export class WindowDialogServiceImpl implements IWindowDialogService {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async showOpenDialog(options: IOpenDialogOptions | undefined = {}): Promise<URI[] | undefined> {
    if (isElectronRenderer()) {
      const electronUi = this.injector.get(IElectronMainUIService) as IElectronMainUIService;
      const properties: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory'> = [];
      if (options.canSelectFiles) {
        properties.push('openFile');
      }
      if (options.canSelectFolders) {
        properties.push('openDirectory');
      }
      if (options.canSelectMany) {
        properties.push('multiSelections');
      }
      const res = await electronUi.showOpenDialog(electronEnv.currentWindowId, {
        defaultPath: options.defaultUri ? options.defaultUri.codeUri.fsPath : undefined,
        title: options.openLabel,
        properties,
      });
      if (res && res.length > 0) {
        return res.map((r) => URI.file(r));
      } else {
        return undefined;
      }
    } else {
      throw new Error('not implemented');
    }
  }

}
