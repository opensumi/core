import debounce from 'lodash/debounce';
import { observer } from 'mobx-react-lite';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

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
  IResolvedSettingSection,
} from '@opensumi/ide-core-browser';
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components/layout/split-panel';
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

interface IPreferenceTreeData extends IBasicTreeData {
  section?: ISettingSection;
  groupId?: string;
}

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

  const currentScope = React.useMemo<PreferenceScope>(() => (tabList[tabIndex] || tabList[0]).id, [tabList, tabIndex]);
  const [currentSearchText, setCurrentSearchText] = React.useState<string>(preferenceService.currentSearch);
  const [currentGroup, setCurrentGroup] = React.useState<string>(preferenceService.currentGroup);
  const [currentSelectSection, setCurrentSelectSection] = React.useState<ISettingSection | null>(null);

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
    setCurrentSearchText(preferenceService.currentSearch);
  }, [preferenceService.currentSearch]);
  React.useEffect(() => {
    setCurrentGroup(preferenceService.currentGroup);
  }, [preferenceService.currentGroup]);

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

  const treeData = React.useMemo(() => {
    if (!groups) {
      return [];
    }
    const parseTreeData = (id: string, section: ISettingSection) => {
      let innerTreeData: IPreferenceTreeData | undefined;
      if (section.title) {
        innerTreeData = {
          label: section.title,
          section,
          groupId: id,
        } as IPreferenceTreeData;
      }
      const subTreeData = [] as IPreferenceTreeData[];
      if (section.subSettingSections) {
        section.subSettingSections.forEach((v) => {
          const _treeData = parseTreeData(id, v);
          _treeData && subTreeData.push(_treeData);
        });
      }
      if (innerTreeData && subTreeData && subTreeData.length > 0) {
        innerTreeData.children = subTreeData;
        innerTreeData.expandable = true;
      }
      return innerTreeData;
    };

    const basicTreeData = [] as IPreferenceTreeData[];
    for (const { id, title, iconClass } of groups) {
      const data = {
        label: toNormalCase(replaceLocalizePlaceholder(title) || title),
        iconClassName: iconClass,
        groupId: id,
      } as IPreferenceTreeData;
      const children = [] as IPreferenceTreeData[];
      const sections = preferenceService.getResolvedSections(id, currentScope, currentSearchText);
      sections.forEach((sec) => {
        const _treeData = parseTreeData(id, sec);
        if (_treeData) {
          children.push(_treeData);
        }
      });
      // 要传这个，让 BasicTree 认为这是文件夹以保持排列顺序
      data.children = children;
      if (children.length > 0) {
        data.expandable = true;
      }
      basicTreeData.push(data);
    }
    return basicTreeData;
  }, [groups]);

  const items = React.useMemo(() => {
    const sections = preferenceService.getResolvedSections(currentGroup, currentScope, currentSearchText);
    let result: ISectionItemData[] = [];
    const getItem = (section: IResolvedSettingSection) => {
      let innerItems = [] as ISectionItemData[];

      if (section.component) {
        innerItems.push({ component: section.component, scope: currentScope });
      } else if (section.preferences) {
        innerItems = innerItems.concat(section.preferences.map((pre) => ({ preference: pre, scope: currentScope })));
      } else if (section.subSettingSections) {
        section.subSettingSections.forEach((v) => {
          const _items = getItem(v);
          innerItems = innerItems.concat(_items);
        });
      }
      if (innerItems.length > 0 && section.title) {
        innerItems.unshift({ title: section.title, scope: currentScope });
      }

      return innerItems;
    };

    for (const section of sections) {
      const _items = getItem(section);
      result = result.concat(_items);
    }
    return result;
  }, [currentGroup, currentScope, currentSearchText]);

  const navigateTo = (section: ISettingSection) => {
    const index = items.findIndex((item) => item.title === section.title);
    if (index >= 0) {
      preferenceService.listHandler?.scrollToIndex(index);
    }
  };

  React.useEffect(() => {
    if (currentSelectSection) {
      navigateTo(currentSelectSection);
    } else {
      // 切换 group 后滚到顶部
      preferenceService.listHandler?.scrollToIndex(0);
    }
  }, [items, currentSelectSection]);

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
        {groups.length > 0 ? (
          <SplitPanel id='preference-panel' className={styles.preferences_body} direction='left-to-right'>
            <AutoSizer
              className={styles.preferences_indexes}
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore [SplitPanel 需要 defaultSize 属性]
              defaultSize={180}
            >
              {({ width, height }) => (
                <BasicRecycleTree
                  supportDynamicHeights
                  height={height}
                  width={width}
                  itemHeight={24}
                  baseIndent={8}
                  treeData={treeData}
                  itemClassname={styles.item_label}
                  containerClassname={styles.item_container}
                  onClick={(_e, node) => {
                    const treeData = node && ((node as any)._raw as IPreferenceTreeData);
                    if (treeData) {
                      if (treeData.section) {
                        setCurrentSelectSection(treeData.section);
                      } else {
                        setCurrentSelectSection(null);
                      }
                      if (treeData.groupId) {
                        preferenceService.setCurrentGroup(treeData.groupId);
                      }
                    }
                  }}
                />
              )}
            </AutoSizer>

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

export const PreferenceItem = ({ data, index }: { data: ISectionItemData; index: number }) => {
  if (data.title) {
    return (
      <div className={styles.section_title} id={`preferenceSection-${data.title}`}>
        {data.title}
      </div>
    );
  } else if (data.component) {
    return <data.component scope={data.scope} />;
  } else if (data.preference) {
    return (
      <NextPreferenceItem
        key={`${index} - ${data.preference.id} - ${data.scope}`}
        preference={data.preference}
        preferenceId={data.preference.id}
        localizedName={data.preference.label}
        scope={data.scope}
      />
    );
  }
};

export const PreferenceBody = ({ items, onReady }: { items: ISectionItemData[]; onReady: (handler: any) => void }) => (
  <RecycleList
    onReady={onReady}
    data={items}
    template={PreferenceItem as React.FunctionComponent<{ data: ISectionItemData; index: number }>}
    className={styles.preference_section}
    // 防止底部选择框无法查看的临时处理方式
    paddingBottomSize={100}
  />
);
