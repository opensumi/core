import { Injectable } from '@ali/common-di';
import { URI, IDisposable } from '@ali/ide-core-browser';

@Injectable()
export abstract class StaticResourceService {

  public abstract registerStaticResourceProvider(provider: IStaticResourceProvider): IDisposable;

  public abstract resolveStaticResource(uri: URI): URI;

  public readonly resourceRoots: Set<string>;

}

export interface IStaticResourceProvider {

  scheme: string;

  resolveStaticResource(uri: URI): URI;

  roots?: string[];

}

export const StaticResourceContribution = Symbol('StaticResourceContribution');

export const StaticResourceContributionProvider = Symbol('StaticResourceContributionProvider');

export interface StaticResourceContribution {

  registerStaticResolver(service: StaticResourceService): void;

}
