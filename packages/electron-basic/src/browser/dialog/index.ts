import { IElectronNativeDialogService, electronEnv } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';

@Injectable()
export class ElectronNativeDialogService implements IElectronNativeDialogService {

  @Autowired(IElectronMainUIService)
  electronMainUIService: IElectronMainUIService;

  async showOpenDialog(options: Electron.OpenDialogOptions): Promise<string[] | undefined> {
    return this.electronMainUIService.showOpenDialog(electronEnv.currentWindowId, options);
  }

  showSaveDialog(options: Electron.SaveDialogOptions): Promise<string | undefined> {
    return this.electronMainUIService.showSaveDialog(electronEnv.currentWindowId, options);
  }

}
