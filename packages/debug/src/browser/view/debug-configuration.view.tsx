import * as React from 'react';
import * as styles from './debug-configuration.module.less';
import * as cls from 'classnames';
import { useInjectable, localize, PreferenceService, isElectronRenderer } from '@ali/ide-core-browser';
import { DebugAction } from '../components/debug-action';
import { DebugConfigurationService } from './debug-configuration.service';
import { observer } from 'mobx-react-lite';
import { DebugToolbarView, FloatDebugToolbarView } from './debug-toolbar.view';
import { Select, Option } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';

const style: React.CSSProperties = {
  width: '100%',
  margin: '8px 0px',
};

export const DebubgConfigurationView = observer(() => {
  const {
    configurationOptions,
    toValue,
    toName,
    currentValue,
    openConfiguration,
    addConfiguration,
    openDebugConsole,
    updateConfiguration,
    start,
    float,
  }: DebugConfigurationService = useInjectable(DebugConfigurationService);
  const addConfigurationLabel = localize('debug.action.add.configuration');

  const setCurrentConfiguration = (event: React.ChangeEvent<HTMLSelectElement> | string) => {
    let value: React.ChangeEvent<HTMLSelectElement> | string;
    if (typeof event === 'object') {
      value = event.target.value;
    } else {
      value = event;
    }

    if (value === '__ADD_CONF__') {
      addConfiguration();
    } else {
      const [name, workspaceFolderUri] = value.split('__CONF__');
      updateConfiguration(name, workspaceFolderUri);
    }
  };

  const renderConfigurationOptions = (options) => {
    if (options.length) {
      return options.map((option, index) => {
        return isElectronRenderer() ?
          <option key={ index } value={ toValue(option) } label={ option.configuration.name }>{ toName(option) }</option> :
          <Option key={ index } value={ toValue(option) } label={ option.configuration.name }>{ toName(option) }</Option>;
      });
    } else {
      return isElectronRenderer() ?
        [<option value='__NO_CONF__' label={ localize('debug.action.no.configuration') }>{ localize('debug.action.no.configuration') }</option>] :
        [<Option value='__NO_CONF__' key={'__NO_CONF__'} label={ localize('debug.action.no.configuration') }>{ localize('debug.action.no.configuration') }</Option>];
    }
  };

  const renderConfigurationSelect = () => {
    if (isElectronRenderer()) {
      return (<NativeSelect value={ currentValue } onChange={ setCurrentConfiguration } className={cls(styles.debug_selection, styles.special_radius)}>
        {renderConfigurationOptions(configurationOptions)}
        <option disabled key={'--'} value={addConfigurationLabel.replace(/./g, '-')}>{ addConfigurationLabel.replace(/./g, '-') }</option>
        <option value='__ADD_CONF__' key={'__ADD_CONF__'}>{ addConfigurationLabel }</option>
      </NativeSelect>);
    }

    return (<Select size='small' value={ currentValue } onChange={ setCurrentConfiguration } className={cls(styles.debug_selection, styles.special_radius)}>
      {renderConfigurationOptions(configurationOptions)}
      <Option disabled key={'--'} value={addConfigurationLabel.replace(/./g, '-')}>{ addConfigurationLabel.replace(/./g, '-') }</Option>
      <Option value='__ADD_CONF__' key={'__ADD_CONF__'}>{ addConfigurationLabel }</Option>
    </Select>);
  };

  return <div>
    <div className={ styles.debug_configuration_toolbar }>
      { renderConfigurationSelect() }
      <div className={ styles.kt_debug_actions }>
        <DebugAction color={ '#62D99D' } icon={ 'run-debug' } label={ localize('debug.action.start') } run={ start }></DebugAction>
        <DebugAction color={ 'var(--foreground)' } icon={ 'setting' } label={ localize('debug.action.open.configuration') } run={ openConfiguration }></DebugAction>
        <DebugAction color={ 'var(--foreground)' } icon={ 'terminal' } label={ localize('debug.action.debug.console') } run={ openDebugConsole }></DebugAction>
      </div>
    </div>
    { float ? <FloatDebugToolbarView /> : <DebugToolbarView float={ false } /> }
  </div>;
});
