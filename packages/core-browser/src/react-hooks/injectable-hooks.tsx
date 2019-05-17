import * as React from 'react';
import { ConstructorOf } from '@ali/ide-core-common';
import { ConfigContext } from '../react-providers';
import { Token, TokenResult } from '@ali/common-di';
import { Disposable } from '@ali/ide-core';

function isDisposable(target: any): target is Disposable {
  return target && (target as any).dispose;
}

export function useInjectable<
  T extends { dispose?: () => void },
  K extends ConstructorOf<T> | Token,
>(Constructor: K): TokenResult<K> {
  const { injector } = React.useContext(ConfigContext);

  const instance = React.useMemo(() => {
    return injector.get(Constructor);
  }, [injector, Constructor]);

  React.useEffect(() => {
    return () => {
      // 如果这是多例模式，DI 中不会留有这个实例对象
      if (!injector.hasInstance(instance)) {
        if (isDisposable(instance)) {
          instance.dispose();
        }
      }
    };
  }, [instance]);

  return instance;
}
