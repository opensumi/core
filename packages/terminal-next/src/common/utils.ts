import { uuid } from '@opensumi/ide-core-common';

let i = 0;
function count() {
  return i++;
}

export const userActionViewUuid = () => `UI_View_${uuid()}${count()}`;

export const apiActionViewUuid = () => `API_View_${uuid()}${count()}`;

export const generate = () => uuid();
