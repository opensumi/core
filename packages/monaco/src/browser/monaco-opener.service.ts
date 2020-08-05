import { Injectable, Autowired } from '@ali/common-di';
import { IOpenerService, URI } from '@ali/ide-core-browser';

@Injectable()
export class MonacoOpenerService implements monaco.services.OpenerService {

  private delegate: monaco.services.OpenerService;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  registerOpener(opener: monaco.services.IOpener): monaco.IDisposable {
    return this.openerService.registerOpener({
      open(uri: URI) {
        return opener.open(uri.toString());
      },
      // monaco opener 没有 handleScheme 方法
      handleScheme: () => true,
    });
  }
  async open(resource: monaco.Uri, options?: { openToSide?: boolean | undefined; } | undefined) {
    const res = await this.openerService.open(new URI(resource.toString()));
    if (res) {
      return true;
    } else {
      return await this.delegate.open(resource, options);
    }
  }

  setDelegate(delegate: monaco.services.OpenerService) {
    this.delegate = delegate;
  }
}
