import classnames from 'classnames';
import React from 'react';

import { DropdownButton, DropDownProps } from '@opensumi/ide-components';
import { Menu } from '@opensumi/ide-components/lib/menu';
import { Emitter } from '@opensumi/ide-core-common';

import { IToolbarActionElementProps, IToolbarActionReactElement, IToolbarActionDropdownButtonProps } from '../types';

import style from './dropdown-button.module.less';

export function ToolbarActionDropdownButton<T>(
  props: IToolbarActionDropdownButtonProps<T> & IToolbarActionElementProps,
) {
  const selectEmitter = React.useRef(new Emitter<T>());
  const [firstOption, ...otherOptions] = props.options;
  React.useEffect(() => {
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

  const trigger = React.useMemo(() => props.trigger ?? (['click'] as DropDownProps['trigger']), [props.trigger]);

  const handleClick = React.useCallback((value) => {
    selectEmitter.current.fire(value);
  }, []);

  const menu = React.useMemo(() => (
      <Menu
        className={classnames('kt-menu', style.menu)}
        selectable={false}
        motion={{ motionLeave: false, motionEnter: false }}
      >
        {otherOptions.map((option) => (
          <Menu.Item key={option.label} onClick={() => handleClick(option.value)}>
            {option.label}
          </Menu.Item>
        ))}
      </Menu>
    ), []);

  return (
    <DropdownButton size='small' onClick={() => handleClick(firstOption.value)} overlay={menu} trigger={trigger}>
      {firstOption.label}
    </DropdownButton>
  );
}

export function createToolbarActionDropdownButton<T = string>(
  props: IToolbarActionDropdownButtonProps<T>,
): IToolbarActionReactElement {
  return (actionProps) => <ToolbarActionDropdownButton {...props} {...actionProps} />;
}
