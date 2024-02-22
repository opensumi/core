import { IDisposable, MaybePromise, URI } from '..';

export const OpenerContribution = Symbol('OpenerContribution');
export interface OpenerContribution {
  registerOpener(registry: IOpenerService): void;
}

export interface IOpener {
  open(uri: URI): MaybePromise<boolean>;
  handleScheme(scheme: string): MaybePromise<boolean>;
  // 当有 handleURI，会无视 handleScheme
  handleURI?(uri: URI): MaybePromise<boolean>;
}

export const IOpenerService = Symbol('IOpenerService');
export interface IOpenerService extends IDisposable {
  registerOpener(opener: IOpener): IDisposable;
  open(resource: URI | string): MaybePromise<boolean>;
}
