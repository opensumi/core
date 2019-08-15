import {
  ILogServiceForClient,
  SupportLogNamespace,
  LogLevel,
  format,
} from '../common/';

export class LogServiceClient {
  private namespace: SupportLogNamespace;
  private logServiceForClient: ILogServiceForClient;

  constructor(namespace: SupportLogNamespace, logServiceForClient) {
    this.namespace = namespace;
    this.logServiceForClient = logServiceForClient;
  }

  getLevel() {
    return this.logServiceForClient.getLevel(this.namespace);
  }

  setLevel(level: LogLevel) {
    this.logServiceForClient.setLevel(this.namespace, level);
  }

  verbose(...args: any[]) {
    this.logServiceForClient.verbose(this.namespace, format(arguments));
  }

  debug(...args: any[]) {
    this.logServiceForClient.debug(this.namespace, format(arguments));
  }

  log(...args: any[]) {
    this.logServiceForClient.log(this.namespace, format(arguments));
  }

  warn(...args: any[]) {
    this.logServiceForClient.warn(this.namespace, format(arguments));
  }

  error(...args: any[]) {
    this.logServiceForClient.error(this.namespace, format(arguments));
  }

  critical(...args: any[]) {
    this.logServiceForClient.critical(this.namespace, format(arguments));
  }

  dispose() {
    this.logServiceForClient.dispose(this.namespace);
  }
}
