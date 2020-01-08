import * as React from 'react';
import * as clx from 'classnames';
import { getIcon } from '@ali/ide-core-browser';
import debouce = require('lodash.debounce');

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
  editable?: boolean;
  onClick?: () => void;
  onClose?: () => void;
  onInputBlur?: (id: string) => void;
  onInputEnter?: (id: string, name: string) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
}

export function renderInfoItem(props: ItemProps) {
  const handleSelect = debouce(() => props.onClick && props.onClick(), 20);
  const handleClose = debouce(() => props.onClose && props.onClose(), 20);

  const handleOnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && props.onInputEnter && props.id) {
      props.onInputEnter(props.id, (e.target as any).value);
    }
  };

  return (
    <div
      className={ clx({
        [styles.item_container]: true,
        [styles.item_selected]: !!props.selected,
      }) }
      onClick={ () => handleSelect() }
      onContextMenu={ (event) => props.onContextMenu && props.onContextMenu(event) }
    >
      {
        props.editable ?
          <input
            autoFocus
            ref={ (ele) => ele && ele.select() }
            className={ styles.item_info_input }
            defaultValue={ props.name }
            onClick={ (e) => e.stopPropagation() }
            onBlur={ () => (props.onInputBlur && props.id) && props.onInputBlur(props.id) }
            onKeyDown={ (e) => handleOnKeyDown(e) }
          ></input> :
          <div
            id={ props.id }
            className={ styles.item_info_name }
            title={ props.name }>{ props.name }</div>
      }
      {
        props.editable ?
          <div></div> :
          <div
            className={ clx([getIcon('close'), styles.close_icon]) }
            onClick={ (event) => {
              event.stopPropagation();
              handleClose();
            } }
          ></div>
      }
    </div>
  );
}

export function renderAddItem(props: ItemProps) {
  const handleAdd = debouce(() => props.onClick && props.onClick(), 20);

  return (
    <div
      className={ clx({
        [getIcon('plus')]: true,
        [styles.item_add]: true,
      }) }
      onClick={ () => handleAdd() }
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
