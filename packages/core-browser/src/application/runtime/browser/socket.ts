import { Injectable } from '@opensumi/di';
import { ReconnectingWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/reconnecting-websocket';
import { UrlProvider, uuid } from '@opensumi/ide-core-common';

import { BaseConnectionHelper, IBaseConnectionOptions } from '../base-socket';

export interface IWebConnectionOptions extends IBaseConnectionOptions {
  clientId?: string;
  connectionPath: UrlProvider;
  connectionProtocols?: string[];
}

@Injectable()
export class WebConnectionHelper extends BaseConnectionHelper {
  clientId: string;
  constructor(protected options: IWebConnectionOptions) {
    super(options);

    this.clientId = WebConnectionHelper.clientIdFactory();
  }

  getDefaultClientId() {
    return this.clientId;
  }

  createConnection() {
    return ReconnectingWebSocketConnection.forURL(this.options.connectionPath, this.options.connectionProtocols);
  }

  static clientIdFactory() {
    return `CLIENT_ID_${uuid()}`;
  }
}
