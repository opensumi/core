import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection';

export interface IBaseConnectionOptions {
  clientId?: string;
}

export abstract class BaseConnectionHelper {
  abstract generateNewClientId(): string;

  abstract createConnection(): BaseConnection<Uint8Array>;

  constructor(protected options: IBaseConnectionOptions) {}
}

export const CONNECTION_HELPER_TOKEN = Symbol('CONNECTION_HELPER_TOKEN');
