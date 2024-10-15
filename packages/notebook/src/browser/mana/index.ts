import { GlobalContainer, Syringe } from '@difizen/mana-app';

import { Injector } from '@opensumi/di';

export const OpensumiInjector = Syringe.defineToken('OpensumiInjector');
export const ManaContainer = Symbol('ManaContainer');

export const initLibroOpensumi = (injector: Injector, container?: Syringe.Container) => {
  const initInjector = injector;
  const initContainer = container || GlobalContainer;
  initInjector.addProviders({
    token: ManaContainer,
    useValue: initContainer,
  });
  initContainer?.register({ token: OpensumiInjector, useValue: initInjector });
};

export const manaContainer = GlobalContainer.createChild();
