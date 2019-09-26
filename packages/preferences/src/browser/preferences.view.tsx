import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { replaceLocalizePlaceholder, useInjectable, PreferenceSchemaProvider, PreferenceDataProperty, URI, CommandService, localize, PreferenceSchemaProperty, PreferenceScope, EDITOR_COMMANDS, IFileServiceClient } from '@ali/ide-core-browser';
import { PreferenceSettingsService } from './preference.service';
import Tabs from 'antd/lib/tabs';
import './index.less';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ISettingGroup, IPreferenceSettingsService, ISettingSection } from './types';
import throttle = require('lodash.throttle');
import { IWorkspaceService } from '@ali/ide-workspace';

export const PreferenceView: ReactEditorComponent<null> = observer((props) => {

  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  const groups = preferenceService.getSettingGroups();
  const [currentScope, setCurrentScope] = React.useState(PreferenceScope.User);
  const [currentGroup, setCurrentGroup] = React.useState(groups[0] ? groups[0].id : '');

  return (
    <div className = {styles.preferences}>
      <div className = {styles.preferences_header}>
        <div className = {classnames({[styles.activated]: currentScope === PreferenceScope.User })} onClick={() => setCurrentScope(PreferenceScope.User )}>{localize('preference.tab.user', '全局设置')}</div>
        <div className = {classnames({[styles.activated]: currentScope === PreferenceScope.Workspace })} onClick={() => setCurrentScope(PreferenceScope.Workspace)}>{localize('preference.tab.preference', '工作区设置')}</div>
      </div>
      <div className = {styles.preferences_body}>
        <PreferencesIndexes groups={groups} currentGroupId={currentGroup} setCurrentGroup={setCurrentGroup}></PreferencesIndexes>
        <div className = {styles.preferences_items}>
          <PreferenceBody groupId={currentGroup} scope={currentScope}></PreferenceBody>
        </div>
      </div>
    </div>
  );
});

export const PreferencesIndexes = ({groups, currentGroupId: currentGroup, setCurrentGroup}: {groups: ISettingGroup[] , currentGroupId: string, setCurrentGroup: (groupId) => void }) => {

  return <div className = {styles.preferences_indexes}>
    <Scroll>
      {
        groups.map(({id, title, iconClass}) => {
          return <div key={id} className={classnames({
            [styles.index_item]: true,
            [styles.activated]: currentGroup === id,
          })} onClick={() => {setCurrentGroup(id); }}>
          <span className={iconClass}></span>
          {replaceLocalizePlaceholder(title)}
          </div>;
        })
      }
    </Scroll>
  </div>;
};

export const PreferenceBody = ({groupId, scope}: {groupId: string, scope: PreferenceScope}) => {
  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  return <Scroll>
    {preferenceService.getSections(groupId).map((section, i) => {
      return <PreferenceSection key={i} section={section} scope={scope} />;
    })}
  </Scroll>;
};

export const PreferenceSection = ({section, scope}: {section: ISettingSection, scope: PreferenceScope}) => {
  return <div className={styles.preference_section}>
    {
      section.title ? <div className={styles.section_title}>{section.title}</div> : null
    }
    {
      section.component ? <section.component scope={scope}/> :
      section.preferences.map((preference) => {
        if (typeof preference === 'string') {
          return <PreferenceItemView key={preference} preferenceName={preference} scope={scope} />;
        } else {
          return <PreferenceItemView key={preference.id} preferenceName={preference.id} localizedName={localize(preference.localized)} scope={scope} />;
        }
      })
    }
  </div>;
};

export const PreferenceItemView = ({preferenceName, localizedName, scope}: {preferenceName: string, localizedName?: string, scope: PreferenceScope}) => {

  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);
  const defaultPreferenceProvider: PreferenceSchemaProvider = (preferenceService.defaultPreference as PreferenceSchemaProvider);

  const commandService = useInjectable(CommandService);
  const fileServiceClient = useInjectable(IFileServiceClient);
  const workspaceService: IWorkspaceService = useInjectable(IWorkspaceService);

  const key = preferenceName;

  if (!localizedName) {
    localizedName = toPreferenceReadableName(preferenceName);
  }

  const [value, setValue] = React.useState(preferenceService.getPreference(preferenceName, scope).value);

  const changeValue = (key, value) => {
    doChangeValue(value);
    setValue(value);
  };

  React.useEffect(() => {
    setValue(preferenceService.getPreference(preferenceName, scope).value);
  }, [scope, preferenceName]);

  const doChangeValue = throttle((value) => {
    preferenceService.setPreference(key, value, scope);
  });

  const renderPreferenceItem = () => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);
    if (prop) {
      switch (prop.type) {
        case 'boolean':
          return renderBooleanValue();
          break;
        case 'integer':
        case 'number':
          return renderNumberValue();
          break;
        case 'string':
          if (prop.enum) {
            return renderEnumsValue();
          } else {
            return renderTextValue();
          }
          break;
        default:
          return renderOtherValue();
      }
    }
    return <div></div>;
  };

  const renderBooleanValue = () => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <select onChange={(event) => {
              changeValue(key, event.target.value === 'true');
            }}
            className={styles.select_control}
            value={value ? 'true' : 'false'}
          >
            <option key='true' value='true'>true</option>
            <option key='value' value='false'>false</option>
          </select>
        </div>
      </div>
    );
  };

  const renderNumberValue = () => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <input
            type='number'
            className={styles.number_control}
            onChange={(event) => {
              changeValue(key, parseInt(event.target.value, 10));
            }}
            value={value}
          />
        </div>
      </div>
    );
  };

  const renderTextValue = () => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <input
            type='text'
            className={styles.text_control}
            onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            value={value}
          />
        </div>
      </div>
    );
  };

  const renderEnumsValue = () => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

    if (!prop) {
      return null;
    }

    const optionEnum = (prop as PreferenceDataProperty).enum;

    if (!Array.isArray(optionEnum) || !optionEnum.length) {
      return null;
    }

    // enum 本身为 string[] | number[]
    const options = optionEnum.map((item) => <option value={item}>{item}</option>);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <select onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            className={styles.select_control}
            value={value}
          >
            {options}
          </select>
        </div>
      </div>
    );
  };

  const renderOtherValue = () => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <a href='#' onClick={editSettingsJson}>Edit in settings.json</a>
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

  return <div>
    {renderPreferenceItem()}
  </div>;

};

function toPreferenceReadableName(name) {
  const parts = name.split('.');
  let result = toNormalCase(parts[0]);
  if (parts[1]) {
    result += ' > ' + toNormalCase(parts[1]);
  }
  if (parts[2]) {
    result += ' : ' + toNormalCase(parts[2]);
  }
  return result;
}

function toNormalCase(str: string) {
  return str.substr(0, 1).toUpperCase() + str.substr(1).replace(/([^A-Z])([A-Z])/g, '$1 $2');
}
