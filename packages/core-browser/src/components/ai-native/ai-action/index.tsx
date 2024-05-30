import React, { useCallback } from 'react';

import { AIInlineChatContentWidgetId, localize } from '@opensumi/ide-core-common';

import { MenuNode } from '../../../menu/next/base';
import { createLayoutEventType } from '../../../monaco';
import { useChange, useHover } from '../../../react-hooks';
import { AILogoAvatar, EnhanceIcon, EnhanceIconWithCtxMenu } from '../enhanceIcon';
import { LineVertical } from '../line-vertical';
import { Loading } from '../loading';
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
  loading?: boolean;
  customOperationRender?: React.ReactNode;
  /**
   * loading 的时候是否继续显示 operation
   */
  loadingShowOperation?: boolean;
}

const layoutEventType = createLayoutEventType(AIInlineChatContentWidgetId);
const layoutEvent = new CustomEvent(layoutEventType, {
  bubbles: true,
});

export const AIAction = (props: AIActionProps) => {
  const {
    operationList,
    moreOperation,
    showClose = true,
    onClickItem,
    onClose,
    customOperationRender,
    loading,
    loadingShowOperation = false,
  } = props;

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
    const defaultOperationList = (
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

    return (
      <div ref={ref} className={styles.operate_container}>
        {customOperationRender ? (
          <div className={styles.custom_operation_wrapper}>{customOperationRender}</div>
        ) : (
          defaultOperationList
        )}
      </div>
    );
  }, [customOperationRender, operationList, moreOperation]);

  return (
    <div ref={containerRef} className={styles.ai_action}>
      {loading ? (
        <EnhancePopover id={'inline_chat_loading'} title={localize('aiNative.inline.chat.operate.loading.cancel')}>
          <Loading className={styles.loading_icon} />
        </EnhancePopover>
      ) : (
        <React.Fragment>
          <div className={styles.stable_container}>
            <AILogoAvatar className={styles.ai_action_icon} />
            <LineVertical height='100%' margin='0px 4px 0 8px' maxHeight={14} minHeight={14} />
          </div>
          {renderOperation()}
          {showClose && (
            <div className={styles.close_container}>
              <LineVertical height='100%' margin='0px 4px 0 4px' maxHeight={14} minHeight={14} />
              <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'window-close'} onClick={handleClose} />
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
};
