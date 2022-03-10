import React from 'react';

import { Token, Injector } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ConfigContext } from '../react-providers';

function isDisposable(target: any): target is Disposable {
  return target && (target as any).dispose;
}

export function useInjectable<T = any>(Constructor: Token, args?: any): T {
  const { injector } = React.useContext(ConfigContext);

  const instance = React.useMemo(() => injector.get(Constructor, args), [injector, Constructor]);

  React.useEffect(
    () => () => {
      // 如果这是多例模式，DI 中不会留有这个实例对象
      // 由于实例可能存在在父 injector 中，需要做一下递归判断
      let curr: Injector | undefined = injector;
      while (curr && !curr.hasInstance(instance)) {
        curr = (curr as any).parent;
      }
      if (!curr) {
        if (isDisposable(instance)) {
          instance.dispose();
        }
      }
    },
    [instance],
  );

  return instance;
}
