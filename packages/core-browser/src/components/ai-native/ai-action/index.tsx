import React, { useCallback, useEffect } from 'react';

import { AIInlineChatContentWidget, createLayoutEventType } from '@opensumi/ide-core-browser';
import { useHover } from '@opensumi/ide-core-browser/lib/react-hooks/hover';

import { MenuNode } from '../../../menu/next/base';
import { AILogoAvatar, EnhanceIcon, EnhanceIconWithCtxMenu } from '../enhanceIcon';
import { LineVertical } from '../line-vertical';
import { EnhancePopover } from '../popover';

import styles from './index.module.less';

export type InlineChatOperationalRenderType = 'button' | 'dropdown';

export interface AICodeActionItem {
  title?: string;
  kind?: string;
  isPreferred?: boolean;
  disabled?: string;
}

export interface AIActionItem {
  /**
   * 唯一标识的 id
   */
  id: string;
  /**
   * 用于展示的名称
   */
  name: string;
  /**
   * hover 上去的 popover 提示
   */
  title?: string;
  renderType?: InlineChatOperationalRenderType;
  /**
   * 排序
   */
  order?: number;

  /**
   * Show in code action list, default is not show
   * Only support editor inline chat now
   * @example {}
   */
  codeAction?: AICodeActionItem;
}

export interface AIActionProps {
  operationList: AIActionItem[];
  moreOperation?: MenuNode[];
  showClose?: boolean;
  onClickItem: (id: string) => void;
  onClose?: () => void;
}

const layoutEventType = createLayoutEventType(AIInlineChatContentWidget);
const layoutEvent = new CustomEvent(layoutEventType, {
  bubbles: true,
});

export const AIAction = (props: AIActionProps) => {
  const { operationList, moreOperation, showClose, onClickItem, onClose } = props;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ref, isHovered] = useHover<HTMLDivElement>();

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.dispatchEvent(layoutEvent);
    }
  }, [isHovered]);

  return (
    <div ref={containerRef} className={styles.ai_action}>
      <AILogoAvatar className={styles.ai_action_icon} />
      <LineVertical height='60%' margin='0px 4px 0 8px' />
      <div ref={ref} className={styles.operate_container}>
        {operationList.map(({ name, title, id }, i) =>
          title ? (
            <EnhancePopover id={id} title={title} key={`popover_${i}`}>
              <EnhanceIcon wrapperClassName={styles.operate_item} onClick={() => onClickItem(id)}>
                <span key={i}>{name}</span>
              </EnhanceIcon>
            </EnhancePopover>
          ) : (
            <EnhanceIcon wrapperClassName={styles.operate_item} onClick={() => onClickItem(id)} key={i}>
              <span>{name}</span>
            </EnhanceIcon>
          ),
        )}
        {moreOperation?.length ? (
          <EnhanceIconWithCtxMenu
            icon={'more'}
            menuNodes={moreOperation}
            wrapperClassName={styles.operate_btn}
            skew={{
              x: -83,
              y: 5,
            }}
          />
        ) : null}
        {showClose !== false && (
          <div
            className={styles.close_container}
            style={{
              display: isHovered ? 'flex' : 'none',
            }}
          >
            <LineVertical height='60%' margin='0px 4px 0 4px' />
            <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'window-close'} onClick={handleClose} />
          </div>
        )}
      </div>
    </div>
  );
};
