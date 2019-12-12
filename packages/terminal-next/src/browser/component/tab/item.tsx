import * as React from 'react';
import * as clx from 'classnames';
import { getIcon } from '@ali/ide-core-browser';

import * as styles from './index.module.less';

export enum ItemType {
  info = 0,
  add,
}

export interface ItemProps {
  id?: string;
  name?: string;
  selected?: boolean;
  type?: ItemType;
  onClick?: () => void;
  onClose?: (event: React.MouseEvent) => void;
}

export function renderInfoItem(props: ItemProps) {
  return (
    <div
      className={ clx({
        [styles.item_container]: true,
        [styles.item_selected]: !!props.selected,
      }) }
      onClick={ () => props.onClick && props.onClick() }
    >
      <div className={ styles.item_info_name }>{ props.name }</div>
      <div
        className={clx({
          [getIcon('close')]: true,
        })}
        onClick={ (event) => props.onClose && props.onClose(event) }
      ></div>
    </div>
  );
}

export function renderAddItem(props: ItemProps) {
  return (
    <div
      className={ clx({
        [getIcon('plus')]: true,
        [styles.item_add]: true,
      }) }
      onClick={ () => props.onClick && props.onClick() }
    ></div>
  );
}

export default (props: ItemProps) => {
  const type = props.type || ItemType.info;

  switch (type) {
    case ItemType.info:
      return renderInfoItem(props);
    case ItemType.add:
      return renderAddItem(props);
    default:
      return null;
  }
};
