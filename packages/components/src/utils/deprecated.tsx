import React from 'react';

import warning from './warning';

// @deprecated wrapper
export function Deprecated<T>(fc: React.FC<T>, msg: string) {
  return (props: T) => {
    React.useEffect(() => {
      // https://reactjs.org/docs/higher-order-components.html#convention-wrap-the-display-name-for-easy-debugging
      warning(false, `${fc.displayName || fc.name} is deprecated: ${msg}`);
    }, []);

    return React.createElement(fc, props);
  };
}
