import { ClientAppConfig } from './application-props';

export class ClientAppConfigProvider {

  private static KEY = Symbol('ClientAppConfigProvider');

  static get(): ClientAppConfig {
    const config = ClientAppConfigProvider.doGet();
    if (config === undefined) {
      throw new Error('The configuration is not set. Did you call ClientAppConfigProvider#set?');
    }
    return config;
  }

  static set(config: ClientAppConfig): void {
    if (ClientAppConfigProvider.doGet() !== undefined) {
      throw new Error('The configuration is already set.');
    }
    const globalObject = window as any;
    const key = ClientAppConfigProvider.KEY;
    globalObject[key] = config;
  }

  private static doGet(): ClientAppConfig | undefined {
    const globalObject = window as any;
    const key = ClientAppConfigProvider.KEY;
    return globalObject[key];
  }

}
