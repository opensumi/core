import clx from 'classnames';
import debounce from 'lodash/debounce';
import React from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';
import { getIcon, getIconClass } from '@opensumi/ide-core-browser';
import { Loading } from '@opensumi/ide-core-browser/lib/components/loading';

import { ItemProps, ItemType } from '../../common';

import styles from './tab.module.less';

export function renderInfoItem(props: ItemProps) {
  const handleSelect = debounce(() => props.onClick && props.onClick(), 20);
  const handleClose = debounce(() => props.onClose && props.onClose(), 20);

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
          {props.name !== '' ? (
            <>
              <Icon
                iconClass={getIcon(props.name?.toLowerCase() || 'terminal') || getIcon('terminal')}
                style={{ marginRight: 4, color: 'inherit', fontSize: 14 }}
              />
              <span className={styles.item_title}>{props.name}</span>
            </>
          ) : (
            <Loading />
          )}
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
        />
      )}
    </div>
  );
}

export function renderAddItem(props: ItemProps) {
  const handleAdd = debounce(() => props.onClick && props.onClick(), 20);

  return (
    <div className={styles.item_wrapper}>
      <div
        className={clx({
          [getIcon('plus')]: true,
          [styles.item_add]: true,
        })}
        onClick={() => handleAdd()}
      />
      <div
        className={clx({
          [getIcon('down')]: true,
          [styles.item_more]: true,
        })}
        onClick={props.onDropdown}
      />
    </div>
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
