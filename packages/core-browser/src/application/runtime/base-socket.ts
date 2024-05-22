import { IRuntimeSocketConnection } from '@opensumi/ide-connection/lib/common/connection';

export abstract class BaseConnectionHelper {
  abstract getDefaultClientId(): string;

  abstract createConnection(): IRuntimeSocketConnection;
}

export const CONNECTION_HELPER_TOKEN = Symbol('CONNECTION_HELPER_TOKEN');
