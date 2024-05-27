import React, { useCallback } from 'react';

import { EnhanceIcon } from '../enhanceIcon';
import { LineVertical } from '../line-vertical';
import { Thumbs } from '../thumbs';

import styles from './styles.module.less';

export interface IAiInlineResultIconItemsProps {
  text: string | React.ReactNode;
  onClick: () => void;
  icon?: string;
}

export interface IAiInlineResultProps {
  iconItems: IAiInlineResultIconItemsProps[];
  isRenderThumbs?: boolean;
  isRenderClose?: boolean;
  closeClick?: () => void;
}

export const AiInlineResult = (props: IAiInlineResultProps) => {
  const { iconItems, isRenderThumbs = true, isRenderClose = false, closeClick } = props;

  return (
    <div className={styles.ai_inline_result_panel}>
      <div className={styles.side}>
        {iconItems.map(({ icon, text, onClick }, idx) => (
          <EnhanceIcon wrapperClassName={styles.operate_btn} icon={icon} onClick={onClick}>
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
