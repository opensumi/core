import React from 'react';

import antdMessage from './message';
import './style.less';

function generateSnackbar(funName: string) {
  return (content: string | React.ReactNode, duration?: number): Promise<void> =>
    new Promise((resolve) => {
      antdMessage[funName](content, duration, resolve);
    });
}

export const message = {
  success: generateSnackbar('success'),
  error: generateSnackbar('error'),
  info: generateSnackbar('info'),
  warning: generateSnackbar('warning'),
  loading: generateSnackbar('loading'),
};
