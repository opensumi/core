import React from 'react';
import type { ICell, MultilineString } from '@difizen/libro-common';
import { LibroContentService } from '@difizen/libro-core';
import type { ViewComponent } from '@difizen/mana-app';
import {
  BaseView,
  getOrigin,
  inject,
  prop,
  transient,
  useInject,
  view,
  ViewInstance,
  ViewOption,
} from '@difizen/mana-app';
import { ColumnHeightOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import { forwardRef, useEffect } from 'react';
import { ContentSameIcon } from './components/libro-diff-all-cells-same-components';
const LibroDiffAddedCellComponent = () => <div>Mock Added Cell Component</div>;
const LibroDiffChangedCellComponent = () => <div>Mock Changed Cell Component</div>;
const LibroDiffRemovedCellComponent = () => <div>Mock Removed Cell Component</div>;
const LibroDiffUnchangedCellComponent = () => <div>Mock Unchanged Cell Component</div>;

import './index.less';
import type {
  DiffArrayItem,
  DiffCellItemResult,
  DiffView,
  IDiffNotebookContent,
} from './libro-diff-protocol';
import {
  DiffCellItem,
  DiffCellUnchangedItems,
  DiffOption,
  libroDiffViewFactoryId,
} from './libro-diff-protocol';
import { ContentLoaderType } from '../../mana';

function comparator(compareLeft: ICell, compareRight: ICell) {
  return compareLeft.id === compareRight.id;
}

function multilineStringEqual(a: MultilineString, b: MultilineString) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
export const LibroDiffRender = forwardRef(() => {
  const libroDiffView = useInject<LibroDiffView>(ViewInstance);
  useEffect(() => {}, [
    libroDiffView.diffUnchangedCellsRenderStatus,
    libroDiffView.diffCellsResult,
    libroDiffView.isDiffSame,
  ]);
  if (!libroDiffView.diffCellsResult)
    return (
      <div className="libro-diff-content-loading-container">
        <Spin size="large" />
      </div>
    );

  if (libroDiffView.isDiffSame) {
    return (
      <div className="libro-diff-content-same-container">
        <ContentSameIcon />
        <span className="libro-diff-content-same-text">内容一致</span>
      </div>
    );
  }

  return (
    <div className="libro-diff-content-container">
      {libroDiffView.diffCellsResult &&
        libroDiffView.diffCellsResult.map(item => {
          if (DiffCellItem.is(item) && item.diffType === 'added') {
            return (
              <LibroDiffAddedCellComponent
                diffCellResultItem={item}
                key={libroDiffView.id + item.origin.id?.toString()}
              />
            );
          } else if (DiffCellItem.is(item) && item.diffType === 'removed') {
            return (
              <LibroDiffRemovedCellComponent
                diffCellResultItem={item}
                key={libroDiffView.id + item.origin.id?.toString()}
              />
            );
          } else if (DiffCellItem.is(item) && item.diffType === 'changed') {
            return (
              <LibroDiffChangedCellComponent
                diffCellResultItem={item}
                key={libroDiffView.id + item.origin.id?.toString()}
              />
            );
          } else {
            if (!DiffCellUnchangedItems.is(item) || item.unchangedResultItems.length === 0)
              return null;
            if (item.isShown) {
              return item.unchangedResultItems.map(unchangedItem => (
                <LibroDiffUnchangedCellComponent
                  diffCellResultItem={unchangedItem}
                  key={libroDiffView.id + unchangedItem.origin.id?.toString()}
                />
              ));
            } else {
              return (
                <div
                  className="libro-diff-fold-container"
                  key={libroDiffView.id + item.unchangedResultItems[0].origin.id}
                >
                  <div
                    className="libro-diff-fold"
                    onClick={() => {
                      item.isShown = true;
                      libroDiffView.diffUnchangedCellsRenderStatus =
                        libroDiffView.getUnchangedDiffCellsRenderStatus();
                    }}
                  >
                    <ColumnHeightOutlined />
                    <span className="libro-diff-fold-text">
                      展开{item.unchangedResultItems.length}个未更改的 Cell
                    </span>
                  </div>
                </div>
              );
            }
          }
        })}
    </div>
  );
});

@transient()
@view(libroDiffViewFactoryId)
export class LibroDiffView extends BaseView implements DiffView {
  view: ViewComponent = LibroDiffRender;
  libroContentService: LibroContentService;
  @prop()
  diffUnchangedCellsRenderStatus: 'all' | 'part' | 'none' = 'none';
  @prop()
  diffCellsResult: DiffCellItemResult[];
  @prop()
  isDiffSame: boolean = true;
  @prop()
  hasUnchangedCells: boolean = false;
  options: Record<string, any>;
  originContent: IDiffNotebookContent;
  targetContent: IDiffNotebookContent;
  constructor(
    @inject(ViewOption) options: DiffOption,
    @inject(LibroContentService) libroContentService: LibroContentService,
  ) {
    super();
    this.libroContentService = libroContentService;
    this.options = options;
    this.loadDiffContent(options).then(() => {
      this.diffCellsResult = this.getDiffCellsResult(
        this.originContent.content.cells,
        this.targetContent.content.cells,
      );
    });
  }

  loadDiffContent = async (options: DiffOption) => {
    const originContent = await this.libroContentService.loadLibroContent(
      { loadType: ContentLoaderType, resource: options.origin },
      this,
    );
    this.originContent = {
      diffTag: options.originFilePath,
      content: originContent,
    };
    const targetContent = await this.libroContentService.loadLibroContent(
      { loadType: ContentLoaderType, resource: options.target },
      this,
    );
    this.targetContent = {
      diffTag: options.targetFilePath,
      content: targetContent,
    };
  };

  foldAllUnchangedDiffCells = () => {
    this.diffCellsResult.map(item => {
      if (DiffCellUnchangedItems.is(item)) {
        item.isShown = false;
      }
    });
  };

  expandAllUnchangedDiffCells = () => {
    this.diffCellsResult.map(item => {
      if (DiffCellUnchangedItems.is(item)) {
        item.isShown = true;
      }
    });
  };

  getUnchangedDiffCellsRenderStatus = () => {
    let unchanedDiffCellsGroups = 0;
    let unchanedDiffCellsfolded = 0;
    let unchanedDiffCellsExpanded = 0;
    for (const item of this.diffCellsResult) {
      if (DiffCellUnchangedItems.is(item)) {
        unchanedDiffCellsGroups = unchanedDiffCellsGroups + 1;
        if (item.isShown) {
          unchanedDiffCellsExpanded = unchanedDiffCellsExpanded + 1;
        } else {
          unchanedDiffCellsfolded = unchanedDiffCellsfolded + 1;
        }
      }
    }
    if (unchanedDiffCellsfolded > 0) {
      return unchanedDiffCellsExpanded > 0 ? 'part' : 'none';
    } else {
      return 'all';
    }
  };

  getAddedCellResult = (valueItem: ICell) => {
    const originDiffCellItem = JSON.parse(JSON.stringify(valueItem)) as ICell;
    originDiffCellItem.source = '';
    const addedCellResult: DiffCellItem = {
      diffType: 'added',
      origin: originDiffCellItem,
      target: valueItem,
    };
    return addedCellResult;
  };

  getRemovedCellResult = (valueItem: ICell) => {
    const targetDiffCellItem = JSON.parse(JSON.stringify(valueItem)) as ICell;
    targetDiffCellItem.source = '';
    const removedCellResult: DiffCellItem = {
      diffType: 'removed',
      origin: valueItem,
      target: targetDiffCellItem,
    };
    return removedCellResult;
  };

  getUnchangedCellResult = (originItem: ICell, targetItem: ICell) => {
    const unchangedCellResult: DiffCellItem = {
      diffType: 'unchanged',
      origin: originItem,
      target: targetItem,
    };
    return unchangedCellResult;
  };

  getChangedCellResult = (originItem: ICell, targetItem: ICell) => {
    const changedCellResult: DiffCellItem = {
      diffType: 'changed',
      origin: originItem,
      target: targetItem,
    };
    return changedCellResult;
  };

  getDiffCellsResult = (origin: ICell[], target: ICell[]) => {
    const diffCellsResult: DiffCellItemResult[] = [];
    let diffCellUnchangedItems: DiffCellItem[] = [];
    let lastDiffItemTypeIsUnchanged: boolean = false;

    const Diff = require('diff');
    const diffArray = Diff.diffArrays(getOrigin(origin), getOrigin(target), {
      comparator: comparator,
    }) as DiffArrayItem[];
    diffArray.map((item, index) => {
      if (item.added) {
        if (this.isDiffSame) this.isDiffSame = false;
        if (lastDiffItemTypeIsUnchanged === true) {
          lastDiffItemTypeIsUnchanged = false;
          diffCellsResult.push({
            isShown: false,
            unchangedResultItems: diffCellUnchangedItems,
          });
          diffCellUnchangedItems = [];
        }
        item.value.map(valueItem => {
          diffCellsResult.push(this.getAddedCellResult(valueItem));
        });
      } else if (item.removed) {
        if (this.isDiffSame) this.isDiffSame = false;
        if (lastDiffItemTypeIsUnchanged === true) {
          lastDiffItemTypeIsUnchanged = false;
          diffCellsResult.push({
            isShown: false,
            unchangedResultItems: diffCellUnchangedItems,
          });
          diffCellUnchangedItems = [];
        }
        item.value.map(valueItem => {
          diffCellsResult.push(this.getRemovedCellResult(valueItem));
        });
      } else {
        item.value.map(valueItem => {
          const originCell = this.originContent.content.cells.find(
            cell => cell.id === valueItem.id,
          );
          const targetCell = this.targetContent.content.cells.find(
            cell => cell.id === valueItem.id,
          );
          if (!originCell || !targetCell) return;
          if (multilineStringEqual(originCell.source, targetCell.source)) {
            if (this.hasUnchangedCells === false) this.hasUnchangedCells = true;
            lastDiffItemTypeIsUnchanged = true;
            diffCellUnchangedItems.push(this.getUnchangedCellResult(originCell, targetCell));
          } else {
            if (this.isDiffSame) this.isDiffSame = false;
            if (lastDiffItemTypeIsUnchanged === true) {
              lastDiffItemTypeIsUnchanged = false;
              diffCellsResult.push({
                isShown: false,
                unchangedResultItems: diffCellUnchangedItems,
              });
              diffCellUnchangedItems = [];
            }
            diffCellsResult.push(this.getChangedCellResult(originCell, targetCell));
          }
        });
        if (index === diffArray.length - 1) {
          diffCellsResult.push({
            isShown: false,
            unchangedResultItems: diffCellUnchangedItems,
          });
        }
      }
    });
    return diffCellsResult;
  };
}
