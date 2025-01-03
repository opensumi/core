import cls from 'classnames';
import debounce from 'lodash/debounce';
import React, { KeyboardEvent, createElement, useCallback, useEffect, useRef } from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';
import {
  TERMINAL_COMMANDS,
  URI,
  getIcon,
  localize,
  useAutorun,
  useDesignStyles,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { Loading } from '@opensumi/ide-core-browser/lib/components/loading';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { ItemProps, ItemType } from '../../common';

import styles from './tab.module.less';

export const renderInfoItem = (props: ItemProps) => {
  const iconService = useInjectable<IIconService>(IconService);
  const handleSelect = debounce(() => props.onClick && props.onClick(), 20);
  const handleClose = debounce(() => props.onClose && props.onClose(), 20);
  const styles_item_container = useDesignStyles(styles.item_container, 'item_container');
  const styles_tab_item_selected = useDesignStyles(styles.tab_item_selected, 'tab_item_selected');
  const styles_item_info_name = useDesignStyles(styles.item_info_name, 'item_info_name');
  const styles_tab_close_icon = useDesignStyles(styles.tab_close_icon, 'tab_close_icon');
  const layoutViewSize = useInjectable<LayoutViewSizeConfig>(LayoutViewSizeConfig);
  const ref = useRef<HTMLDivElement>(null);

  const { group } = props;
  if (!group) {
    return null;
  }

  const { options, id } = group;

  const editable = useAutorun(group.editable);
  const name = useAutorun(group.snapshot);

  const handleOnKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && props.onInputEnter && id) {
        props.onInputEnter(id, (e.target as any).value);
      }
    },
    [id, props.onInputEnter],
  );

  useEffect(() => {
    if (props.selected) {
      ref.current?.scrollIntoView();
    }
  }, [ref, props.selected]);

  let iconClass;

  if (options?.icon) {
    if ((options.icon as any)?.id) {
      iconClass = iconService.fromString(`$(${(options.icon as any)?.id})`);
    } else if (options.icon instanceof URI) {
      iconClass = iconService.fromIcon(options?.icon.toString());
    } else if ((options.icon as any)?.light || (options?.icon as any)?.dark) {
      iconClass =
        props.theme === 'light'
          ? iconService.fromIcon((options.icon as any).light.toString())
          : iconService.fromIcon((options.icon as any).dark.toString());
    }
  }

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      props.onDragStart?.(e);
    },
    [props.onDragStart],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (ref.current) {
        ref.current.classList.add('on-drag-over');
      }
    },
    [ref],
  );

  const handleDragLeave = useCallback(() => {
    if (ref.current) {
      ref.current.classList.remove('on-drag-over');
    }
  }, [ref]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (ref.current) {
        ref.current.classList.remove('on-drag-over');
      }
      props.onDrop?.(e);
    },
    [ref, props.onDrop],
  );

  return (
    <div
      draggable={props.draggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={ref}
      className={cls({
        [styles_item_container]: true,
        [styles_tab_item_selected]: !!props.selected,
      })}
      style={{ height: layoutViewSize.panelTitleBarHeight }}
      onClick={() => handleSelect()}
      onContextMenu={(event) => props.onContextMenu && props.onContextMenu(event)}
    >
      {editable ? (
        <input
          autoFocus
          ref={(ele) => ele && ele.select()}
          className={styles.item_info_input}
          defaultValue={name}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => props.onInputBlur && group.id && props.onInputBlur(group.id)}
          onKeyDown={(e) => handleOnKeyDown(e)}
        ></input>
      ) : (
        <div id={group.id} className={styles_item_info_name} title={name}>
          {name !== '' ? (
            <>
              <Icon
                iconClass={iconClass ? iconClass : getIcon(name?.toLowerCase() || 'terminal') || getIcon('terminal')}
                style={{ marginRight: 4, color: 'inherit', fontSize: 14 }}
              />
              <span className={styles.item_title}>{name}</span>
            </>
          ) : (
            <Loading />
          )}
        </div>
      )}
      {editable ? (
        <div></div>
      ) : (
        <div
          className={cls([getIcon('close'), styles_tab_close_icon])}
          onClick={(event) => {
            event.stopPropagation();
            handleClose();
          }}
        />
      )}
    </div>
  );
};

export const renderAddItem = (props: ItemProps) => {
  const handleAdd = debounce(() => props.onClick && props.onClick(), 20);
  const keybinding = props.getKeybinding && props.getKeybinding(TERMINAL_COMMANDS.ADD.id);
  const createTitle = keybinding ? `${localize('terminal.new')}(${keybinding})` : localize('terminal.new');
  const style_tab_item_wrapper = useDesignStyles(styles.tab_item_wrapper, 'tab_item_wrapper');

  return (
    <div className={style_tab_item_wrapper}>
      <div
        title={createTitle}
        className={cls({
          [getIcon('plus')]: true,
          [styles.item_add]: true,
        })}
        onClick={() => handleAdd()}
      />
      <div
        title={localize('terminal.new.type')}
        className={cls({
          [getIcon('down')]: true,
          [styles.item_more]: true,
        })}
        onClick={props.onDropdown}
      />
    </div>
  );
};

export default (props: ItemProps) => {
  const type = props.type || ItemType.info;
  switch (type) {
    case ItemType.info:
      return createElement(props.provider.infoItemRender, props);
    case ItemType.add:
      return createElement(props.provider.addItemRender, props);
    default:
      return null;
  }
};
