import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection';

export abstract class BaseConnectionHelper {
  abstract getDefaultClientId(): string;

  abstract createConnection(): BaseConnection<Uint8Array>;
}

export const CONNECTION_HELPER_TOKEN = Symbol('CONNECTION_HELPER_TOKEN');
