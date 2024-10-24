import { Injector } from '@opensumi/di';

export const ClientAppContextContribution = Symbol('ClientAppContextContribution');

export interface ClientAppContextContribution {
  registerClientAppContext: (layout: React.FC, injector: Injector) => React.FC;
}
