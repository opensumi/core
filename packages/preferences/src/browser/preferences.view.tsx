import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { replaceLocalizePlaceholder, useInjectable, localize, PreferenceScope, formatLocalize, AppConfig, PreferenceService } from '@ali/ide-core-browser';
import { PreferenceSettingsService } from './preference-settings.service';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ISettingGroup, IPreferenceSettingsService, ISettingSection } from '@ali/ide-core-browser';
import debounce = require('lodash.debounce');
import { getIcon } from '@ali/ide-core-browser';
import { Input, ComponentContextProvider } from '@ali/ide-components';
import { Tabs } from '@ali/ide-components';
import { ISectionItemData, toNormalCase } from '../common';
import { NextPreferenceItem } from './preferenceItem.view';
import { RecycleList, DynamicListContext } from '@ali/ide-components';
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
  const appConfig: AppConfig = useInjectable(AppConfig);
  const userBeforeWorkspace = preferences.get<boolean>('settings.userBeforeWorkspace');
  const tabList = userBeforeWorkspace
    ? [UserScope, WorkspaceScope]
    : [WorkspaceScope, UserScope];

  const [tabIndex, setTabIndex] = React.useState<number>(0);
  const currentScope = React.useMemo<PreferenceScope>(() => {
    return (tabList[tabIndex] || tabList[0]).id;
  }, [tabList, tabIndex]);

  const { currentSearch: doSearchValue, currentGroup } = preferenceService;

  const [currentSearch, setCurrentSearch] = React.useState<string>('');

  const groups = preferenceService.getSettingGroups(currentScope, currentSearch);

  if (groups.length > 0 && groups.findIndex((g) => g.id === preferenceService.currentGroup) === -1) {
    preferenceService.setCurrentGroup(groups[0].id);
  }

  const debouncedSearch = debounce((value) => {
    setCurrentSearch(value);
  }, 100, { maxWait: 1000 });

  const search = (value: string) => {
    debouncedSearch(value);
  };

  React.useEffect(() => {
    setCurrentSearch(doSearchValue);
  }, [doSearchValue]);

  const headers = (
    <Tabs
      className={styles.tabs}
      value={tabIndex}
      onChange={(index: number) => setTabIndex(index)}
      tabs={tabList.map((n) => localize(n.label))} />
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

  const navigateTo = React.useCallback((section: ISettingSection) => {
    const index = items.findIndex((item) => item.title === section.title);
    if (index >= 0) {
      preferenceService.listHandler?.scrollToIndex(index);
    }
  }, [items]);

  return (
    <ComponentContextProvider value={{ getIcon, localize }}>
      <div className={styles.preferences}>
        <div className={styles.preferences_header}>
          {appConfig.isSyncPreference ? <div /> : headers}
          <div className={styles.search_pref}>
            <Input
              value={currentSearch}
              placeholder={localize('preference.searchPlaceholder')}
              onValueChange={search}
            />
          </div>
        </div>
        {groups.length > 0 ?
          <div className={styles.preferences_body}>
            <PreferencesIndexes groups={groups} scope={currentScope} search={currentSearch} navigateTo={navigateTo}></PreferencesIndexes>
            <div className={styles.preferences_items}>
              <PreferenceBody items={items} onReady={preferenceService.handleListHandler}></PreferenceBody>
            </div>
          </div> :
          <div className={styles.preference_noResults}>
            {formatLocalize('preference.noResults', currentSearch)}
          </div>
        }
      </div>
    </ComponentContextProvider>
  );
});

export const PreferenceSections = (({ preferenceSections, navigateTo }: { preferenceSections: ISettingSection[], navigateTo: (section: ISettingSection) => void }) => {

  return <div className={styles.preference_section_link}>{
    preferenceSections.filter((s) => s.title).map((section, idx) => {
      return <div key={`${section.title}-${idx}`}
        onClick={() => navigateTo(section)}
      >{section.title!}</div>;
    })
  }</div>;
});

export const PreferencesIndexes = ({ groups, scope, search, navigateTo }: {
  groups: ISettingGroup[];
  scope: PreferenceScope;
  search: string;
  navigateTo: (setction: ISettingSection) => void;
}) => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  return <div className={styles.preferences_indexes}>
    <Scroll>
      {
        groups && groups.map(({ id, title, iconClass }) => {

          const sections = preferenceService.getSections(id, scope, search);

          return (<div key={`${id} - ${title}`} className={styles.index_item_wrapper}>
            <div key={`${id} - ${title}`} className={classnames({
              [styles.index_item]: true,
              [styles.activated]: preferenceService.currentGroup === id,
            })} onClick={() => { preferenceService.setCurrentGroup(id); }}>
              <span className={iconClass}></span>
              {toNormalCase(replaceLocalizePlaceholder(title) || '')}
            </div>
            {
              preferenceService.currentGroup === id ?
                <div>
                  <PreferenceSections preferenceSections={sections} navigateTo={navigateTo}></PreferenceSections>
                </div>
                : <div></div>
            }
          </div>);
        })
      }
    </Scroll>
  </div>;
};

export const PreferenceItem = ({ data, index }: {
  data: ISectionItemData,
  index: number,
}) => {
  const { setSize } = React.useContext(DynamicListContext);
  const rowRoot = React.useRef<null | HTMLDivElement>(null);
  const observer = React.useRef<any>();

  React.useEffect(() => {
    observer.current = new MutationObserver((mutations, observer) => {
      if (rowRoot.current) {
        setSize && setSize(index, rowRoot.current.getBoundingClientRect().height);
      }
    });
    if (rowRoot.current) {
      const observerOption = {
        childList: true, // 子节点的变动（新增、删除或者更改）
        attributes: true, // 属性的变动
        characterData: true, // 节点内容或节点文本的变动

        subtree: true, // 是否将观察器应用于该节点的所有后代节点
        attributeFilter: ['class', 'style'], // 观察特定属性
        attributeOldValue: true, // 观察 attributes 变动时，是否需要记录变动前的属性值
        characterDataOldValue: true, // 观察 characterData 变动，是否需要记录变动前的值
      };
      // 监听子节点属性变化
      observer.current.observe(rowRoot.current, observerOption);
      setSize && setSize(index, rowRoot.current.getBoundingClientRect().height);
    }
    return () => {
      observer.current.disconnect();
    };
  }, []);

  if (data.title) {
    return <div
      ref={rowRoot}
    >
      <div className={styles.section_title} id={`preferenceSection-${data.title}`}>{data.title!}</div>
    </div>;
  } else if (data.component) {
    return <div
      ref={rowRoot}
    >
      <data.component scope={data.scope} />
    </div>;
  } else if (typeof data.preference === 'string') {
    return <div
      ref={rowRoot}
    >
      <NextPreferenceItem key={`${index} - ${data.preference} - ${data.scope}`} preferenceName={data.preference} scope={data.scope} />
    </div>;
  } else if (data.preference) {
    return <div
      ref={rowRoot}
    >
      <NextPreferenceItem key={`${index} - ${data.preference.id} - ${data.scope}`} preferenceName={data.preference.id} localizedName={localize(data.preference.localized)} scope={data.scope} />
    </div>;
  }
};

export const PreferenceBody = ({ items, onReady }: {
  items: ISectionItemData[];
  onReady: (handler: any) => void;
}) => {
  return <RecycleList
    onReady={onReady}
    data={items}
    template={PreferenceItem as any}
    className={styles.preference_section}
  />;
};

export const PreferenceSection = ({ section, scope }: { section: ISettingSection, scope: PreferenceScope }) => {
  return <div className={styles.preference_section} id={'preferenceSection-' + section.title}>
    {
      section.title ? <div className={styles.section_title}>{section.title!}</div> : null
    }
    {
      section.component ? <section.component scope={scope} /> :
        section.preferences.map((preference, idx) => {
          if (typeof preference === 'string') {
          } else {
          }
        }) || <div></div>
    }
  </div>;
};
