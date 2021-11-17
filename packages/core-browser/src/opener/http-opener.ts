import { Injectable, Autowired } from '@ide-framework/common-di';
import { URI, Schemas } from '@ide-framework/ide-core-common';
import { IOpener } from '.';
import { IWindowService } from '../window';

@Injectable()
export class HttpOpener implements IOpener {

  static standardSupportedLinkSchemes = new Set([
    Schemas.http,
    Schemas.https,
    Schemas.mailto,
  ]);

  @Autowired(IWindowService)
  private readonly windowService: IWindowService;

  handleScheme(scheme: string) {
    return HttpOpener.standardSupportedLinkSchemes.has(scheme);
  }

  async open(uri: URI) {
    this.windowService.openNewWindow(uri.toString(true), {
      external: true,
    });
    return true;
  }
}
