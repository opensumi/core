import { IDisposable, Uri } from '..';

export const RemoteOpenerConverterContribution = Symbol('RemoteOpenerConverterContribution');

export interface RemoteOpenerConverterContribution {
  registerConverter(registry: IRemoteOpenerBrowserService): void;
}

export interface IRemoteHostConverter {
  /**
   * Convert a port to a host name for cloud IDE.
   * @example
   * ```typescript
   * // port: 3030
   * const host = converter.convert('3030');
   * // host: 'cloud-ide.opensumi-3030.com'
   * ```
   */
  convert(port: string): string;
}

export const RemoteOpenerBrowserServiceToken = Symbol('RemoteOpenerBrowserServiceToken');

export interface IRemoteOpenerBrowserService {
  $openExternal(type: 'file' | 'url', uri: Uri): Promise<void>;

  /**
   * Register a converter.
   * @see IRemoteHostConverter
   * @param converter is a converter to convert port to host name.
   */
  registerConverter(converter: IRemoteHostConverter): IDisposable;

  registerSupportHosts(hosts: string[]): IDisposable;
}
