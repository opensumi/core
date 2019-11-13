import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { replaceLocalizePlaceholder, useInjectable, PreferenceSchemaProvider, PreferenceDataProperty, URI, CommandService, localize, PreferenceSchemaProperty, PreferenceScope, EDITOR_COMMANDS, IFileServiceClient, formatLocalize } from '@ali/ide-core-browser';
import { PreferenceSettingsService } from './preference.service';
import './index.less';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ISettingGroup, IPreferenceSettingsService, ISettingSection } from '@ali/ide-core-browser';
import throttle = require('lodash.throttle');
import debounce = require('lodash.debounce');
import { IWorkspaceService } from '@ali/ide-workspace';
import * as cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { Input, CheckBox } from '@ali/ide-core-browser/lib/components';
import { Select } from '@ali/ide-core-browser/lib/components/select';
import { toPreferenceReadableName, toNormalCase } from '../common';

export const PreferenceView: ReactEditorComponent<null> = observer((props) => {

  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  const [currentScope, setCurrentScope] = React.useState(PreferenceScope.User);
  const [currentSearch, setCurrentSearch] = React.useState('');

  const groups = preferenceService.getSettingGroups(currentScope, currentSearch);

  const [currentGroup, setCurrentGroup] = React.useState(groups[0] ? groups[0].id : '');

  if (groups.length > 0 && groups.findIndex( (g) => g.id === currentGroup) === -1) {
    setCurrentGroup(groups[0].id);
  }

  const debouncedSearch = debounce((value) => {
    setCurrentSearch(value);
  }, 100, {maxWait: 1000});

  return (
    <div className = {styles.preferences}>
      <div className = {styles.preferences_header}>
        <div className = {styles.preferences_scopes}>
          <div className = {classnames({[styles.activated]: currentScope === PreferenceScope.User })} onClick={() => setCurrentScope(PreferenceScope.User )}>{localize('preference.tab.user', '全局设置')}</div>
          <div className = {classnames({[styles.activated]: currentScope === PreferenceScope.Workspace })} onClick={() => setCurrentScope(PreferenceScope.Workspace)}>{localize('preference.tab.workspace', '工作区设置')}</div>
        </div>
        <div className = {styles.search_pref}>
          <Input placeholder={localize('preference.searchPlaceholder')} onChange={(e) => {
              debouncedSearch((e.target as HTMLInputElement).value);
          }}/>
        </div>
      </div>
      { groups.length > 0 ?
      <div className = {styles.preferences_body}>
        <PreferencesIndexes groups={groups} currentGroupId={currentGroup} setCurrentGroup={setCurrentGroup} scope={currentScope} search={currentSearch}></PreferencesIndexes>
        <div className = {styles.preferences_items}>
          <PreferenceBody groupId={currentGroup} scope={currentScope} search={currentSearch}></PreferenceBody>
        </div>
      </div> :
        <div className = {styles.preference_noResults}>
          {formatLocalize('preference.noResults', currentSearch)}
        </div>
      }
    </div>
  );
});

export const PreferenceSections = (({preferenceSections, navigateTo}: {preferenceSections: ISettingSection[], navigateTo: (section: ISettingSection) => void}) => {

  return <div className={styles.preference_section_link}>{
    preferenceSections.filter((s) => s.title).map((section, idx) => {
      return <div key={`${section.title}-${idx}`}
        onClick={() => navigateTo(section)}
      >{toNormalCase(section.title!)}</div>;
    })
  }</div>;
});

export const PreferencesIndexes = ({groups, currentGroupId: currentGroup, setCurrentGroup, scope, search}: {groups: ISettingGroup[] , currentGroupId: string, setCurrentGroup: (groupId) => void, scope: PreferenceScope , search: string}) => {
  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  return <div className = {styles.preferences_indexes}>
    <Scroll>
      {
        groups && groups.map(({id, title, iconClass}) => {

          const sections = preferenceService.getSections(id, scope, search);

          return (<div key={`${id} - ${title}`}>
            <div key={`${id} - ${title}`} className={classnames({
              [styles.index_item]: true,
              [styles.activated]: currentGroup === id,
            })} onClick={() => {setCurrentGroup(id); }}>
            <span className={iconClass}></span>
              {toNormalCase(replaceLocalizePlaceholder(title) || '')}
            </div>
            {
              currentGroup === id ?
              <div>
                <PreferenceSections preferenceSections={sections} navigateTo={(section) => {
                  const target = document.getElementById('preferenceSection-' + section.title);
                  if (target) {
                    target.parentElement!.scrollTop = target.offsetTop;
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
      section.title ? <div className={styles.section_title}>{toNormalCase(section.title!)}</div> : null
    }
    {
      section.component ? <section.component scope={scope}/> :
      section.preferences.map((preference, idx) => {
        if (typeof preference === 'string') {
          return <PreferenceItemView key={`${idx} - ${preference}`} preferenceName={preference} scope={scope} />;
        } else {
          return <PreferenceItemView key={`${idx} - ${preference.id}`} preferenceName={preference.id} localizedName={localize(preference.localized)} scope={scope} />;
        }
      }) || <div></div>
    }
  </div>;
};

export const PreferenceItemView = ({preferenceName, localizedName, scope}: {preferenceName: string, localizedName?: string, scope: PreferenceScope}) => {

  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);
  const defaultPreferenceProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);

  const commandService = useInjectable(CommandService);
  const fileServiceClient = useInjectable(IFileServiceClient);
  const workspaceService: IWorkspaceService = useInjectable(IWorkspaceService);

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
    preferenceService.setPreference(key, value, scope).then(() => {
      forceUpdate();
    });
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

    const check = <div><CheckBox id={'pref-' + key} checked={value} onChange={(event) => {
      changeValue(key, event.target.checked);
    }}></CheckBox></div>;
    const description = prop && prop.description && replaceLocalizePlaceholder(prop.description);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={classnames(styles.check, styles.key) }>
              {check} <div>{localizedName}</div> {status}
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
              changeValue(key, parseInt(event.target.value, 10));
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
      <option value={item} key={`${idx} - ${item}`}>{
        replaceLocalizePlaceholder((labels[item] || item).toString())
      }</option>);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName} {status}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <Select onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            className={styles.select_control}
            value={value}
          >
            {options}
          </Select>
        </div>
      </div>
    );
  };

  const renderArrayValue = () => {

    let editEl;
    const addItem = () => {
      if (editEl.value) {
        const newValue = value.slice(0);
        newValue.push(editEl.value);
        editEl.value = '';
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
          <Input
            type='text'
            className={styles.text_control}
            ref={(el) => { editEl = el; }}
          />
          <Input className={styles.add_button} onClick={addItem} type='button' value={localize('preference.array.additem', '添加')} />
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
  const editSettingsJson = () => {

    const doOpen = (uri) => {
      fileServiceClient.exists(uri).then((exist) => {
        if (exist) {
          commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(uri));
        } else {
          fileServiceClient.createFile(uri, {content: '', overwrite: false}).then((fstat) => {
            commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(uri));
          }).catch((e) => {
            console.log('create settings.json faild!', e);
          });
        }

      });
    };

    if (scope === PreferenceScope.User) {
      fileServiceClient.getCurrentUserHome().then((dir) => {
        if (dir) {
          doOpen(dir.uri + '/.kaitian/settings.json');
        }
      });
    } else {
      workspaceService.roots.then( (dirs) => {
        const dir = dirs[0];
        if (dir) {
          doOpen(dir.uri + '/.kaitian/settings.json');
        }
      });
    }
  };

  return <div className={classnames({
    [styles.preference_item]: true,
    [styles.modified]: effectingScope === scope,
  })}>
    {renderPreferenceItem()}

  </div>;

};
