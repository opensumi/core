import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  BasicRecycleTree,
  ComponentContextProvider,
  IBasicTreeData,
  IIconResourceOptions,
  Input,
  Tabs,
} from '@opensumi/ide-components';
import { VirtualList } from '@opensumi/ide-components/lib/virtual-list';
import { IVirtualListRange } from '@opensumi/ide-components/lib/virtual-list/types';
import {
  Disposable,
  FRAME_THREE,
  IPreferenceSettingsService,
  IResolvedSettingSection,
  ISettingGroup,
  ISettingSection,
  LabelService,
  URI,
  formatLocalize,
  getIcon,
  localize,
  useEventDrivenState,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { EDirection } from '@opensumi/ide-core-browser/lib/components/index';
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components/layout/split-panel';
import useThrottleFn from '@opensumi/ide-core-browser/lib/react-hooks/useThrottleFn';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import { ESectionItemKind, ISectionItemData, toNormalCase } from '../common';

import { PreferenceSettingsService } from './preference-settings.service';
import { NextPreferenceItem } from './preferenceItem.view';
import styles from './preferences.module.less';

interface IPreferenceTreeData extends IBasicTreeData {
  section?: string;
  groupId?: string;
  order?: number;
}

const TREE_NAME = 'preferenceViewIndexTree';
const kBaseIndent = 8;

export const PreferenceView: ReactEditorComponent<null> = () => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const [items, setItems] = useState<ISectionItemData[]>([]);
  const [treeData, setTreeData] = useState<IPreferenceTreeData[]>([]);

  const updateGroup = useThrottleFn(() => {
    const currentScope = preferenceService.currentScope;
    const currentSearch = preferenceService.currentSearch;
    const newGroups = preferenceService.getSettingGroups(currentScope, currentSearch);

    // 如果是搜索模式，是只展示用户左侧选择的组的内容
    const items: ISectionItemData[] = [];
    const treeData: IPreferenceTreeData[] = [];

    for (let index = 0; index < newGroups.length; index++) {
      const g = newGroups[index];
      const sections = preferenceService.getResolvedSections(g.id, currentScope, currentSearch);

      items.push(...collectGroup(g, sections));
      treeData.push(collectTreeData(index, g, sections));
    }

    setItems(items);
    setTreeData(treeData);

    function collectGroup(group: ISettingGroup, sections: IResolvedSettingSection[]) {
      const groupItems = [] as ISectionItemData[];

      const collectItem = (section: IResolvedSettingSection, prefix = '') => {
        let currentItemPath = prefix;
        if (section.title) {
          currentItemPath = prefix + '/' + section.title;
        }

        const innerItems = [] as ISectionItemData[];

        if (section.component) {
          innerItems.push({
            component: section.component,
            scope: currentScope,
          });
        } else if (section.preferences) {
          innerItems.push(
            ...section.preferences.map((pre) => ({
              id: ESectionItemKind.Preference + pre.id,
              preference: pre,
              scope: currentScope,
              _path: currentItemPath,
            })),
          );
        } else if (section.subSections) {
          section.subSections.forEach((v) => {
            const _items = collectItem(v, currentItemPath);
            innerItems.push(..._items);
          });
        }

        // 如果该 section 有选项，填入一个 title
        if (innerItems.length > 0 && section.title) {
          innerItems.unshift({
            id: ESectionItemKind.Section + section.title,
            title: section.title,
            scope: currentScope,
            _path: currentItemPath,
          });
        }

        return innerItems;
      };

      for (const section of sections) {
        const _items = collectItem(section, group.title);
        groupItems.push(..._items);
      }

      // 如果该 group 有选项，填入一个 title
      if (groupItems.length > 0 && group.title) {
        groupItems.unshift({
          title: group.title,
          id: ESectionItemKind.Group + group.id,
          scope: currentScope,
          _path: group.title,
        });
      }
      return groupItems;
    }
    function collectTreeData(index: number, group: ISettingGroup, sections: IResolvedSettingSection[]) {
      const { id, title, iconClass } = group;
      const data = {
        label: toNormalCase(title),
        iconClassName: iconClass,
        groupId: id,
        order: index,
        className: styles.group_item,
      } as IPreferenceTreeData;
      const children = [] as IPreferenceTreeData[];
      sections.forEach((sec, i) => {
        const _treeData = parseTreeData(id, sec, i, 1);
        if (_treeData) {
          children.push(_treeData);
        }
      });
      // 要传这个，让 BasicTree 认为这是文件夹以保持排列顺序
      data.children = children;
      if (children.length > 0) {
        data.expandable = true;
      } else {
        data.expandable = false;
      }
      return data;
    }
  }, 16);

  useEffect(() => {
    const dispose = new Disposable(
      preferenceService.emitter.on('settingsGroupsChange', () => {
        updateGroup.run();
      }),
      preferenceService.emitter.on('currentSearchChange', () => {
        updateGroup.run();
      }),
      preferenceService.emitter.on('currentScopeChange', () => {
        updateGroup.run();
      }),
      preferenceService.emitter.on('settingsSectionsChange', () => {
        updateGroup.run();
      }),
    );

    updateGroup.run();

    return () => {
      dispose.dispose();
    };
  }, []);

  const labelService = useInjectable<LabelService>(LabelService);
  const getResourceIcon = useCallback(
    (uri: string, options: IIconResourceOptions) => labelService.getIcon(URI.parse(uri), options),
    [],
  );

  const inputRef = useRef<HTMLInputElement | null>(null);

  const debouncedSearch = debounce(
    (value: string) => {
      preferenceService.search(value);
    },
    100,
    { maxWait: 300 },
  );

  useEffect(() => {
    const focusDispose = preferenceService.onFocus(() => {
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    });
    return () => {
      focusDispose.dispose();
    };
  }, []);

  const currentSearch = useEventDrivenState(
    preferenceService.emitter,
    'currentSearchChange',
    () => preferenceService.currentSearch,
  );

  const tabList = useEventDrivenState(preferenceService.emitter, 'tabListChange', () => preferenceService.tabList);
  const tabIndex = useEventDrivenState(preferenceService.emitter, 'tabIndexChange', () => preferenceService.tabIndex);

  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <div className={styles.preferences}>
        <div className={styles.preferences_header}>
          <Tabs
            className={styles.tabs}
            value={tabIndex}
            onChange={(index: number) => {
              preferenceService.updateTabIndex(index);
            }}
            tabs={tabList.map((n) => localize(n.label))}
          />
          <div className={styles.search_pref}>
            <Input
              autoFocus
              value={currentSearch}
              placeholder={localize('preference.searchPlaceholder')}
              onValueChange={debouncedSearch}
              ref={inputRef}
              hasClear
            />
          </div>
        </div>
        {items.length > 0 ? (
          <SplitPanel
            id='preference-panel'
            resizeHandleClassName={styles.devider}
            className={styles.preferences_body}
            direction={EDirection.LeftToRight}
          >
            <PreferenceIndexes treeData={treeData} data-sp-defaultSize={180} data-sp-minSize={150} />
            <PreferenceBody tabIndex={tabIndex} items={items} data-sp-flex={1} />
          </SplitPanel>
        ) : (
          <div className={styles.preference_noResults}>
            {currentSearch ? formatLocalize('preference.noResults', currentSearch) : formatLocalize('preference.empty')}
          </div>
        )}
      </div>
    </ComponentContextProvider>
  );
};

export const PreferenceItem = ({ data, index }: { data: ISectionItemData; index: number }) => {
  if (data.title) {
    if (data.id?.startsWith(ESectionItemKind.Group)) {
      return (
        <div className={styles.group_title} id={data.id}>
          {data.title}
        </div>
      );
    }
    return (
      <div className={styles.section_title} id={data.id}>
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

const parseTreeData = (id: string, section: ISettingSection, order: number, depth: number) => {
  let innerTreeData: IPreferenceTreeData | undefined;
  if (section.title) {
    innerTreeData = {
      label: section.title,
      section: section.title,
      groupId: id,
      order,
      indentOffset: depth === 1 ? -kBaseIndent : -(kBaseIndent >> 1),
      className: styles.index_item,
    } as IPreferenceTreeData;
  }
  const subTreeData = [] as IPreferenceTreeData[];
  if (section.subSections) {
    section.subSections.forEach((v, _i) => {
      const _treeData = parseTreeData(id, v, _i, depth + 1);
      _treeData && subTreeData.push(_treeData);
    });
  }
  if (innerTreeData && subTreeData && subTreeData.length > 0) {
    innerTreeData.children = subTreeData;
    innerTreeData.expandable = true;
  }
  return innerTreeData;
};

interface PreferenceIndexesProps {
  treeData: IPreferenceTreeData[];
}

const PreferenceIndexes = (props: PreferenceIndexesProps) => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const { treeData } = props;

  return (
    <AutoSizer className={styles.preferences_indexes}>
      {({ width, height }) => (
        <BasicRecycleTree
          treeName={TREE_NAME}
          sortComparator={(a: IPreferenceTreeData, b: IPreferenceTreeData) => {
            if (typeof a.order !== 'undefined' && typeof b.order !== 'undefined') {
              return a.order > b.order ? 1 : a.order < b.order ? -1 : 0;
            }
            return undefined;
          }}
          height={height}
          width={width}
          itemHeight={26}
          baseIndent={kBaseIndent}
          indent={12}
          treeData={treeData}
          onClick={(_e, node) => {
            const treeData = node && ((node as any)._raw as IPreferenceTreeData);
            if (treeData) {
              if (treeData.section) {
                preferenceService.scrollToSection(treeData.section);
              } else if (treeData.groupId) {
                preferenceService.scrollToGroup(treeData.groupId);
              }
            }
          }}
          onReady={(handler) => {
            preferenceService.handleTreeHandler(handler);
          }}
        />
      )}
    </AutoSizer>
  );
};

interface PreferenceBodyProps {
  tabIndex: number;
  items: ISectionItemData[];
}

const PreferenceBody = (props: PreferenceBodyProps) => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const [focusItem, setFocusItem] = useState<string | undefined>(undefined);

  const { items } = props;

  useEffect(() => {
    if (focusItem && preferenceService.treeHandler?.focusItem) {
      preferenceService.treeHandler.focusItem(focusItem);
    }
  }, [props.tabIndex, preferenceService.treeHandler, focusItem]);

  const navigateTo = (id: string) => {
    if (id) {
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) {
        preferenceService.listHandler?.scrollToIndex({
          index,
          behavior: 'auto',
          align: 'start',
        });
      }
    }
  };

  const onRangeChanged = useThrottleFn(
    (range: IVirtualListRange) => {
      // 我们通过第一个 item 来变更左侧文件树的选择状态
      // 当我们点击左侧的 section 的时候，我们的设计是让每一个 section 的 title 滚到顶部
      // 此时仍然会触发该事件，但有时可能因为计算取整等原因，它上报的 startIndex 是 title 的上一个 index。
      // 我们在这里 +1 就是防止因为计算错误而取到上一个章节的 _path 的情况。
      const item = items[range.startIndex + 1];
      if (item && item._path) {
        setFocusItem(item._path);
      }
    },
    FRAME_THREE,
    {
      leading: true,
      trailing: true,
    },
  );

  const currentSelectId = useEventDrivenState(
    preferenceService.emitter,
    'currentSelectIdChange',
    () => preferenceService.currentSelectId,
  );

  useEffect(() => {
    if (currentSelectId) {
      navigateTo(currentSelectId);
    }
  }, [items, currentSelectId]);

  return (
    <div className={styles.preferences_items}>
      <VirtualList
        data={items}
        template={PreferenceItem as React.FunctionComponent<{ data: ISectionItemData; index: number }>}
        className={styles.preference_section}
        refSetter={preferenceService.handleListHandler}
        onRangeChanged={onRangeChanged.run}
      />
    </div>
  );
};
