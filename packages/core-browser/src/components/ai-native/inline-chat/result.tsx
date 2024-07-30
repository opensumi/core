import cls from 'classnames';
import React from 'react';

import { Button, ButtonType } from '@opensumi/ide-components';

import { EnhanceIcon } from '../enhanceIcon';
import { LineVertical } from '../line-vertical';
import { Thumbs } from '../thumbs';

import styles from './styles.module.less';

export interface IAIInlineResultIconItemsProps {
  text: string | React.ReactNode;
  onClick: () => void;
  btnType?: ButtonType;
  icon?: string;
}

export interface IAIInlineResultProps {
  iconItems: IAIInlineResultIconItemsProps[];
  isRenderThumbs?: boolean;
  isRenderClose?: boolean;
  closeClick?: () => void;
}

export const AIInlineResult = (props: IAIInlineResultProps) => {
  const { iconItems, isRenderThumbs = true, isRenderClose = false, closeClick } = props;

  return (
    <div className={styles.ai_inline_result_panel}>
      <div className={styles.side}>
        {iconItems.map(({ icon, text, onClick, btnType }, idx) => (
          <EnhanceIcon
            wrapperClassName={cls(styles.operate_btn, btnType === 'default' ? styles.default : '')}
            icon={icon}
            onClick={onClick}
            key={idx}
          >
            <span>{text}</span>
          </EnhanceIcon>
        ))}
      </div>
      {isRenderThumbs && (
        <>
          <LineVertical height={'60%'} margin={'0px 6px 0 6px'} />
          <div className={styles.side}>
            <Thumbs wrapperClassName={styles.operate_icon} />
          </div>
        </>
      )}
      {isRenderClose && (
        <>
          <EnhanceIcon wrapperClassName={styles.operate_btn} icon='close' onClick={closeClick}></EnhanceIcon>
        </>
      )}
    </div>
  );
};
