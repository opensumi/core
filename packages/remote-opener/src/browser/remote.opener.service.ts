import { Injectable, Autowired } from '@opensumi/di';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { CommandService, Disposable, IDisposable, Uri, URI } from '@opensumi/ide-core-common';
import { RPCService } from '@opensumi/ide-connection/lib/common/proxy';

import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences';
import { IOpenerService } from '@opensumi/ide-core-browser/lib/opener';
import { IRemoteHostConverter, IRemoteOpenerBrowserService } from '@opensumi/ide-core-browser/lib/remote-opener';

const SUPPORT_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];

@Injectable()
export class RemoteOpenerBrowserServiceImpl extends RPCService implements IRemoteOpenerBrowserService {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(CommandService)
  protected commandService: CommandService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  private supportHosts: Set<string> = new Set(SUPPORT_HOSTS);

  private converter: IRemoteHostConverter | null = null;

  registerSupportHosts(hosts: string[]) {
    for (const host of hosts) {
      this.supportHosts.add(host);
    }
    return Disposable.create(() => {
      for (const host of hosts) {
        this.supportHosts.delete(host);
      }
    });
  }

  registerConverter(converter: IRemoteHostConverter): IDisposable {
    if (this.converter) {
      throw new Error('Only one converter is allowed.');
    }

    this.converter = converter;
    return Disposable.create(() => {
      this.converter = null;
    });
  }

  get isRemoteOpenerEnabled(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.preferenceService.get('remote.opener.enable', true)!;
  }

  async $openExternal(type: 'file' | 'url', uri: Uri): Promise<void> {
    if (!this.isRemoteOpenerEnabled) {
      return;
    }

    const revivedUri = Uri.revive(uri);
    switch (type) {
      case 'url': {
        const url = new URL(decodeURIComponent(revivedUri.toString()));
        if (this.supportHosts.has(url.hostname)) {
          if (!this.converter) {
            throw new Error('Converter is not registered.');
          }

          const { port } = url;
          const hostname = this.converter.convert(port);
          // Default use https protocol
          url.protocol = 'https';
          // remove port
          url.port = '';
          url.hostname = hostname;
        }

        this.openerService.open(url.toString());
        break;
      }
      case 'file':
        this.workbenchEditorService.open(URI.parse(revivedUri.toString()), { preview: false, focus: true });
        break;
      default:
        console.warn(`Unsupported ${type}.`);
        break;
    }
  }
}
