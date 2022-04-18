import classnames from 'classnames';
import debounce from 'lodash/debounce';
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
import { Scroll } from '@opensumi/ide-core-browser/lib/components/scroll';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

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
  const userBeforeWorkspace = React.useMemo(() => preferences.get<boolean>('settings.userBeforeWorkspace'), []);

  const _tabList = userBeforeWorkspace ? [UserScope, WorkspaceScope] : [WorkspaceScope, UserScope];

  const [tabList, setTabList] = React.useState<
    {
      id: PreferenceScope;
      label: string;
    }[]
  >(_tabList);

  const [tabIndex, setTabIndex] = React.useState<number>(0);

  const { currentSearch: _currentSearchText, currentGroup } = preferenceService;

  const currentScope = React.useMemo<PreferenceScope>(() => (tabList[tabIndex] || tabList[0]).id, [tabList, tabIndex]);
  const [currentSearchText, setCurrentSearchText] = React.useState<string>(_currentSearchText);
  const [groups, setGroups] = React.useState<ISettingGroup[]>([]);

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const debouncedSearch = debounce(
    (value: string) => {
      setCurrentSearchText(value);
    },
    100,
    { maxWait: 1000 },
  );

  const doGetGroups = async () => {
    const groups = preferenceService.getSettingGroups(currentScope, currentSearchText);
    if (groups.length > 0 && groups.findIndex((g) => g.id === currentGroup) === -1) {
      preferenceService.setCurrentGroup(groups[0].id);
    }
    setGroups(groups);
  };

  React.useEffect(() => {
    doGetGroups();
    const toDispose = preferenceService.onDidSettingsChange(() => {
      doGetGroups();
    });

    // 如果当前工作区有设置文件，则先展示工作区设置
    (async () => {
      const hasWorkspaceSettings = await preferenceService.hasThisScopeSetting(PreferenceScope.Workspace);
      if (hasWorkspaceSettings) {
        setTabList([WorkspaceScope, UserScope]);
      }
    })();
    return () => {
      toDispose?.dispose();
    };
  }, []);

  React.useEffect(() => {
    doGetGroups();
  }, [currentScope, currentSearchText]);

  React.useEffect(() => {
    setCurrentSearchText(_currentSearchText);
  }, [_currentSearchText]);

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
    const sections = preferenceService.getSections(currentGroup, currentScope, currentSearchText);
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
  }, [currentGroup, currentScope, currentSearchText]);

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
              value={currentSearchText}
              placeholder={localize('preference.searchPlaceholder')}
              onValueChange={debouncedSearch}
              ref={inputRef}
            />
          </div>
        </div>
        {groups.length > 0 ? (
          <div className={styles.preferences_body}>
            <PreferencesIndexes
              groups={groups}
              scope={currentScope}
              searchText={currentSearchText}
              navigateTo={navigateTo}
            />
            <div className={styles.preferences_items}>
              <PreferenceBody items={items} onReady={preferenceService.handleListHandler}></PreferenceBody>
            </div>
          </div>
        ) : (
          <div className={styles.preference_noResults}>
            {currentSearchText
              ? formatLocalize('preference.noResults', currentSearchText)
              : formatLocalize('preference.empty')}
          </div>
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
  searchText,
  navigateTo,
}: {
  groups: ISettingGroup[];
  scope: PreferenceScope;
  searchText: string;
  navigateTo: (section: ISettingSection) => void;
}) => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  return (
    <div className={styles.preferences_indexes}>
      <Scroll>
        {groups &&
          groups.map(({ id, title, iconClass }) => {
            const sections = preferenceService.getSections(id, scope, searchText);

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
        localizedName={data.preference.localized ? localize(data.preference.localized) : ''}
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
    <>
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
    </>
  </div>
);
