import * as React from 'react';
import { ConstructorOf } from '@ali/ide-core';
import { ConfigContext } from '../react-providers';

export function useInjectable<T extends { dispose?: () => void }>(Constructor: ConstructorOf<T>) {
  const { injector } = React.useContext(ConfigContext);

  const instance = React.useMemo(() => {
    return injector.get(Constructor);
  }, [injector, Constructor]);

  React.useEffect(() => {
    return () => {
      // 如果这是多例模式，DI 中不会留有这个实例对象
      if (!injector.hasInstance(instance)) {
        if (instance.dispose) {
          instance.dispose();
        }
      }
    };
  }, [instance]);

  return instance;
}
