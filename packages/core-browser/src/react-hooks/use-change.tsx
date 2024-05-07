import React from 'react';

export function useChange<T>(value: T, onChange: (value: T) => void) {
  const ref = React.useRef(value);

  React.useEffect(() => {
    if (ref.current !== value) {
      onChange(value);
      ref.current = value;
    }
  }, [value]);
}
