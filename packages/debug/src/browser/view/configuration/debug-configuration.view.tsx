import cls from 'classnames';
import React from 'react';

import { Option, Popover, Select } from '@opensumi/ide-components';
import { AppConfig, URI, localize, useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { Select as NativeSelect } from '@opensumi/ide-core-browser/lib/components/select';

import {
  DEFAULT_ADD_CONFIGURATION_KEY,
  DEFAULT_CONFIGURATION_INDEX_SEPARATOR,
  DEFAULT_CONFIGURATION_NAME_SEPARATOR,
  DEFAULT_DYNAMIC_CONFIGURATION_KEY,
  DEFAULT_EDIT_CONFIGURATION_KEY,
  DEFAULT_NO_CONFIGURATION_KEY,
  DebugSessionOptions,
} from '../../../common';
import { DebugAction } from '../../components';
import { DebugConfigurationType } from '../../debug-configuration-manager';

import styles from './debug-configuration.module.less';
import { DebugConfigurationService } from './debug-configuration.service';
import { DebugToolbarView } from './debug-toolbar.view';

interface ConfigurationSelectorProps {
  currentValue: string;
  options: DebugSessionOptions[];
  dynamicOptions?: DebugConfigurationType[];
  isMultiRootWorkspace: boolean;
  addConfigurationLabel: string;
  editConfigurationLabel: string;
  workspaceRoots: string[];
  isElectronRenderer: boolean;
  toValue: (option: DebugSessionOptions) => string;
  onChangeConfiguration(event: React.ChangeEvent<HTMLSelectElement> | string): void;
}

const ConfigurationSelector = React.memo(
  ({
    currentValue,
    options,
    dynamicOptions,
    onChangeConfiguration,
    isMultiRootWorkspace,
    addConfigurationLabel,
    editConfigurationLabel,
    toValue,
    workspaceRoots,
    isElectronRenderer,
  }: ConfigurationSelectorProps) => {
    const renderConfigurationOptions = React.useCallback(
      (options) => {
        if (options && options.length) {
          return options.map((option, index) => {
            const label = isMultiRootWorkspace
              ? `${option.configuration.name} (${new URI(option.workspaceFolderUri).displayName})`
              : option.configuration.name;
            return isElectronRenderer ? (
              <option key={index} value={toValue(option)} label={label}>
                {label}
              </option>
            ) : (
              <Option key={index} value={toValue(option)} label={label}>
                {label}
              </Option>
            );
          });
        } else {
          return isElectronRenderer
            ? [
                <option
                  value={DEFAULT_NO_CONFIGURATION_KEY}
                  key={DEFAULT_NO_CONFIGURATION_KEY}
                  label={localize('debug.action.no.configuration')}
                >
                  {localize('debug.action.no.configuration')}
                </option>,
              ]
            : [
                <Option
                  value={DEFAULT_NO_CONFIGURATION_KEY}
                  key={DEFAULT_NO_CONFIGURATION_KEY}
                  label={localize('debug.action.no.configuration')}
                >
                  {localize('debug.action.no.configuration')}
                </Option>,
              ];
        }
      },
      [isMultiRootWorkspace],
    );

    const renderAddConfigurationOptions = React.useCallback(() => {
      if (isMultiRootWorkspace) {
        let longName: string = addConfigurationLabel;
        const addonOptions = workspaceRoots.map((root, index) => {
          const label = `${addConfigurationLabel} (${new URI(root).displayName})`;
          if (longName.length < label.length) {
            longName = label;
          }
          return isElectronRenderer ? (
            <option
              value={`${DEFAULT_ADD_CONFIGURATION_KEY}${index}`}
              key={`${DEFAULT_ADD_CONFIGURATION_KEY}${index}`}
              label={label}
            >
              {label}
            </option>
          ) : (
            <Option
              value={`${DEFAULT_ADD_CONFIGURATION_KEY}${index}`}
              key={`${DEFAULT_ADD_CONFIGURATION_KEY}${index}`}
              label={label}
            >
              {label}
            </Option>
          );
        });
        const disabledOption = isElectronRenderer
          ? [
              <option disabled key={'--'} value={longName!.replace(/./g, '-')}>
                {longName!.replace(/./g, '-')}
              </option>,
            ]
          : [<Option disabled key={'--'} value={''} className={styles.select_divider_container}></Option>];
        return disabledOption.concat(addonOptions);
      } else {
        const label = addConfigurationLabel;
        return isElectronRenderer
          ? [
              <option disabled key={'--'} value={label!.replace(/./g, '-')}>
                {label!.replace(/./g, '-')}
              </option>,
              <option value={DEFAULT_ADD_CONFIGURATION_KEY} key={DEFAULT_ADD_CONFIGURATION_KEY} label={label}>
                {label}
              </option>,
              <option
                value={DEFAULT_EDIT_CONFIGURATION_KEY}
                key={DEFAULT_EDIT_CONFIGURATION_KEY}
                label={editConfigurationLabel}
              >
                {editConfigurationLabel}
              </option>,
            ]
          : [
              <Option
                disabled
                key={'--'}
                value={label!.replace(/./g, '-')}
                className={styles.select_divider_container}
              ></Option>,
              <Option value={DEFAULT_ADD_CONFIGURATION_KEY} key={DEFAULT_ADD_CONFIGURATION_KEY} label={label}>
                {label}
              </Option>,
              <Option
                value={DEFAULT_EDIT_CONFIGURATION_KEY}
                key={DEFAULT_EDIT_CONFIGURATION_KEY}
                label={editConfigurationLabel}
              >
                {editConfigurationLabel}
              </Option>,
            ];
      }
    }, [isMultiRootWorkspace, addConfigurationLabel]);

    const renderDynamicOptions = React.useCallback(
      (options: DebugConfigurationType[]) => {
        // 暂不支持多 Workspace
        if (isMultiRootWorkspace) {
          return;
        }

        if (options && options.length) {
          const dynamicList = options.map((option) => {
            const label = option.label || option.type;
            const value = `${DEFAULT_DYNAMIC_CONFIGURATION_KEY}${option.type}`;
            const { popupHint } = option;
            return isElectronRenderer ? (
              <option key={value} value={value} label={label}>
                {label}
              </option>
            ) : (
              <Option key={value} value={value} label={label}>
                {popupHint ? (
                  <Popover
                    id={`debug_configuration_pop_${value}`}
                    title={popupHint}
                    overlayClassName={styles.config_popover_insert}
                  >
                    {label}
                  </Popover>
                ) : (
                  label
                )}
              </Option>
            );
          });
          // 此处可以使用 dynamicList.unshift 插入额外的提示文本
          return dynamicList;
        }
      },
      [isMultiRootWorkspace, dynamicOptions],
    );

    if (isElectronRenderer) {
      return (
        <NativeSelect
          value={currentValue}
          onChange={onChangeConfiguration}
          className={cls(styles.debug_selection, styles.special_radius)}
        >
          {renderConfigurationOptions(options)}
          {renderAddConfigurationOptions()}
          {dynamicOptions && renderDynamicOptions(dynamicOptions)}
        </NativeSelect>
      );
    }

    return (
      <Select
        value={currentValue}
        onChange={onChangeConfiguration}
        className={cls(styles.debug_selection, styles.special_radius)}
        allowOptionsOverflow
      >
        {renderConfigurationOptions(options)}
        {renderAddConfigurationOptions()}
        {dynamicOptions && renderDynamicOptions(dynamicOptions)}
      </Select>
    );
  },
);

interface DebugActionBarProps {
  runDebug(): void;
  openConfiguration(): void;
  openDebugConsole(): void;
}

export const DebugActionBar = React.memo(({ runDebug, openConfiguration, openDebugConsole }: DebugActionBarProps) => (
  <div className={styles.debug_actions}>
    <DebugAction
      id='debug.action.start'
      icon={'start'}
      label={localize('debug.action.start')}
      run={runDebug}
    ></DebugAction>
    <DebugAction
      id='debug.action.open.configuration'
      icon={'setting'}
      label={localize('debug.action.open.configuration')}
      run={openConfiguration}
    ></DebugAction>
    <DebugAction
      id='debug.action.debug.console'
      icon={'terminal'}
      label={localize('debug.action.debug.console')}
      run={openDebugConsole}
    ></DebugAction>
  </div>
));

export const DebugConfigurationContainerView = () => {
  const debugConfigurationService = useInjectable<DebugConfigurationService>(DebugConfigurationService);
  const float = useAutorun(debugConfigurationService.float);

  return (
    <>
      <DebugControllerView className={styles.debug_configuration_container} />
      {!float && <DebugToolbarView float={false} className={styles.debug_action_bar_internal} />}
    </>
  );
};

export interface DebugControllerViewProps {
  className?: string;
  CustomActionBar?: React.ComponentType;
}

/**
 * 该组件支持用户导入
 * 后续如果有一些改动需要考虑是否有 breakchange
 */
export const DebugControllerView = (props: DebugControllerViewProps) => {
  const {
    toValue,
    openConfiguration,
    addConfiguration,
    openDebugConsole,
    updateConfiguration,
    start,
    showDynamicQuickPick,
    currentValue,
    configurationOptions,
    dynamicConfigurations,
    isMultiRootWorkspace,
    workspaceRoots,
  } = useInjectable<DebugConfigurationService>(DebugConfigurationService);
  const autorunDynamicConfigurations = useAutorun(dynamicConfigurations);
  const autorunCurrentValue = useAutorun(currentValue);
  const autorunConfigurationOptions = useAutorun(configurationOptions);
  const autorunIsMultiRootWorkspace = useAutorun(isMultiRootWorkspace);
  const autorunWorkspaceRoots = useAutorun(workspaceRoots);

  const appConfig = useInjectable<AppConfig>(AppConfig);
  const addConfigurationLabel = localize('debug.action.add.configuration');
  const editConfigurationLabel = localize('debug.action.edit.configuration');
  const { CustomActionBar } = props;

  const setCurrentConfiguration = React.useCallback((event: React.ChangeEvent<HTMLSelectElement> | string) => {
    let value: React.ChangeEvent<HTMLSelectElement> | string;
    if (typeof event === 'object') {
      value = event.target.value;
    } else {
      value = event;
    }
    if (value.startsWith(DEFAULT_ADD_CONFIGURATION_KEY)) {
      const index = value.slice(DEFAULT_ADD_CONFIGURATION_KEY.length);
      if (index) {
        addConfiguration(workspaceRoots[index]);
      } else {
        addConfiguration(workspaceRoots[0]);
      }
    } else if (value === DEFAULT_EDIT_CONFIGURATION_KEY) {
      openConfiguration();
    } else if (value.startsWith(DEFAULT_DYNAMIC_CONFIGURATION_KEY)) {
      const type = value.slice(DEFAULT_DYNAMIC_CONFIGURATION_KEY.length);
      showDynamicQuickPick(type);
    } else {
      const [name, workspaceAndIndex] = value.split(DEFAULT_CONFIGURATION_NAME_SEPARATOR);
      const [workspaceFolderUri, index] = workspaceAndIndex.split(DEFAULT_CONFIGURATION_INDEX_SEPARATOR);
      updateConfiguration(name, workspaceFolderUri, +index);
    }
  }, []);

  return (
    <div className={cls(styles.debug_configuration_toolbar, props.className || '')}>
      <ConfigurationSelector
        currentValue={autorunCurrentValue}
        options={autorunConfigurationOptions}
        dynamicOptions={autorunDynamicConfigurations}
        workspaceRoots={autorunWorkspaceRoots}
        isMultiRootWorkspace={autorunIsMultiRootWorkspace}
        onChangeConfiguration={setCurrentConfiguration}
        addConfigurationLabel={addConfigurationLabel}
        editConfigurationLabel={editConfigurationLabel}
        toValue={toValue}
        isElectronRenderer={appConfig.isElectronRenderer}
      />
      {CustomActionBar ? (
        <CustomActionBar />
      ) : (
        <DebugActionBar runDebug={start} openConfiguration={openConfiguration} openDebugConsole={openDebugConsole} />
      )}
    </div>
  );
};
