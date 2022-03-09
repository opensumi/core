import clx from 'classnames';
import debouce = require('lodash.debounce');
import React from 'react';

import { getIcon } from '@opensumi/ide-core-browser';

import { ItemProps, ItemType } from '../../common';


import styles from './tab.module.less';

export function renderInfoItem(props: ItemProps) {
  const handleSelect = debouce(() => props.onClick && props.onClick(), 20);
  const handleClose = debouce(() => props.onClose && props.onClose(), 20);

  const handleOnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && props.onInputEnter && props.id) {
      props.onInputEnter(props.id, (e.target as any).value);
    }
  };

  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    // 刚刚选中，滚一下
    if (props.selected) {
      ref.current?.scrollIntoView();
    }
  }, [props.selected]);

  return (
    <div
      ref={ref}
      className={clx({
        [styles.item_container]: true,
        [styles.item_selected]: !!props.selected,
      })}
      onClick={() => handleSelect()}
      onContextMenu={(event) => props.onContextMenu && props.onContextMenu(event)}
    >
      {props.editable ? (
        <input
          autoFocus
          ref={(ele) => ele && ele.select()}
          className={styles.item_info_input}
          defaultValue={props.name}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => props.onInputBlur && props.id && props.onInputBlur(props.id)}
          onKeyDown={(e) => handleOnKeyDown(e)}
        ></input>
      ) : (
        <div id={props.id} className={styles.item_info_name} title={props.name}>
          {props.name}
        </div>
      )}
      {props.editable ? (
        <div></div>
      ) : (
        <div
          className={clx([getIcon('close'), styles.close_icon])}
          onClick={(event) => {
            event.stopPropagation();
            handleClose();
          }}
        ></div>
      )}
    </div>
  );
}

export function renderAddItem(props: ItemProps) {
  const handleAdd = debouce(() => props.onClick && props.onClick(), 20);

  return (
    <div
      className={clx({
        [getIcon('plus')]: true,
        [styles.item_add]: true,
      })}
      onClick={() => handleAdd()}
    ></div>
  );
}

export default (props: ItemProps) => {
  const type = props.type || ItemType.info;

  switch (type) {
    case ItemType.info:
      return props.provider.infoItemRender(props);
    case ItemType.add:
      return props.provider.addItemRender(props);
    default:
      return null;
  }
};
