import cls from 'classnames';
import debounce from 'lodash/debounce';
import { observer } from 'mobx-react-lite';
import React, { KeyboardEvent, createElement, useEffect, useRef } from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';
import { AppConfig, TERMINAL_COMMANDS, URI, getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';
import { Loading } from '@opensumi/ide-core-browser/lib/components/loading';
import { IDesignStyleService } from '@opensumi/ide-core-browser/lib/design';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { ItemProps, ItemType } from '../../common';

import styles from './tab.module.less';

export const renderInfoItem = observer((props: ItemProps) => {
  const iconService = useInjectable<IIconService>(IconService);
  const handleSelect = debounce(() => props.onClick && props.onClick(), 20);
  const handleClose = debounce(() => props.onClose && props.onClose(), 20);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const designService = useInjectable<IDesignStyleService>(IDesignStyleService);

  const handleOnKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && props.onInputEnter && props.id) {
      props.onInputEnter(props.id, (e.target as any).value);
    }
  };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (props.selected) {
      ref.current?.scrollIntoView();
    }
  }, [props.selected]);

  let iconClass;

  if (props.options?.icon) {
    if ((props.options.icon as any)?.id) {
      iconClass = iconService.fromString(`$(${(props.options.icon as any)?.id})`);
    } else if (props.options.icon instanceof URI) {
      iconClass = iconService.fromIcon(props.options?.icon.toString());
    } else if ((props.options.icon as any)?.light || (props.options?.icon as any)?.dark) {
      iconClass =
        props.theme === 'light'
          ? iconService.fromIcon((props.options.icon as any).light.toString())
          : iconService.fromIcon((props.options.icon as any).dark.toString());
    }
  }

  return (
    <div
      ref={ref}
      className={cls({
        [designService.wrapStyles(styles.item_container)]: true,
        [designService.wrapStyles(styles.tab_item_selected)]: !!props.selected,
      })}
      style={{ height: appConfig.layoutViewSize!.panelTitleBarHeight }}
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
        <div id={props.id} className={designService.wrapStyles(styles.item_info_name)} title={props.name}>
          {props.name !== '' ? (
            <>
              <Icon
                iconClass={
                  iconClass ? iconClass : getIcon(props.name?.toLowerCase() || 'terminal') || getIcon('terminal')
                }
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
          className={cls([getIcon('close'), designService.wrapStyles(styles.tab_close_icon)])}
          onClick={(event) => {
            event.stopPropagation();
            handleClose();
          }}
        />
      )}
    </div>
  );
});

export const renderAddItem = observer((props: ItemProps) => {
  const handleAdd = debounce(() => props.onClick && props.onClick(), 20);
  const keybinding = props.getKeybinding && props.getKeybinding(TERMINAL_COMMANDS.ADD.id);
  const designService = useInjectable<IDesignStyleService>(IDesignStyleService);

  const createTitle = keybinding ? `${localize('terminal.new')}(${keybinding})` : localize('terminal.new');

  return (
    <div className={designService.wrapStyles(styles.tab_item_wrapper)}>
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
});

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
