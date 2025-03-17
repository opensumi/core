import RcImage, { ImageProps as RcImageProps } from 'rc-image';
import React from 'react';

import './styles.less';
import { Icon } from '../icon';

export interface ImageProps extends RcImageProps {
  className?: string;
}

export const Image = (props: ImageProps) => (
  <RcImage
    prefixCls='kt-image'
    preview={{
      getContainer: () => document.getElementById('main') || document.getElementsByTagName('body')?.[0],
      mask: (
        <div className='mask'>
          <Icon iconClass='codicon codicon-eye' />
        </div>
      ),
    }}
    {...props}
  />
);
