import { IOpenerService } from '@opensumi/ide-core-browser/lib/opener';
import { Disposable } from '@opensumi/ide-core-common';
import { URI, Uri } from '@opensumi/ide-core-common/lib/uri';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common/editor';
import { RemoteOpenerBrowserServiceImpl } from '@opensumi/ide-remote-opener/lib/browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IRemoteHostConverter, IRemoteOpenerBrowserService, RemoteOpenerBrowserServiceToken } from '../../src/common';

describe('packages/remote-opener/src/browser/remote.opener.service.ts', () => {
  let remoteOpenerService: IRemoteOpenerBrowserService;
  let workbenchEditorService: WorkbenchEditorService;
  let openerService: IOpenerService;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    injector.addProviders({
      token: RemoteOpenerBrowserServiceToken,
      useClass: RemoteOpenerBrowserServiceImpl,
    });
    injector.overrideProviders(
      {
        token: IOpenerService,
        useValue: {
          open: jest.fn(),
        },
      },
      {
        token: WorkbenchEditorService,
        useValue: {
          open: jest.fn(),
        },
      },
    );

    remoteOpenerService = injector.get(RemoteOpenerBrowserServiceToken);
    workbenchEditorService = injector.get(WorkbenchEditorService);
    openerService = injector.get(IOpenerService);
  });

  it('$openExternal open file should be work', async () => {
    const spyOnOpen = jest.spyOn(workbenchEditorService, 'open');
    const spyOnOpenExternal = jest.spyOn(remoteOpenerService, '$openExternal');

    const mockFileUri = Uri.file('/path/to/file.js');
    await remoteOpenerService.$openExternal('file', mockFileUri);

    expect(spyOnOpenExternal).toBeCalledWith('file', mockFileUri);
    expect(spyOnOpen).toBeCalledWith(URI.parse(mockFileUri.toString()), { preview: false, focus: true });
  });

  it('$openExternal open url should be work', async () => {
    const disposes = new Disposable();
    const converter: IRemoteHostConverter = {
      convert: (port) => `opensumi-${port}-ide.com`,
    };
    const spyOnConverter = jest.spyOn(converter, 'convert');

    disposes.addDispose(remoteOpenerService.registerSupportHosts(['localhost', '0.0.0.0', '0.0.0.0']));
    disposes.addDispose(remoteOpenerService.registerConverter(converter));

    const spyOnOpen = jest.spyOn(openerService, 'open');
    const spyOnOpenExternal = jest.spyOn(remoteOpenerService, '$openExternal');

    const mockUrl = Uri.parse('https://opensumi-ide.com');
    await remoteOpenerService.$openExternal('url', mockUrl);

    expect(spyOnOpenExternal).toBeCalledWith('url', mockUrl);
    expect(spyOnOpen).toBeCalledWith(mockUrl.toString());

    spyOnOpen.mockClear();

    const mockLocalUrl = Uri.parse('http://0.0.0.0:3030');
    await remoteOpenerService.$openExternal('url', mockLocalUrl);

    expect(spyOnOpenExternal).toBeCalledWith('url', mockLocalUrl);
    expect(spyOnOpen).toBeCalledWith('https://opensumi-3030-ide.com/');

    expect(spyOnConverter).toBeCalledWith('3030');
  });
});
