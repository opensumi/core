import * as React from 'react';

export const ClickOutside: React.FC<{
  onOutsideClick: (e: MouseEvent) => void;
  mouseEvents: Array<keyof WindowEventMap>;
} & React.HTMLAttributes<HTMLDivElement>> = ({
  mouseEvents = ['click'],
  onOutsideClick,
  children,
  ...restProps
}) => {
  const $containerEl = React.useRef<HTMLDivElement | null>(null);

  const globalClickSpy = React.useCallback((e: MouseEvent) => {
    if ($containerEl.current && e.target && !$containerEl.current.contains(e.target as any)) {
      onOutsideClick(e);
    }
  }, [onOutsideClick]);

  React.useEffect(() => {
    mouseEvents.forEach((event) => {
      window.addEventListener(event, globalClickSpy, true);
    });
    return () => {
      mouseEvents.forEach((event) => {
        window.removeEventListener(event, globalClickSpy, true);
      });
    };
  }, [ mouseEvents ]);

  return <div {...restProps} ref={$containerEl}>{children}</div>;
};
