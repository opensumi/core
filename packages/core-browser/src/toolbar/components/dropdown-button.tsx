import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { DropDownProps, DropdownButton } from '@opensumi/ide-components';
import { Menu } from '@opensumi/ide-components/lib/menu';
import { Emitter } from '@opensumi/ide-core-common';

import { IToolbarActionDropdownButtonProps, IToolbarActionElementProps, IToolbarActionReactElement } from '../types';

import style from './dropdown-button.module.less';

export const ToolbarActionDropdownButton = <T,>(
  props: IToolbarActionDropdownButtonProps<T> & IToolbarActionElementProps,
) => {
  const selectEmitter = useRef(new Emitter<T>());
  const [firstOption, ...otherOptions] = props.options;
  useEffect(() => {
    const _onChangeState = new Emitter<{ from: string; to: string }>();
    const delegate = {
      onSelect: selectEmitter.current.event,
    };
    props.delegate && props.delegate(delegate);
    return () => {
      props.delegate && props.delegate(undefined);
      _onChangeState.dispose();
    };
  }, []);

  const trigger = useMemo(() => props.trigger ?? (['click'] as DropDownProps['trigger']), [props.trigger]);

  const handleClick = useCallback((value) => {
    selectEmitter.current.fire(value);
  }, []);

  const menu = useMemo(
    () => (
      <Menu
        className={cls('kt-menu', style.menu)}
        selectable={false}
        motion={{ motionLeave: false, motionEnter: false }}
      >
        {otherOptions.map((option) => (
          <Menu.Item key={option.label} onClick={() => handleClick(option.value)}>
            {option.label}
          </Menu.Item>
        ))}
      </Menu>
    ),
    [],
  );

  return (
    <DropdownButton size='small' onClick={() => handleClick(firstOption.value)} overlay={menu} trigger={trigger}>
      {firstOption.label}
    </DropdownButton>
  );
};

export function createToolbarActionDropdownButton<T = string>(
  props: IToolbarActionDropdownButtonProps<T>,
): IToolbarActionReactElement {
  return (actionProps) => <ToolbarActionDropdownButton {...props} {...actionProps} />;
}
