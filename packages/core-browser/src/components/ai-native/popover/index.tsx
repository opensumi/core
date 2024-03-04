import React, { useCallback, useMemo } from 'react';

import { IPopoverProps, Popover } from '@opensumi/ide-components';
import { uuid } from '@opensumi/ide-core-common';

export const EnhancePopover = (props: IPopoverProps) => {
  const { children, id, title, onClick } = props;
  const [display, setDisplay] = React.useState(false);

  const uid = useMemo(() => id + uuid(6), [id]);

  const handleClick = useCallback(
    (arg: any) => {
      setDisplay(false);
      if (onClick) {
        onClick(arg);
      }
    },
    [onClick],
  );

  const onDisplayChange = useCallback((d: boolean) => {
    setDisplay(d);
  }, []);

  return (
    <Popover id={uid} title={title} onClick={handleClick} display={display} onDisplayChange={onDisplayChange}>
      {children}
    </Popover>
  );
};
