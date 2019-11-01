import * as React from 'react';
import message from 'antd/lib/message';
import 'antd/lib/message/style/index.less';
import './snackbar.module.less';

function generateSnackbar(funName: string) {
  return (content: string | React.ReactNode, duration?: number): Promise<void> => {
    return new Promise((resolve) => {
      message[funName](content, duration, resolve);
    });
  };
}

export const snackbar = {
  success: generateSnackbar('success'),
  error: generateSnackbar('error'),
  info: generateSnackbar('info'),
  warning: generateSnackbar('warning'),
  loading: generateSnackbar('loading'),
};
