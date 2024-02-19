import cls from 'classnames';
import React from 'react';

import { SplitPanel, SplitPanelProps } from '@opensumi/ide-core-browser/lib/components';

import * as styles from '../../layout/layout.module.less';

export const DesignSplitPanel: React.FC<SplitPanelProps> = ({ id, className, resizeHandleClassName, ...restProps }) => (
    <SplitPanel
      id={id}
      {...restProps}
      className={cls(className, styles.ai_native_panel_container)}
      resizeHandleClassName={cls(resizeHandleClassName, styles.ai_native_slot_resize_horizontal)}
    ></SplitPanel>
  );
