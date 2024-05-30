import React, { useCallback } from 'react';

import { AIInlineChatContentWidgetId } from '@opensumi/ide-core-common';

import { MenuNode } from '../../../menu/next/base';
import { createLayoutEventType } from '../../../monaco';
import { useChange, useHover } from '../../../react-hooks';
import { AILogoAvatar, EnhanceIcon, EnhanceIconWithCtxMenu } from '../enhanceIcon';
import { InteractiveInput } from '../interactive-input/index';
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
  showInteractiveInput?: boolean;
  onClickItem: (id: string) => void;
  onClose?: () => void;
}

const layoutEventType = createLayoutEventType(AIInlineChatContentWidgetId);
const layoutEvent = new CustomEvent(layoutEventType, {
  bubbles: true,
});

export const AIAction = (props: AIActionProps) => {
  const { operationList, moreOperation, showClose = true, onClickItem, onClose, showInteractiveInput } = props;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ref, isHovered] = useHover<HTMLDivElement>();

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  useChange(isHovered, () => {
    if (containerRef.current) {
      containerRef.current.dispatchEvent(layoutEvent);
    }
  });

  const renderOperation = useCallback(() => {
    if (showInteractiveInput) {
      return (
        <div className={styles.interactive_input_wrapper}>
          <InteractiveInput size='small' placeholder='Hello OpenSumi!' width={180} />
        </div>
      );
    }

    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }, [showInteractiveInput, operationList, moreOperation]);

  return (
    <div ref={containerRef} className={styles.ai_action}>
      <div className={styles.stable_container}>
        <AILogoAvatar className={styles.ai_action_icon} />
        <LineVertical height='100%' margin='0px 4px 0 8px' maxHeight={14} minHeight={14} />
      </div>
      <div ref={ref} className={styles.operate_container}>
        {renderOperation()}
      </div>
      {showClose && (
        <div className={styles.close_container}>
          <LineVertical height='100%' margin='0px 4px 0 4px' maxHeight={14} minHeight={14} />
          <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'window-close'} onClick={handleClose} />
        </div>
      )}
    </div>
  );
};
