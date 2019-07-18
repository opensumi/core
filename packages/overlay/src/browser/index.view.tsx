
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Dialog } from './dialog.view';

export const Overlay = observer(() => {

  return (
    <div>
      <Dialog></Dialog>
    </div>
  );
});
