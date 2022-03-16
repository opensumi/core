/* eslint-disable no-console */
import React from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon';
import { createFromIconfontCN } from '@opensumi/ide-components/lib/icon/iconfont-cn';

type IconFontMap = 'icon-javascript' | 'icon-java' | 'icon-shoppingcart' | 'icon-python';

const IconFont = createFromIconfontCN<IconFontMap>({
  scriptUrl: [
    '//at.alicdn.com/t/font_1788044_0dwu4guekcwr.js', // icon-javascript, icon-java, icon-shoppingcart (overrided)
    '//at.alicdn.com/t/font_1788592_a5xf2bdic3u.js', // icon-shoppingcart, icon-python
  ],
});

export const SampleView = () => (
  <div>
    Hello DW
    <div className='icons-list'>
      <IconFont size='large' icon='icon-javascript' />
      <IconFont icon='icon-java' onClick={() => console.log('icon java clicked')} />
      <IconFont loading icon='icon-shoppingcart' />
      <IconFont disabled size='large' icon='icon-python' />
      <Icon icon='explorer' />
      {/* <Icon icon='fanhui' /> */}
      <Icon icon='shangchuan' />
    </div>
  </div>
);

export const SampleMainView = () => (
  <div style={{ backgroundColor: 'var(--editor-background)', height: '100%' }}>Hello DW</div>
);

export const SampleTopView = () => <div style={{ background: 'var(--menu-background)', height: 30 }}>Mock top bar</div>;

export const SampleBottomView = () => (
  <div style={{ background: 'var(--statusBar-background)', height: 22 }}>Mock bottom bar</div>
);
