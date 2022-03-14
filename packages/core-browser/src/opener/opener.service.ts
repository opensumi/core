import { Injectable, Autowired } from '@opensumi/di';
import { URI, ILogger } from '@opensumi/ide-core-common';

import { DefaultOpener } from './default-opener';

import { IOpenerService, IOpener } from '.';

@Injectable()
export class OpenerService implements IOpenerService {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(DefaultOpener)
  private defaultOpener: IOpener;

  private openers: IOpener[] = [];

  private async getOpeners(uri: URI) {
    const filterResults = await Promise.all(
      this.openers.map(async (opener) => {
        try {
          if (opener.handleURI) {
            return await opener.handleURI(uri);
          }
          return await opener.handleScheme(uri.scheme);
        } catch (e) {
          this.logger.error(e);
          return false;
        }
      }),
    );
    return this.openers.filter((_, index) => filterResults[index]);
  }

  public registerOpener(opener: IOpener) {
    this.openers.push(opener);
    return {
      dispose: () => {
        const index = this.openers.indexOf(opener);
        if (index !== -1) {
          this.openers.splice(index, 1);
        }
      },
    };
  }

  async open(uri: URI | string): Promise<boolean> {
    if (typeof uri === 'string') {
      uri = URI.parse(uri);
    }
    const openers = await this.getOpeners(uri);

    for (const opener of openers) {
      const handled = await opener.open(uri);
      if (handled) {
        return true;
      }
    }

    return this.defaultOpener.open(uri);
  }

  dispose() {
    this.openers = [];
  }
}
