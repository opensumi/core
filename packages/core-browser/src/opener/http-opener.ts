import { Injectable, Autowired } from '@opensumi/di';
import { URI, Schemas } from '@opensumi/ide-core-common';

import { IWindowService } from '../window';

import { IOpener } from '.';

@Injectable()
export class HttpOpener implements IOpener {
  static standardSupportedLinkSchemes = new Set([Schemas.http, Schemas.https, Schemas.mailto]);

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
