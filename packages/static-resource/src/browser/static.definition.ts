import { Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-browser';

@Injectable()
export abstract class StaticResourceService {

  public abstract registerStaticResourceProvider(provider: IStaticResourceProvider);

  public abstract async resolveStaticResource(uri: URI): Promise<URI>;

}

export interface IStaticResourceProvider {

  scheme: string;

  resolveStaticResource(uri: URI): Promise<URI>;

}

export const StaticResourceContribution = Symbol('StaticResourceContribution');

export const StaticResourceContributionProvider = Symbol('StaticResourceContributionProvider');

export interface StaticResourceContribution {

  registerStaticResolver(service: StaticResourceService): void;

}
