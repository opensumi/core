import { Injectable } from '@opensumi/di';
import { ReconnectingWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/reconnecting-websocket';
import { UrlProvider, uuid } from '@opensumi/ide-core-common';

import { BaseConnectionHelper, IBaseConnectionOptions } from '../base';

export interface IWebConnectionOptions extends IBaseConnectionOptions {
  clientId?: string;
  connectionPath: UrlProvider;
  connectionProtocols?: string[];
}

@Injectable()
export class WebConnectionHelper extends BaseConnectionHelper {
  constructor(protected options: IWebConnectionOptions) {
    super(options);
  }
  generateNewClientId() {
    return `CLIENT_ID_${uuid()}`;
  }

  createConnection() {
    return ReconnectingWebSocketConnection.forURL(this.options.connectionPath, this.options.connectionProtocols);
  }
}
