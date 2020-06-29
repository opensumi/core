import * as React from 'react';
import { IToolbarActionElementProps, IToolbarActionReactElement, IToolbarActionSelectProps } from '../types';
import { Select } from '@ali/ide-components';
import { Emitter } from '@ali/ide-core-common';

export function ToolbarActionSelect<T>(props: IToolbarActionSelectProps<T> & IToolbarActionElementProps) {
  const [viewState, setViewState] = React.useState(props.defaultState || 'default');

  const styles = (props.styles || {})[viewState] || {};

  const selectStyle = {
    color: styles.labelForegroundColor,
    backgroundColor: styles.backgroundColor,
    minWidth: styles.minWidth === undefined ? 110 : styles.minWidth,
  };

  const optionStyle = {
    color: styles.labelForegroundColor,
    backgroundColor: styles.backgroundColor,
  };

  const [value, setValue] = React.useState(props.defaultValue);
  const [options, setCustomOptions] = React.useState<{
    iconClass?: string,
    label?: string,
    value: T,
  }[] | undefined>(undefined);
  const selectEmitter = React.useRef(new Emitter<T>());

  React.useEffect(() => {
    const _onChangeState = new Emitter<{from: string, to: string}>();
    let _value = value;
    const delegate = {
      setState: (to) => {
        const from = viewState;
        setViewState(to);
        _onChangeState.fire({from, to});
      },
      setSelect: setValue,
      setOptions: (options) => {
        setCustomOptions(options);
      },
      getValue: () => {
        return _value;
      },
      onChangeState: _onChangeState.event,
      onSelect: selectEmitter.current.event,
    };
    props.delegate && props.delegate(delegate);
    const disposer = selectEmitter.current.event((v) => {
      _value = v;
    });
    return () => {
      props.delegate && props.delegate(undefined);
      _onChangeState.dispose();
      disposer.dispose();
    };
  }, []);

  return <Select<T> value={value} options={options || props.options} size='small' optionRenderer={props.customOptionRenderer} onChange={(v) => {
    if (props.onSelect) {
      props.onSelect(value!);
    }
    selectEmitter.current.fire(v);
    setValue(v);
  }} optionStyle={optionStyle} style={selectStyle}/>;
}

export function createToolbarActionSelect<T = string>(props: IToolbarActionSelectProps<T>): IToolbarActionReactElement {

  return ( actionProps ) => {
    return <ToolbarActionSelect {...props} {...actionProps} />;
  };
}
