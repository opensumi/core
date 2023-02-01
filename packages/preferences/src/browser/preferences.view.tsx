import debounce from 'lodash/debounce';
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  Input,
  ComponentContextProvider,
  Tabs,
  IIconResourceOptions,
  BasicRecycleTree,
  IBasicTreeData,
} from '@opensumi/ide-components';
import { VirtualList } from '@opensumi/ide-components/lib/virtual-list';
import { IVirtualListRange } from '@opensumi/ide-components/lib/virtual-list/types';
import {
  useInjectable,
  localize,
  formatLocalize,
  ISettingGroup,
  IPreferenceSettingsService,
  ISettingSection,
  getIcon,
  URI,
  LabelService,
  IResolvedSettingSection,
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

const usePreferenceGroups = () => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const [groups, setGroups] = useState<ISettingGroup[]>([]);

  const updateGroup = useThrottleFn(() => {
    const _groups = preferenceService.getSettingGroups(preferenceService.currentScope, preferenceService.currentSearch);
    const oldGroupKey = groups.map((n) => n.id).join(',');
    const newGroupKey = _groups.map((n) => n.id).join(',');
    if (oldGroupKey !== newGroupKey) {
      setGroups(toJS(_groups, { recurseEverything: true }));
    }
  }, 16);

  useEffect(() => {
    updateGroup.run();
  }, [
    preferenceService.settingsGroups.length,
    preferenceService.getSettingGroups,
    preferenceService.currentScope,
    preferenceService.currentSearch,
    preferenceService.settingsSections,
  ]);

  return groups;
};

export const PreferenceView: ReactEditorComponent<null> = observer(() => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const groups = usePreferenceGroups();
  const labelService = useInjectable<LabelService>(LabelService);
  const getResourceIcon = React.useCallback(
    (uri: string, options: IIconResourceOptions) => labelService.getIcon(URI.parse(uri), options),
    [],
  );

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const debouncedSearch = debounce(
    (value: string) => {
      preferenceService.search(value);
    },
    100,
    { maxWait: 300 },
  );

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

  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <div className={styles.preferences}>
        <div className={styles.preferences_header}>
          <Tabs
            className={styles.tabs}
            value={preferenceService.tabIndex}
            onChange={(index: number) => {
              preferenceService.tabIndex = index;
            }}
            tabs={preferenceService.tabList.map((n) => localize(n.label))}
          />
          <div className={styles.search_pref}>
            <Input
              autoFocus
              value={preferenceService.currentSearch}
              placeholder={localize('preference.searchPlaceholder')}
              onValueChange={debouncedSearch}
              ref={inputRef}
              hasClear
            />
          </div>
        </div>
        {groups.length > 0 ? (
          <SplitPanel
            id='preference-panel'
            resizeHandleClassName={styles.devider}
            className={styles.preferences_body}
            direction={EDirection.LeftToRight}
          >
            <PreferenceIndexes data-sp-defaultSize={180} data-sp-minSize={150} />
            <PreferenceBody data-sp-flex={1} />
          </SplitPanel>
        ) : (
          <div className={styles.preference_noResults}>
            {preferenceService.currentSearch
              ? formatLocalize('preference.noResults', preferenceService.currentSearch)
              : formatLocalize('preference.empty')}
          </div>
        )}
      </div>
    </ComponentContextProvider>
  );
});

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

const parseTreeData = (id: string, section: ISettingSection, i: number) => {
  let innerTreeData: IPreferenceTreeData | undefined;
  if (section.title) {
    innerTreeData = {
      label: section.title,
      section: section.title,
      groupId: id,
      order: i,
    } as IPreferenceTreeData;
  }
  const subTreeData = [] as IPreferenceTreeData[];
  if (section.subSections) {
    section.subSections.forEach((v, _i) => {
      const _treeData = parseTreeData(id, v, _i);
      _treeData && subTreeData.push(_treeData);
    });
  }
  if (innerTreeData && subTreeData && subTreeData.length > 0) {
    innerTreeData.children = subTreeData;
    innerTreeData.expandable = true;
  }
  return innerTreeData;
};

const PreferenceIndexes = observer(() => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const groups = usePreferenceGroups();

  const treeData = React.useMemo(() => {
    if (!groups || groups.length === 0) {
      return [];
    }

    const basicTreeData = [] as IPreferenceTreeData[];
    for (let index = 0; index < groups.length; index++) {
      const { id, title, iconClass } = groups[index];
      const data = {
        label: toNormalCase(title),
        iconClassName: iconClass,
        groupId: id,
        order: index,
      } as IPreferenceTreeData;
      const children = [] as IPreferenceTreeData[];
      const sections = preferenceService.getResolvedSections(id);
      sections.forEach((sec, i) => {
        const _treeData = parseTreeData(id, sec, i);
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
  }, [groups, preferenceService.getResolvedSections, preferenceService.currentScope, preferenceService.currentSearch]);

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
          getItemClassName={(item) => {
            if (item?.depth === 1) {
              return styles.group_item;
            }
            return styles.index_item;
          }}
          baseIndent={8}
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
});

export const PreferenceBody = observer(() => {
  const preferenceService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const groups = usePreferenceGroups();
  const [focusItem, setFocusItem] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (focusItem && preferenceService.treeHandler?.focusItem) {
      preferenceService.treeHandler.focusItem(focusItem);
    }
  }, [preferenceService.tabIndex, preferenceService.treeHandler, focusItem]);

  const items = React.useMemo(() => {
    // 如果是搜索模式，是只展示用户左侧选择的组的内容
    const result: ISectionItemData[] = [];
    groups.forEach((v) => {
      result.push(...collectGroup(v));
    });
    return result;

    function collectGroup(group: ISettingGroup) {
      const groupItems = [] as ISectionItemData[];
      const sections = preferenceService.getResolvedSections(group.id);

      const collectItem = (section: IResolvedSettingSection, prefix = '') => {
        let currentItemPath = prefix;
        if (section.title) {
          currentItemPath = prefix + '/' + section.title;
        }

        const innerItems = [] as ISectionItemData[];

        if (section.component) {
          innerItems.push({
            component: section.component,
            scope: preferenceService.currentScope,
          });
        } else if (section.preferences) {
          innerItems.push(
            ...section.preferences.map((pre) => ({
              id: ESectionItemKind.Preference + pre.id,
              preference: pre,
              scope: preferenceService.currentScope,
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
            scope: preferenceService.currentScope,
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
          scope: preferenceService.currentScope,
          _path: group.title,
        });
      }
      return groupItems;
    }
  }, [groups, preferenceService.getResolvedSections, preferenceService.currentScope, preferenceService.currentSearch]);

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
    16 * 3,
    {
      leading: true,
      trailing: true,
    },
  );

  React.useEffect(() => {
    if (preferenceService.currentSelectId) {
      navigateTo(preferenceService.currentSelectId);
    }
  }, [items, preferenceService.currentSelectId]);

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
});
