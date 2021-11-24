import { ElectronMainContribution, ElectronMainModule } from '@opensumi/ide-core-electron-main';
import { Domain } from '@opensumi/ide-core-common';
import { protocol } from 'electron';
import { ProtocolElectronMainContribution } from '@opensumi/ide-core-electron-main/lib/bootstrap/services/protocol';
import { WebviewScheme } from '../common';
import { Injectable } from '@opensumi/common-di';

ProtocolElectronMainContribution.schemePrivileges.push(
  {
    scheme: WebviewScheme,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true },
  },
);

@Domain(ElectronMainContribution)
export class WebviewMainElectronContribution implements ElectronMainContribution {

  private webviewContent = '<!DOCTYPE html>\r\n<html lang=\"en\" style=\"width: 100%; height: 100%\">\r\n<head>\r\n\t<title>Virtual Document</title>\r\n</head>\r\n<body style=\"margin: 0; overflow: hidden; width: 100%; height: 100%\">\r\n</body>\r\n</html>';

  onStart() {
    protocol.registerStringProtocol(WebviewScheme, (_request, callback) => {
      callback(this.webviewContent);
    });
  }
}

@Injectable()
export class WebviewElectronMainModule extends ElectronMainModule {

  providers = [
    WebviewMainElectronContribution,
  ];
}
