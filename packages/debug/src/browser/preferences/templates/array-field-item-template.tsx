import {
  ArrayFieldTemplateItemType,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';
import cls from 'classnames';
import React, { useMemo } from 'react';

import styles from './json-templates.module.less';

const BTN_GRP_STYLE = {
  width: '100%',
};

const BTN_STYLE = {
  width: 'calc(100% / 4)',
};

export const ArrayFieldItemTemplate = <
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(
  props: ArrayFieldTemplateItemType<T, S, F>,
) => {
  const {
    className,
    children,
    disabled,
    hasCopy,
    hasMoveDown,
    hasMoveUp,
    hasRemove,
    hasToolbar,
    index,
    onCopyIndexClick,
    onDropIndexClick,
    onReorderClick,
    readonly,
    registry,
  } = props;
  const { CopyButton, MoveDownButton, MoveUpButton, RemoveButton } = registry.templates.ButtonTemplates;

  const onCopyClick = useMemo(() => onCopyIndexClick(index), [index, onCopyIndexClick]);
  const onRemoveClick = useMemo(() => onDropIndexClick(index), [index, onDropIndexClick]);
  const onArrowUpClick = useMemo(() => onReorderClick(index, index - 1), [index, onReorderClick]);
  const onArrowDownClick = useMemo(() => onReorderClick(index, index + 1), [index, onReorderClick]);

  return (
    <div key={`array-item-${index}`} className={cls(className, styles.array_field_item_template)}>
      <div className={styles.control_field}>{React.cloneElement(children, { name: '' })}</div>

      {hasToolbar && (
        <div className={styles.toolbar}>
          <div style={BTN_GRP_STYLE}>
            {(hasMoveUp || hasMoveDown) && (
              <MoveUpButton
                disabled={disabled || readonly || !hasMoveUp}
                onClick={onArrowUpClick}
                style={BTN_STYLE}
                registry={registry}
              />
            )}
            {(hasMoveUp || hasMoveDown) && (
              <MoveDownButton
                disabled={disabled || readonly || !hasMoveDown}
                onClick={onArrowDownClick}
                style={BTN_STYLE}
                registry={registry}
              />
            )}
            {hasCopy && (
              <CopyButton disabled={disabled || readonly} onClick={onCopyClick} style={BTN_STYLE} registry={registry} />
            )}
            {hasRemove && (
              <RemoveButton
                disabled={disabled || readonly}
                onClick={onRemoveClick}
                style={BTN_STYLE}
                registry={registry}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
