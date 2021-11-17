import { Injectable } from '@ide-framework/common-di';
import { MonacoOverrideServiceRegistry, ServiceNames } from '@ide-framework/ide-core-browser';

@Injectable()
export class MonacoOverrideServiceRegistryImpl implements MonacoOverrideServiceRegistry {

  private overrideServices: { [serviceId: string]: any } = {};

  registerOverrideService(serviceId: ServiceNames, service: any): void {
    if (this.overrideServices[serviceId]) {
      // tslint:disable-next-line:no-console
      console.warn(`service ${serviceId} is already registered.`);
      return;
    }
    this.overrideServices[serviceId] = service;
  }

  getRegisteredService<S>(serviceId: ServiceNames): S | undefined {
    return this.overrideServices[serviceId];
  }

  all() {
    return this.overrideServices;
  }
}
