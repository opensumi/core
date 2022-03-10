import React, { PropsWithChildren, useRef, useEffect } from 'react';

import { IInputBaseProps, Input } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';

import { IMainLayoutService } from '../../common';

export const AutoFocusedInput = ({
  containerId,
  ...inputProps
}: PropsWithChildren<{ containerId: string } & IInputBaseProps>) => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const doFocus = React.useCallback(() => {
    if (inputRef && inputRef.current) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [inputRef.current]);

  useEffect(() => {
    doFocus();

    const handler = layoutService.getTabbarHandler(containerId);
    const disposable = handler?.onActivate(doFocus);

    return () => {
      disposable?.dispose();
    };
  }, [layoutService]);
  return <Input ref={inputRef} {...inputProps} />;
};
