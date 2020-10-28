import * as React from 'react';
import * as styles from './debug-configuration.module.less';
import * as cls from 'classnames';
import { useInjectable, localize, isElectronRenderer } from '@ali/ide-core-browser';
import { DebugAction } from '../../components';
import { DebugConfigurationService } from './debug-configuration.service';
import { observer } from 'mobx-react-lite';
import { DebugToolbarView } from './debug-toolbar.view';
import { Select, Option } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';

export const DebugConfigurationView = observer(() => {
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
  } = useInjectable<DebugConfigurationService>(DebugConfigurationService);
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
      const [name, workspaceAndIndex] = value.split('__CONF__');
      const [workspaceFolderUri, index] = workspaceAndIndex.split('__INDEX__');
      updateConfiguration(name, workspaceFolderUri, +index);
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
        [<option value='__NO_CONF__' key={'__NO_CONF__'} label={ localize('debug.action.no.configuration') }>{ localize('debug.action.no.configuration') }</option>] :
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

    return (<Select value={ currentValue } onChange={ setCurrentConfiguration } className={cls(styles.debug_selection, styles.special_radius)}>
      {renderConfigurationOptions(configurationOptions)}
      <Option disabled key={'--'} value={addConfigurationLabel.replace(/./g, '-')}>{ addConfigurationLabel.replace(/./g, '-') }</Option>
      <Option value='__ADD_CONF__' key={'__ADD_CONF__'}>{ addConfigurationLabel }</Option>
    </Select>);
  };

  return <div>
    <div className={ styles.debug_configuration_toolbar }>
      { renderConfigurationSelect() }
      <div className={ styles.kt_debug_actions }>
        <DebugAction id='debug.action.start' color={ '#62D99D' } icon={ 'rundebug' } label={ localize('debug.action.start') } run={ start }></DebugAction>
        <DebugAction id='debug.action.open.configuration' color={ 'var(--foreground)' } icon={ 'setting' } label={ localize('debug.action.open.configuration') } run={ openConfiguration }></DebugAction>
        <DebugAction id='debug.action.debug.console' color={ 'var(--foreground)' } icon={ 'terminal' } label={ localize('debug.action.debug.console') } run={ openDebugConsole }></DebugAction>
      </div>
    </div>
    { !float && <DebugToolbarView float={false} /> }
  </div>;
});
