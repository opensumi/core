import * as React from 'react';
import * as styles from './debug-configuration.module.less';
import * as cls from 'classnames';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { DebugAction } from '../components/debug-action';
import { DebugConfigurationService } from './debug-configuration.service';
import { observer } from 'mobx-react-lite';
import { DebubgToolbarView } from './debug-toolbar.view';
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
  }: DebugConfigurationService = useInjectable(DebugConfigurationService);
  const addConfigurationLabel = localize('debug.action.add.configuration');

  const setCurrentConfiguration = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value;
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
        return <option key={index} value={toValue(option)}>{toName(option)}</option>;
      });
    } else {
      return <option value='__NO_CONF__'>{localize('debug.action.no.configuration')}</option>;
    }
  };

  return <div>
    <div className={styles.debug_configuration_toolbar}>
      <DebugAction color={'#62D99D'} icon={'start'} label={localize('debug.action.start')} run={ start }></DebugAction>
      <div className={cls(styles.debug_selection)}>
        <select value={ currentValue } onChange={ setCurrentConfiguration }>
          { renderConfigurationOptions(configurationOptions) }
          <option disabled>{ addConfigurationLabel.replace(/./g, '-') }</option>
          <option value='__ADD_CONF__'>{ addConfigurationLabel }</option>
        </select>
      </div>
      <DebugAction icon={'setting'} label={localize('debug.action.open.configuration')} run={openConfiguration}></DebugAction>
      <DebugAction icon={'codelibrary-fill'} label={localize('debug.action.deubg.console')} run={openDebugConsole}></DebugAction>
    </div>
    <DebubgToolbarView></DebubgToolbarView>
  </div>;
});
