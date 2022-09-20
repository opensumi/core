/* eslint-disable no-console */
import classnames from 'classnames';
import debounce from 'lodash/debounce';
import { observer } from 'mobx-react-lite';
import React from 'react';

import {
  Input,
  ComponentContextProvider,
  Tabs,
  RecycleList,
  IIconResourceOptions,
  BasicRecycleTree,
  IBasicTreeData,
} from '@opensumi/ide-components';
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
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components/layout/split-panel';
import { Scroll } from '@opensumi/ide-core-browser/lib/components/scroll';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import { ISectionItemData, toNormalCase } from '../common';

import { PreferenceSettingsService } from './preference-settings.service';
import { NextPreferenceItem } from './preferenceItem.view';
import styles from './preferences.module.less';

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

  const tabList = userBeforeWorkspace ? [UserScope, WorkspaceScope] : [WorkspaceScope, UserScope];

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
    const toDispose = preferenceService.onDidSettingsChange(
      debounce(
        () => {
          doGetGroups();
        },
        300,
        {
          maxWait: 1000,
        },
      ),
    );
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
  const indexDivRef = React.useRef<HTMLDivElement>(null);
  const getIndexDivHeight = React.useCallback(
    () => indexDivRef.current?.getBoundingClientRect()?.height,
    [indexDivRef],
  );

  const items = React.useMemo(() => {
    const sections = preferenceService.getSections(currentGroup, currentScope, currentSearchText);
    console.log('🚀 ~ file: preferences.view.tsx ~ line 135 ~ items ~ sections', sections);
    console.log('🚀 ~ file: preferences.view.tsx ~ line 135 ~ items ~ currentScope', currentScope);
    console.log('🚀 ~ file: preferences.view.tsx ~ line 135 ~ items ~ currentGroup', currentGroup);
    let result: ISectionItemData[] = [];
    const getItem = (section: ISettingSection) => {
      let innerItems = [] as ISectionItemData[];

      if (section.component) {
        innerItems.push({ component: section.component, scope: currentScope });
      } else if (section.preferences) {
        innerItems = innerItems.concat(section.preferences.map((pre) => ({ preference: pre, scope: currentScope })));
      } else if (section.subSettingSections) {
        section.subSettingSections.forEach((v) => {
          innerItems = innerItems.concat(getItem(v));
        });
      }
      if (innerItems.length > 0 && section.title) {
        innerItems.unshift({ title: section.title, scope: currentScope });
      }
      return innerItems;
    };

    for (const section of sections) {
      result = result.concat(getItem(section));
    }
    console.log('🚀 ~ file: preferences.view.tsx ~ line 159 ~ items ~ result', result);
    return result;
  }, [currentGroup, currentScope, currentSearchText]);

  const navigateTo = React.useCallback(
    (section: ISettingSection) => {
      console.log(
        '🚀 ~ file: preferences.view.tsx ~ line 163 ~ constPreferenceView:ReactEditorComponent<null>=observer ~ items',
        items,
      );
      const index = items.findIndex((item) => item.title === section.title);
      if (index >= 0) {
        preferenceService.listHandler?.scrollToIndex(index);
      }
    },
    [items, currentGroup],
  );

  const indexes = React.useMemo(() => {
    const result = [] as JSX.Element[];
    if (groups) {
      for (const { id, title, iconClass } of groups) {
        const sections = preferenceService.getSections(id, currentScope, currentSearchText);
        result.push(
          <div
            key={`${id} - ${title}`}
            className={classnames({
              [styles.index_item_wrapper]: true,
              [styles.activated]: currentGroup === id,
            })}
          >
            <div
              key={`${id} - ${title}`}
              className={classnames({
                [styles.index_item]: true,
                [styles.activated]: currentGroup === id,
              })}
              onClick={() => {
                preferenceService.setCurrentGroup(id);
              }}
            >
              <span className={iconClass}></span>
              {toNormalCase(replaceLocalizePlaceholder(title) || '')}
            </div>
            <PreferenceSections
              key={`${id} - ${title}`}
              show={currentGroup === id}
              getMaxHeight={getIndexDivHeight}
              sections={sections}
              navigateTo={navigateTo}
            />
          </div>,
        );
      }
    }
    return result;
  }, [navigateTo, groups, currentGroup]);

  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <div className={styles.preferences}>
        <div className={styles.preferences_header}>
          <Tabs
            className={styles.tabs}
            value={tabIndex}
            onChange={(index: number) => setTabIndex(index)}
            tabs={tabList.map((n) => localize(n.label))}
          />
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
        {indexes.length > 0 ? (
          <SplitPanel id='preference-panel' className={styles.preferences_body} direction='left-to-right' useDomSize>
            <div
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore [SplitPanel 需要 defaultSize 属性]
              defaultSize={155}
              ref={indexDivRef}
              className={styles.preferences_indexes}
            >
              <Scroll
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'inherit',
                  justifyContent: 'flex-start',
                }}
              >
                {indexes}
              </Scroll>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore [SplitPanel 需要 flex 属性] */}
            <div className={styles.preferences_items} flex={1}>
              <PreferenceBody items={items} onReady={preferenceService.handleListHandler}></PreferenceBody>
            </div>
          </SplitPanel>
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
  getMaxHeight,
  sections,
  navigateTo,
  show,
  key,
}: {
  getMaxHeight: () => number | undefined;
  sections: ISettingSection[];
  navigateTo: (section: ISettingSection) => void;
  show: boolean;
  key: string;
}) => {
  const treeData = React.useMemo(
    () =>
      sections
        .map((v) => {
          if (v.title) {
            const result = {
              label: v.title,
              section: v,
            } as IBasicTreeData;
            const subSections = v.subSettingSections
              ?.map((subSec) =>
                subSec.title
                  ? {
                      label: subSec.title,
                      section: subSec,
                    }
                  : null,
              )
              .filter(Boolean) as IBasicTreeData[];
            if (subSections && subSections.length > 0) {
              result.children = subSections;
              result.expandable = true;
            }
            return result;
          }
        })
        .filter(Boolean) as IBasicTreeData[],
    [sections],
  );

  return (
    <div key={key} className={`${styles.preference_section_link} ${show ? styles.show : styles.hide}`}>
      {treeData.length > 0 ? (
        <BasicRecycleTree
          height={0}
          autoSizer
          getMaxHeight={getMaxHeight}
          treeData={treeData}
          itemClassname={styles.item_label}
          containerClassname={styles.item_container}
          indent={6}
          itemHeight={22}
          onClick={(_e, node) => {
            console.log('🚀 ~ file: preferences.view.tsx ~ line 263 ~ node', node);
            if (node && ((node as any)._raw as IBasicTreeData).section) {
              navigateTo(((node as any)._raw as IBasicTreeData).section);
            }
          }}
        />
      ) : null}
    </div>
  );
};

export const PreferenceItem = ({ data, index }: { data: ISectionItemData; index: number }) => {
  if (data.title) {
    return (
      <div className={styles.section_title} id={`preferenceSection-${data.title}`}>
        {data.title}
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
