import React, { useEffect } from 'react';

export function useHover<T extends Element>() {
  const ref = React.useRef<T>(null);

  const [isHovered, setHovered] = React.useState(false);

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  useEffect(() => {
    const elem = ref.current;
    if (elem) {
      elem.addEventListener('mouseenter', handleMouseEnter);
      elem.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        elem.removeEventListener('mouseenter', handleMouseEnter);
        elem.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, []);

  return [ref, isHovered] as const;
}
