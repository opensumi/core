import classnames from 'classnames';
import debounce = require('lodash.debounce');
import { observer } from 'mobx-react-lite';
import React from 'react';

import { Input, ComponentContextProvider, Tabs, RecycleList, IIconResourceOptions } from '@opensumi/ide-components';
import {
  replaceLocalizePlaceholder,
  useInjectable,
  localize,
  PreferenceScope,
  formatLocalize,
  PreferenceService,
  ISettingGroup,
  IPreferenceSettingsService,
  ISettingSection,
  getIcon,
  URI,
  LabelService,
} from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { Scroll } from '@opensumi/ide-editor/lib/browser/component/scroll/scroll';

import { ISectionItemData, toNormalCase } from '../common';

import { PreferenceSettingsService } from './preference-settings.service';
import { NextPreferenceItem } from './preferenceItem.view';
import styles from './preferences.module.less';

import './index.less';

const WorkspaceScope = {
  id: PreferenceScope.Workspace,
  label: 'preference.tab.workspace',
};

const UserScope = {
  id: PreferenceScope.User,
  label: 'preference.tab.user',
};

export const PreferenceView: ReactEditorComponent<null> = observer(() => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const preferences: PreferenceService = useInjectable(PreferenceService);
  const labelService = useInjectable<LabelService>(LabelService);
  const getResourceIcon = React.useCallback(
    (uri: string, options: IIconResourceOptions) => labelService.getIcon(URI.parse(uri), options),
    [],
  );
  const userBeforeWorkspace = preferences.get<boolean>('settings.userBeforeWorkspace');
  const tabList = userBeforeWorkspace ? [UserScope, WorkspaceScope] : [WorkspaceScope, UserScope];

  const [tabIndex, setTabIndex] = React.useState<number>(0);
  const currentScope = React.useMemo<PreferenceScope>(() => (tabList[tabIndex] || tabList[0]).id, [tabList, tabIndex]);

  const { currentSearch: doSearchValue, currentGroup } = preferenceService;

  const [currentSearch, setCurrentSearch] = React.useState<string>('');

  const groups = preferenceService.getSettingGroups(currentScope, currentSearch);

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  if (groups.length > 0 && groups.findIndex((g) => g.id === preferenceService.currentGroup) === -1) {
    preferenceService.setCurrentGroup(groups[0].id);
  }

  const debouncedSearch = debounce(
    (value) => {
      setCurrentSearch(value);
    },
    100,
    { maxWait: 1000 },
  );

  const search = (value: string) => {
    debouncedSearch(value);
  };

  React.useEffect(() => {
    setCurrentSearch(doSearchValue);
  }, [doSearchValue]);

  React.useEffect(() => {
    const focusDispose = preferenceService.onFocus(() => {
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
      }
    });
    return () => {
      focusDispose.dispose();
    };
  }, []);

  const headers = (
    <Tabs
      className={styles.tabs}
      value={tabIndex}
      onChange={(index: number) => setTabIndex(index)}
      tabs={tabList.map((n) => localize(n.label))}
    />
  );

  const items = React.useMemo(() => {
    const sections = preferenceService.getSections(preferenceService.currentGroup, currentScope, currentSearch);
    let items: ISectionItemData[] = [];
    for (const section of sections) {
      if (section.title) {
        items.push({ title: section.title, scope: currentScope });
      }
      if (section.component) {
        items.push({ component: section.title, scope: currentScope });
      } else {
        items = items.concat(section.preferences.map((pre) => ({ preference: pre, scope: currentScope })));
      }
    }
    return items;
  }, [currentGroup, currentScope, currentSearch]);

  const navigateTo = React.useCallback(
    (section: ISettingSection) => {
      const index = items.findIndex((item) => item.title === section.title);
      if (index >= 0) {
        preferenceService.listHandler?.scrollToIndex(index);
      }
    },
    [items],
  );

  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <div className={styles.preferences}>
        <div className={styles.preferences_header}>
          {headers}
          <div className={styles.search_pref}>
            <Input
              autoFocus
              value={currentSearch}
              placeholder={localize('preference.searchPlaceholder')}
              onValueChange={search}
              ref={inputRef}
            />
          </div>
        </div>
        {groups.length > 0 ? (
          <div className={styles.preferences_body}>
            <PreferencesIndexes
              groups={groups}
              scope={currentScope}
              search={currentSearch}
              navigateTo={navigateTo}
            ></PreferencesIndexes>
            <div className={styles.preferences_items}>
              <PreferenceBody items={items} onReady={preferenceService.handleListHandler}></PreferenceBody>
            </div>
          </div>
        ) : (
          <div className={styles.preference_noResults}>{formatLocalize('preference.noResults', currentSearch)}</div>
        )}
      </div>
    </ComponentContextProvider>
  );
});

export const PreferenceSections = ({
  preferenceSections,
  navigateTo,
}: {
  preferenceSections: ISettingSection[];
  navigateTo: (section: ISettingSection) => void;
}) => (
  <div className={styles.preference_section_link}>
    {preferenceSections
      .filter((s) => s.title)
      .map((section, idx) => (
        <div key={`${section.title}-${idx}`} onClick={() => navigateTo(section)}>
          {section.title}
        </div>
      ))}
  </div>
);

export const PreferencesIndexes = ({
  groups,
  scope,
  search,
  navigateTo,
}: {
  groups: ISettingGroup[];
  scope: PreferenceScope;
  search: string;
  navigateTo: (setction: ISettingSection) => void;
}) => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  return (
    <div className={styles.preferences_indexes}>
      <Scroll>
        {groups &&
          groups.map(({ id, title, iconClass }) => {
            const sections = preferenceService.getSections(id, scope, search);

            return (
              <div key={`${id} - ${title}`} className={styles.index_item_wrapper}>
                <div
                  key={`${id} - ${title}`}
                  className={classnames({
                    [styles.index_item]: true,
                    [styles.activated]: preferenceService.currentGroup === id,
                  })}
                  onClick={() => {
                    preferenceService.setCurrentGroup(id);
                  }}
                >
                  <span className={iconClass}></span>
                  {toNormalCase(replaceLocalizePlaceholder(title) || '')}
                </div>
                {preferenceService.currentGroup === id ? (
                  <div>
                    <PreferenceSections preferenceSections={sections} navigateTo={navigateTo} />
                  </div>
                ) : (
                  <div></div>
                )}
              </div>
            );
          })}
      </Scroll>
    </div>
  );
};

export const PreferenceItem = ({ data, index }: { data: ISectionItemData; index: number }) => {
  if (data.title) {
    return (
      <div className={styles.section_title} id={`preferenceSection-${data.title}`}>
        {data.title!}
      </div>
    );
  } else if (data.component) {
    return <data.component scope={data.scope} />;
  } else if (typeof data.preference === 'string') {
    return (
      <NextPreferenceItem
        key={`${index} - ${data.preference} - ${data.scope}`}
        preferenceName={data.preference}
        scope={data.scope}
      />
    );
  } else if (data.preference) {
    return (
      <NextPreferenceItem
        key={`${index} - ${data.preference.id} - ${data.scope}`}
        preferenceName={data.preference.id}
        localizedName={localize(data.preference.localized)}
        scope={data.scope}
      />
    );
  }
};

export const PreferenceBody = ({ items, onReady }: { items: ISectionItemData[]; onReady: (handler: any) => void }) => (
  <RecycleList
    onReady={onReady}
    data={items}
    template={PreferenceItem as any}
    className={styles.preference_section}
    // 防止底部选择框无法查看的临时处理方式
    paddingBottomSize={100}
  />
);

export const PreferenceSection = ({ section, scope }: { section: ISettingSection; scope: PreferenceScope }) => (
  <div className={styles.preference_section} id={'preferenceSection-' + section.title}>
    {section.title ? <div className={styles.section_title}>{section.title!}</div> : null}
    {section.component ? (
      <section.component scope={scope} />
    ) : (
      section.preferences.map((preference, idx) => {
        if (typeof preference === 'string') {
        } else {
        }
      }) || <div></div>
    )}
  </div>
);
