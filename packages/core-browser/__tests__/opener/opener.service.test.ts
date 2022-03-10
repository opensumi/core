import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { URI } from '../../src';
import { IOpenerService, IOpener } from '../../src/opener';
import { DefaultOpener } from '../../src/opener/default-opener';
import { OpenerService } from '../../src/opener/opener.service';

describe('packages/core-browser/src/opener/opener.service.ts', () => {
  let openerService: IOpenerService;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IOpenerService,
        useClass: OpenerService,
      },
      {
        token: DefaultOpener,
        useFactory: () => ({
          open: jest.fn(async () => true),
          handleScheme: jest.fn(),
        }),
      },
    );
    openerService = injector.get(IOpenerService);
  });

  afterEach(() => {
    openerService.dispose();
  });

  it('execute different opener', async () => {
    const opener1: IOpener = {
      open: jest.fn(),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    const opener2: IOpener = {
      open: jest.fn(),
      handleScheme: (scheme) => scheme === 'bbb',
    };
    openerService.registerOpener(opener1);
    openerService.registerOpener(opener2);
    await openerService.open(
      URI.from({
        scheme: 'bbb',
      }),
    );
    expect(opener1.open).toBeCalledTimes(0);
    expect(opener2.open).toBeCalledTimes(1);
  });

  it('open same opener when no returns', async () => {
    const opener1: IOpener = {
      open: jest.fn(),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    const opener2: IOpener = {
      open: jest.fn(),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    openerService.registerOpener(opener1);
    openerService.registerOpener(opener2);
    await openerService.open(
      URI.from({
        scheme: 'aaa',
      }),
    );
    expect(opener1.open).toBeCalledTimes(1);
    expect(opener2.open).toBeCalledTimes(1);
  });

  it('open same opener when return true', async () => {
    const opener1: IOpener = {
      open: jest.fn(() => true),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    const opener2: IOpener = {
      open: jest.fn(),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    openerService.registerOpener(opener1);
    openerService.registerOpener(opener2);
    await openerService.open(
      URI.from({
        scheme: 'aaa',
      }),
    );
    expect(opener1.open).toBeCalledTimes(1);
    // 如果前一个 opener 返回 true，则不会执行下面的 opener
    expect(opener2.open).toBeCalledTimes(0);
  });

  it('use handleURI', async () => {
    const opener1: IOpener = {
      open: jest.fn(),
      handleURI: (uri: URI) => uri.scheme === 'aaa',
      handleScheme: jest.fn(),
    };
    openerService.registerOpener(opener1);
    await openerService.open(
      URI.from({
        scheme: 'aaa',
      }),
    );
    expect(opener1.open).toBeCalledTimes(1);
    // 使用 handleURI 后不会执行 handleScheme
    expect(opener1.handleScheme).toBeCalledTimes(0);
  });

  it('use default opener', async () => {
    await openerService.open(URI.parse('alipays://app'));
    const defaultOpener = (openerService as any).defaultOpener;
    expect(defaultOpener.open).toBeCalledTimes(1);
    expect(defaultOpener.handleScheme).toBeCalledTimes(0);
  });

  it('dispose a opener', async () => {
    const opener1: IOpener = {
      open: jest.fn(() => true),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    const opener2: IOpener = {
      open: jest.fn(),
      handleScheme: (scheme) => scheme === 'aaa',
    };
    const disposeOpener1 = openerService.registerOpener(opener1);
    openerService.registerOpener(opener2);

    disposeOpener1.dispose();
    await openerService.open(
      URI.from({
        scheme: 'aaa',
      }),
    );
    expect(opener1.open).toBeCalledTimes(0);
    // 前一个被 dispose 了，则会执行到 2
    expect(opener2.open).toBeCalledTimes(1);
  });
});
