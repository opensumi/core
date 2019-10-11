import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';

export const Markers = observer(() => {
  const noError = '目前尚未在工作区检测到问题。';
  return (
    <React.Fragment>
      <h1>{noError}</h1>
    </React.Fragment>
  );
});
