import React from 'react';
import { useRef, useEffect } from 'react';
import { Input } from '@ali/ide-components';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IMainLayoutService } from '../../common';

export const AutoFocusedInput = ({ containerId, ...inputProps }) => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const doFocus = React.useCallback(() => {
    if (inputRef && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
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
