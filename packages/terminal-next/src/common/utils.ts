import { uuid } from '@opensumi/ide-core-common';

let i = 0;
function count() {
  return i++;
}

export const userActionViewUuid = () => {
  return `UI_View_${uuid()}${count()}`;
};

export const apiActionViewUuid = () => {
  return `API_View_${uuid()}${count()}`;
};

export const generate = () => {
  return uuid();
};
