import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { replaceLocalizePlaceholder, useInjectable, localize, PreferenceScope, formatLocalize , AppConfig, PreferenceService} from '@ali/ide-core-browser';
import { PreferenceSettingsService } from './preference.service';
import './index.less';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ISettingGroup, IPreferenceSettingsService, ISettingSection } from '@ali/ide-core-browser';
import debounce = require('lodash.debounce');
import { getIcon } from '@ali/ide-core-browser';
import { Input, ComponentContextProvider } from '@ali/ide-components';
import { Tabs } from '@ali/ide-components';

import { toNormalCase } from '../common';
import { NextPreferenceItem } from './preferenceItem.view';

const WorkspaceScope = {
  id: PreferenceScope.Workspace ,
  label: 'preference.tab.workspace',
};

const UserScope = {
  id: PreferenceScope.User ,
  label: 'preference.tab.user',
};

export const PreferenceView: ReactEditorComponent<null> = observer(() => {

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
