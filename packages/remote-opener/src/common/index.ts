export const RemoteOpenerServicePath = 'RemoteOpenerService';

export interface IExternalFileArgs {
  type: 'file';
  clientId: string;
  file: string;
}

export interface IExternalUrlArgs {
  type: 'url';
  clientId: string;
  url: string;
}

export const RemoteOpenerServiceToken = Symbol('RemoteOpenerServiceToken');

export interface IRemoteOpenerService {
  openExternal(args: IExternalFileArgs | IExternalUrlArgs): Promise<void>;
}

export const RemoteOpenerClientToken = Symbol('RemoteOpenerClientToken');

export interface IRemoteOpenerClient {
  setRemoteOpenerServiceInstance(clientId: string, service: IRemoteOpenerService): void;
  openExternal(args: IExternalFileArgs | IExternalUrlArgs, clientId: string): Promise<void>;
}
