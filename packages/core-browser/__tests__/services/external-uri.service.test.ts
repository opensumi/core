import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IExternalUriService } from '../../src/services';
import { URI, AppConfig } from '../../src';

describe(__filename, () => {
  const oldWindowLocationHostname = window.location.hostname;
  const oldWindowLocationHref = window.location.href;
  const ideHostName = 'ide.aliababa.com';
  const ideUrl = `https://${ideHostName}/workspace?id=1`;
  let externalUriService: IExternalUriService;
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    externalUriService = injector.get(IExternalUriService);
    Object.defineProperty(window, 'location', {
      value: {
        href: ideUrl,
        hostname: ideHostName,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: oldWindowLocationHref,
        hostname: oldWindowLocationHostname,
      },
    });
    injector.disposeAll();
  });

  it('localhost uri to remote uri', async () => {
    const uri = new URI('http://localhost:8080?userId=1');
    const externalUri = externalUriService.resolveExternalUri(uri);
    expect(externalUri.scheme).toBe('https');
    expect(externalUri.authority).toBe('ide.aliababa.com:8080');
    expect(externalUri.path.toString()).toBe('/');
    expect(externalUri.query).toBe('userId=1');
    expect(externalUri.toString(true)).toBe('https://ide.aliababa.com:8080/?userId=1');
  });

  it('not transfer if it is the remote url', async () => {
    const uri = new URI('https://ide.antfin-inc.com/workspaces/5fb21cc29b67dcd76a27272f');
    const externalUri = externalUriService.resolveExternalUri(uri);
    expect(externalUri.scheme).toBe('https');
    expect(externalUri.authority).toBe('ide.antfin-inc.com');
    expect(externalUri.path.toString()).toBe('/workspaces/5fb21cc29b67dcd76a27272f');
    expect(externalUri.toString(true)).toBe('https://ide.antfin-inc.com/workspaces/5fb21cc29b67dcd76a27272f');
  });

  it('use remote host', async () => {
    injector.overrideProviders({
      token: AppConfig,
      useValue: {
        remoteHostname: 'ide.alipay.com',
      },
    });
    const uri = new URI('http://localhost:8080?userId=1');
    const externalUri = externalUriService.resolveExternalUri(uri);
    expect(externalUri.scheme).toBe('https');
    expect(externalUri.authority).toBe('ide.alipay.com:8080');
    expect(externalUri.path.toString()).toBe('/');
    expect(externalUri.query).toBe('userId=1');
    expect(externalUri.toString(true)).toBe('https://ide.alipay.com:8080/?userId=1');
  });
});
