import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { replaceLocalizePlaceholder, useInjectable, PreferenceSchemaProvider, PreferenceDataProperty, URI, CommandService, localize, PreferenceScope, EDITOR_COMMANDS, formatLocalize, ILogger, AppConfig, PreferenceService, isElectronRenderer } from '@ali/ide-core-browser';
import { PreferenceSettingsService } from './preference.service';
import './index.less';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ISettingGroup, IPreferenceSettingsService, ISettingSection } from '@ali/ide-core-browser';
import throttle = require('lodash.throttle');
import debounce = require('lodash.debounce');
import * as cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser';
import { CheckBox, Input, Button, ComponentContextProvider } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';
import { Select, Option, Tabs } from '@ali/ide-components';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';

import { toPreferenceReadableName, toNormalCase } from '../common';
import { NextPreferenceItem } from './preferenceItem.view';

const WorkspaceScope = {
  id: PreferenceScope.Workspace ,
  label: 'preference.tab.workspace',
};

const UserScope = {
  id: PreferenceScope.User ,
  label: 'preference.tab.user',
};

export const PreferenceView: ReactEditorComponent<null> = observer((props) => {

  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const preferences: PreferenceService = useInjectable(PreferenceService);
  const appConfig: AppConfig = useInjectable(AppConfig);

  const userBeforeWorkspace = preferences.get<boolean>('settings.userBeforeWorkspace');
  const tabList = userBeforeWorkspace
    ? [ UserScope, WorkspaceScope ]
    : [ WorkspaceScope, UserScope ];

  const [ tabIndex, setTabIndex ] = React.useState<number>(0);
  const currentScope = React.useMemo<PreferenceScope>(() => {
    return (tabList[tabIndex] || tabList[0]).id;
  }, [ tabList, tabIndex ]);

  const [currentSearch, setCurrentSearch] = React.useState('');

  const groups = preferenceService.getSettingGroups(currentScope, currentSearch);

  if (groups.length > 0 && groups.findIndex( (g) => g.id === preferenceService.currentGroup) === -1) {
    preferenceService.setCurrentGroup(groups[0].id);
  }

  const debouncedSearch = debounce((value) => {
    setCurrentSearch(value);
  }, 100, {maxWait: 1000});

  const headers = (
    <Tabs
      className={styles.tabs}
      value={tabIndex}
      onChange={(index: number) => setTabIndex(index)}
      tabs={tabList.map((n) => localize(n.label))} />
  );

  React.useEffect(() => {
    return () => {
      preferenceService.onSearchInputRendered(null);
    };
  }, []);

  return (
    <ComponentContextProvider value={{ getIcon, localize }}>
      <div className = {styles.preferences}>
        <div className = {styles.preferences_header}>
          {appConfig.isSyncPreference ? <div /> : headers}
          <div className = {styles.search_pref}>
            <Input
              placeholder={localize('preference.searchPlaceholder')}
              onValueChange={debouncedSearch}
              ref={(el) => el && preferenceService.onSearchInputRendered(el)}
            />
          </div>
        </div>
        { groups.length > 0 ?
        <div className = {styles.preferences_body}>
          <PreferencesIndexes groups={groups} scope={currentScope} search={currentSearch}></PreferencesIndexes>
          <div className = {styles.preferences_items}>
            <PreferenceBody groupId={preferenceService.currentGroup} scope={currentScope} search={currentSearch}></PreferenceBody>
          </div>
        </div> :
          <div className = {styles.preference_noResults}>
            {formatLocalize('preference.noResults', currentSearch)}
          </div>
        }
      </div>
    </ComponentContextProvider>
  );
});

export const PreferenceSections = (({preferenceSections, navigateTo}: {preferenceSections: ISettingSection[], navigateTo: (section: ISettingSection) => void}) => {

  return <div className={styles.preference_section_link}>{
    preferenceSections.filter((s) => s.title).map((section, idx) => {
      return <div key={`${section.title}-${idx}`}
        onClick={() => navigateTo(section)}
      >{section.title!}</div>;
    })
  }</div>;
});

export const PreferencesIndexes = ({groups, scope, search}: {groups: ISettingGroup[], scope: PreferenceScope, search: string}) => {
  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  return <div className = {styles.preferences_indexes}>
    <Scroll>
      {
        groups && groups.map(({id, title, iconClass}) => {

          const sections = preferenceService.getSections(id, scope, search);

          return (<div key={`${id} - ${title}`} className={styles.index_item_wrapper}>
            <div key={`${id} - ${title}`} className={classnames({
              [styles.index_item]: true,
              [styles.activated]: preferenceService.currentGroup === id,
            })} onClick={() => {preferenceService.setCurrentGroup(id); }}>
            <span className={iconClass}></span>
              {toNormalCase(replaceLocalizePlaceholder(title) || '')}
            </div>
            {
              preferenceService.currentGroup === id ?
              <div>
                <PreferenceSections preferenceSections={sections} navigateTo={(section) => {
                  const target = document.getElementById('preferenceSection-' + section.title);
                  if (target) {
                    target.scrollIntoView();
                  }
                }}></PreferenceSections>
              </div>
              : <div></div>
            }
          </div>);
        })
      }
    </Scroll>
  </div>;
};

export const PreferenceBody = ({groupId, scope, search}: {groupId: string, scope: PreferenceScope, search: string}) => {
  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  return <Scroll>
    {preferenceService.getSections(groupId, scope, search).map((section, idx) => {
      return <PreferenceSection key={`${section} - ${idx}`} section={section} scope={scope} />;
    }) || <div></div>}
  </Scroll>;
};

export const PreferenceSection = ({section, scope}: {section: ISettingSection, scope: PreferenceScope}) => {
  return <div className={styles.preference_section} id={'preferenceSection-' + section.title}>
    {
      section.title ? <div className={styles.section_title}>{section.title!}</div> : null
    }
    {
      section.component ? <section.component scope={scope}/> :
      section.preferences.map((preference, idx) => {
        if (typeof preference === 'string') {
          return <NextPreferenceItem key={`${idx} - ${preference} - ${scope}`} preferenceName={preference} scope={scope} />;
        } else {
          return <NextPreferenceItem key={`${idx} - ${preference.id} - ${scope}`} preferenceName={preference.id} localizedName={localize(preference.localized)} scope={scope} />;
        }
      }) || <div></div>
    }
  </div>;
};

export const PreferenceItemView = ({preferenceName, localizedName, scope}: {preferenceName: string, localizedName?: string, scope: PreferenceScope}) => {
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const logger = useInjectable<ILogger>(ILogger);

  const preferenceService = useInjectable<PreferenceSettingsService>(IPreferenceSettingsService);
  const defaultPreferenceProvider = useInjectable<PreferenceSchemaProvider>(PreferenceSchemaProvider);

  const commandService = useInjectable<CommandService>(CommandService);
  const fileServiceClient = useInjectable<IFileServiceClient>(IFileServiceClient);

  const key = preferenceName;
  const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  if (!localizedName) {
    localizedName = toPreferenceReadableName(preferenceName);
  }

  const { value: v, effectingScope } = preferenceService.getPreference(preferenceName, scope);
  const [value, setValue] = React.useState(v);

  const changeValue = (key, value) => {
    doChangeValue(value);
    setValue(value);
  };

  React.useEffect(() => {
    setValue(preferenceService.getPreference(preferenceName, scope).value);
  }, [scope, preferenceName]);

  const doChangeValue = throttle((value) => {
    if (appConfig.isSyncPreference) {
      preferenceService.setPreference(key, value, PreferenceScope.Workspace).then(() => {
        forceUpdate();
      });
      preferenceService.setPreference(key, value, PreferenceScope.User).then(() => {
        forceUpdate();
      });
    } else {
      preferenceService.setPreference(key, value, scope).then(() => {
        forceUpdate();
      });
    }
  }, 500, {trailing: true});

  const status = <span className={styles.preference_status}>
    {
      effectingScope > scope ? <span className={styles.preference_overwritten}>{localize('preference.overwritten')}</span> :  undefined
    }
    {
      effectingScope === scope ? <span className={classnames(styles.preference_reset, getIcon('rollback'))} onClick={(e) => {
        setValue(prop!.default);
        preferenceService.reset(key, scope).then(() => {
          forceUpdate();
        });
      }}></span> : undefined
    }
  </span>;

  const renderPreferenceItem = () => {
    if (prop) {
      switch (prop.type) {
        case 'boolean':
          return renderBooleanValue();
        case 'integer':
        case 'number':
          return renderNumberValue();
        case 'string':
          if (prop.enum) {
            return renderEnumsValue();
          } else {
            return renderTextValue();
          }
        case 'array':
          if (prop.items && prop.items.type === 'string') {
            return renderArrayValue();
          } else {
            return renderOtherValue();
          }
        default:
          return renderOtherValue();
      }
    }
    return <div></div>;
  };

  const renderBooleanValue = () => {

    const description = prop && prop.description && replaceLocalizePlaceholder(prop.description);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={classnames(styles.check, styles.key) }>
        <CheckBox label={localizedName} checked={value} onChange={(event) => {
          changeValue(key, (event.target as HTMLInputElement).checked);
        }}/>
          {status}
        </div>
        {
          description ?
          <div>
            <div className={styles.desc}>{description}</div>
          </div> : undefined
        }
      </div>
    );
  };

  const renderNumberValue = () => {

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName} {status}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <Input
            type='number'
            className={styles.number_control}
            onChange={(event) => {
              const result = parseInt(event.target.value, 10);
              if (Number.isSafeInteger(result)) {
                changeValue(key, result);
              } else if (event.target.value === '') {
                changeValue(key, '');
              }
            }}
            value={value}
            onWheel={(e) => e.preventDefault()}
          />
        </div>
      </div>
    );
  };

  const renderTextValue = () => {
    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName} {status}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <Input
            type='text'
            className={styles.text_control}
            onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            value={value || ''}
          />
        </div>
      </div>
    );
  };

  const renderEnumsValue = () => {
    if (!prop) {
      return <div></div>;
    }

    const optionEnum = (prop as PreferenceDataProperty).enum;

    if (!Array.isArray(optionEnum) || !optionEnum.length) {
      return <div></div>;
    }

    // enum 本身为 string[] | number[]
    const labels = preferenceService.getEnumLabels(preferenceName);
    const options = optionEnum && optionEnum.map((item, idx) =>
      isElectronRenderer() ?
      <option value={item} key={`${idx} - ${item}`}>{
        replaceLocalizePlaceholder((labels[item] || item).toString())
      }</option> :
      <Option value={item} label={replaceLocalizePlaceholder((labels[item] || item).toString())} key={`${idx} - ${item}`}>{
        replaceLocalizePlaceholder((labels[item] || item).toString())
      }</Option>);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName} {status}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          {isElectronRenderer() ?
          <NativeSelect onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            className={styles.select_control}
            value={value}
          >
            {options}
          </NativeSelect> :
          <Select maxHeight='300' onChange={(value) => {
            changeValue(key, value);
          }} value={value} className={styles.select_control}>
            {options}
          </Select>}
        </div>
      </div>
    );
  };

  const renderArrayValue = () => {
    let editEl;
    const addItem = () => {
      if (editEl.value) {
        const newValue = value.slice(0);
        const rawValue = editEl.value;
        // FIXME: 这里的Input状态管理存在问题，后续修复，目前先解决样式问题
        editEl.value = '';
        if (newValue.indexOf(rawValue) > -1) {
          return;
        }
        newValue.push(rawValue);
        changeValue(key, newValue);
      }
    };
    const removeItem = (idx) => {
      const newValue = value.slice(0);
      newValue.splice(idx, 1);
      if (newValue.length) {
        changeValue(key, newValue);
      } else {
        changeValue(key, []);
      }
    };

    const items: any[] = [];
    (value || []).map((item, idx) => {
      items.push(
      <li className={styles.arr_items} key={`${idx} - ${JSON.stringify(item)}`}>
        <div onClick={() => { removeItem(idx); }} className={cls(getIcon('delete'), styles.rm_icon, styles.arr_item)}></div>
        <div className={styles.arr_item}>{typeof item === 'string' ? item : JSON.stringify(item)}</div>
      </li>);
    });

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName} {status}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <ul className={styles.arr_list}>
            {items}
          </ul>
          <div className={styles.preferences_flex_row}>
            <Input
              type='text'
              className={styles.text_control}
              ref={(el) => { editEl = el; }}
            />
            <Button className={styles.add_button} onClick={addItem}>{localize('preference.array.additem', '添加')}</Button>
          </div>
        </div>
      </div>
    );
  };

  const renderOtherValue = () => {

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName} {status}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <a onClick={editSettingsJson}>{localize('preference.editSettingsJson')}</a>
        </div>
      </div>
    );
  };
  const editSettingsJson = async () => {
    const openUri = await preferenceService.getPreferenceUrl(scope);
    if (!openUri) {
      return;
    }
    const exist = await fileServiceClient.access(openUri);
    if (!exist) {
      try {
        await fileServiceClient.createFile(openUri, {content: '', overwrite: false});
      } catch (e) {
        logger.error('create settings.json failed!', e);
      }
    }
    commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(openUri));
  };

  return <div className={classnames({
    [styles.preference_item]: true,
    [styles.modified]: effectingScope === scope,
  })}>
    {renderPreferenceItem()}

  </div>;

};
