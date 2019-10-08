import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { CtxMenu } from './ctx-menu/ctx-menu.view';
import { Dialog } from './dialog.view';

export const Overlay = observer(() => {
  return (
    <>
      <Dialog />
      <CtxMenu />
    </>
  );
});
