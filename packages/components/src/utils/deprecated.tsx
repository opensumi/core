import * as React from 'react';
import warning from './warning';

// @deprecated wrapper
export function Deprecated<T>(fc: React.FC<T>, msg: string) {
  return (props: T) => {
    React.useEffect(() => {
      warning(false, `${fc.name} is deprecated: ${msg}`);
    }, []);

    return React.createElement(fc, props);
  };
}
