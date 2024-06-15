import cls from 'classnames';
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
  operationList?: AIActionItem[];
  moreOperation?: MenuNode[];
  showClose?: boolean;
  onClickItem?: (id: string) => void;
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
    onClose?.();
  }, [onClose]);

  useChange(isHovered, () => {
    containerRef.current?.dispatchEvent(layoutEvent);
  });

  /**
   * loading 的遮罩
   */
  const renderLoadingMask = useCallback(() => {
    if (loading && loadingShowOperation) {
      return <div className={styles.loading_mask}></div>;
    }

    return null;
  }, [loading, loadingShowOperation]);

  const renderOperation = useCallback(() => {
    if (loading && !loadingShowOperation) {
      return null;
    }

    const defaultOperationList = (
      <React.Fragment>
        {operationList?.map(({ name, title, id }, i) =>
          title ? (
            <EnhancePopover id={id} title={title} key={`popover_${i}`}>
              <EnhanceIcon wrapperClassName={styles.operate_item} onClick={() => onClickItem?.(id)}>
                <span key={i}>{name}</span>
              </EnhanceIcon>
            </EnhancePopover>
          ) : (
            <EnhanceIcon wrapperClassName={styles.operate_item} onClick={() => onClickItem?.(id)} key={i}>
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
        {renderLoadingMask()}
        <LineVertical height='100%' margin='0 8px' maxHeight={14} minHeight={14} />
        {customOperationRender ? (
          <div className={styles.custom_operation_wrapper}>{customOperationRender}</div>
        ) : (
          <div className={styles.default_operation_wrapper}>{defaultOperationList}</div>
        )}
      </div>
    );
  }, [customOperationRender, operationList, moreOperation, loading, loadingShowOperation]);

  return (
    <div
      ref={containerRef}
      className={cls(
        styles.ai_action_wrapper,
        loading && styles.loading,
        loadingShowOperation && styles.loading_show_operation,
      )}
    >
      <React.Fragment>
        <div className={styles.stable_container}>
          {loading ? (
            <EnhancePopover id={'inline_chat_loading'} title={localize('aiNative.inline.chat.operate.loading.cancel')}>
              <Loading className={styles.loading_icon} />
            </EnhancePopover>
          ) : (
            <AILogoAvatar className={styles.ai_action_icon} />
          )}
        </div>
        {renderOperation()}
        {showClose && (
          <div className={styles.close_container}>
            <LineVertical height='100%' margin='0px 8px' maxHeight={14} minHeight={14} />
            <EnhanceIcon wrapperClassName={styles.operate_btn} icon={'window-close'} onClick={handleClose} />
          </div>
        )}
      </React.Fragment>
    </div>
  );
};
