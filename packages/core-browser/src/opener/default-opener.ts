import { Injectable, Autowired } from '@opensumi/common-di';
import { URI, Schemas, isElectronRenderer } from '@opensumi/ide-core-common';
import { IOpener } from '.';
import { IWindowService } from '../window';

@Injectable()
export class DefaultOpener implements IOpener {

  @Autowired(IWindowService)
  private readonly windowService: IWindowService;

  handleScheme(scheme: string) {
    return true;
  }

  async open(uri: URI) {
    if (isElectronRenderer() || [Schemas.http, Schemas.https].includes(uri.scheme)) {
      this.windowService.openNewWindow(uri.toString(true), {
        external: true,
      });
    } else {
      window.location.href = uri.toString(true);
    }
    return true;
  }
}
