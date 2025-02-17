import { ColumnHeightOutlined } from '@ant-design/icons';
import { LibroContentService } from '@difizen/libro-core';
import {
  BaseView,
  ViewInstance,
  ViewOption,
  getOrigin,
  inject,
  prop,
  transient,
  useInject,
  view,
} from '@difizen/mana-app';
import { Spin } from 'antd';
import { diffArrays } from 'diff';
import React, { forwardRef, useEffect } from 'react';

import './index.less';
import { ContentLoaderType } from '../../mana';

import { ContentSameIcon } from './components/libro-diff-all-cells-same-components';
import { LibroDiffChangedCellComponent } from './components/libro-diff-changed-cell-components';
import { LibroDiffSideCellComponent } from './components/libro-diff-side-cell-components';
import { DiffCellItem, DiffCellUnchangedItems, DiffOption, libroDiffViewFactoryId } from './libro-diff-protocol';

import type { DiffArrayItem, DiffCellItemResult, DiffView, IDiffNotebookContent } from './libro-diff-protocol';
import type { ICell, MultilineString } from '@difizen/libro-common';
import type { ViewComponent } from '@difizen/mana-app';

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
  if (!libroDiffView.diffCellsResult) {
    return (
      <div className='libro-diff-content-loading-container'>
        <Spin size='large' />
      </div>
    );
  }

  if (libroDiffView.isDiffSame) {
    return (
      <div className='libro-diff-content-same-container'>
        <ContentSameIcon />
        <span className='libro-diff-content-same-text'>内容一致</span>
      </div>
    );
  }

  return (
    <div className='libro-diff-content-container'>
      {libroDiffView.diffCellsResult &&
        libroDiffView.diffCellsResult.map((item) => {
          if (DiffCellItem.is(item) && item.diffType === 'added') {
            return (
              <LibroDiffSideCellComponent
                diffCellResultItem={item}
                key={libroDiffView.id + item.origin.id?.toString()}
              />
            );
          } else if (DiffCellItem.is(item) && item.diffType === 'removed') {
            return (
              <LibroDiffSideCellComponent
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
            if (!DiffCellUnchangedItems.is(item) || item.unchangedResultItems.length === 0) {
              return null;
            }
            if (item.isShown) {
              return item.unchangedResultItems.map((unchangedItem) => (
                <LibroDiffChangedCellComponent
                  diffCellResultItem={unchangedItem}
                  key={libroDiffView.id + unchangedItem.origin.id?.toString()}
                />
              ));
            } else {
              return (
                <div
                  className='libro-diff-fold-container'
                  key={libroDiffView.id + item.unchangedResultItems[0].origin.id}
                >
                  <div
                    className='libro-diff-fold'
                    onClick={() => {
                      item.isShown = true;
                      libroDiffView.diffUnchangedCellsRenderStatus = libroDiffView.getUnchangedDiffCellsRenderStatus();
                    }}
                  >
                    <ColumnHeightOutlined />
                    <span className='libro-diff-fold-text'>展开{item.unchangedResultItems.length}个未更改的 Cell</span>
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
  targetFilePath: string;
  originFilePath: string;
  constructor(
    @inject(ViewOption) options: DiffOption,
    @inject(LibroContentService) libroContentService: LibroContentService,
  ) {
    super();
    this.libroContentService = libroContentService;
    this.options = options;
    this.targetFilePath = options.target.path.toString();
    this.originFilePath = options.origin.path.toString();
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
      // FIXME: 干啥的？
      diffTag: options.origin.toString(),
      content: originContent,
    };
    const targetContent = await this.libroContentService.loadLibroContent(
      { loadType: ContentLoaderType, resource: options.target },
      this,
    );
    this.targetContent = {
      diffTag: options.target.toString(),
      content: targetContent,
    };
  };

  foldAllUnchangedDiffCells = () => {
    this.diffCellsResult.map((item) => {
      if (DiffCellUnchangedItems.is(item)) {
        item.isShown = false;
      }
    });
  };

  expandAllUnchangedDiffCells = () => {
    this.diffCellsResult.map((item) => {
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
    return Object.assign(addedCellResult, {
      originFilePath: this.originFilePath,
      targetFilePath: this.targetFilePath,
    });
  };

  getRemovedCellResult = (valueItem: ICell) => {
    const targetDiffCellItem = JSON.parse(JSON.stringify(valueItem)) as ICell;
    targetDiffCellItem.source = '';
    const removedCellResult: DiffCellItem = {
      diffType: 'removed',
      origin: valueItem,
      target: targetDiffCellItem,
    };
    return Object.assign(removedCellResult, {
      originFilePath: this.originFilePath,
      targetFilePath: this.targetFilePath,
    });
  };

  getUnchangedCellResult = (originItem: ICell, targetItem: ICell) => {
    const unchangedCellResult: DiffCellItem = {
      diffType: 'unchanged',
      origin: originItem,
      target: targetItem,
    };
    return Object.assign(unchangedCellResult, {
      originFilePath: this.originFilePath,
      targetFilePath: this.targetFilePath,
    });
  };

  getChangedCellResult = (originItem: ICell, targetItem: ICell) => {
    const changedCellResult: DiffCellItem = {
      diffType: 'changed',
      origin: originItem,
      target: targetItem,
    };
    return Object.assign(changedCellResult, {
      originFilePath: this.originFilePath,
      targetFilePath: this.targetFilePath,
    });
  };

  getDiffCellsResult = (origin: ICell[], target: ICell[]) => {
    const diffCellsResult: (DiffCellItemResult & { originFilePath?: string; targetFilePath?: string })[] = [];
    let diffCellUnchangedItems: (DiffCellItem & { originFilePath: string; targetFilePath: string })[] = [];
    let lastDiffItemTypeIsUnchanged: boolean = false;

    const diffArray = diffArrays(getOrigin(origin), getOrigin(target), {
      comparator,
    }) as DiffArrayItem[];
    diffArray.map((item, index) => {
      if (item.added) {
        if (this.isDiffSame) {
          this.isDiffSame = false;
        }
        if (lastDiffItemTypeIsUnchanged === true) {
          lastDiffItemTypeIsUnchanged = false;
          diffCellsResult.push({
            isShown: false,
            unchangedResultItems: diffCellUnchangedItems,
          });
          diffCellUnchangedItems = [];
        }
        item.value.map((valueItem) => {
          diffCellsResult.push(this.getAddedCellResult(valueItem));
        });
      } else if (item.removed) {
        if (this.isDiffSame) {
          this.isDiffSame = false;
        }
        if (lastDiffItemTypeIsUnchanged === true) {
          lastDiffItemTypeIsUnchanged = false;
          diffCellsResult.push({
            isShown: false,
            unchangedResultItems: diffCellUnchangedItems,
          });
          diffCellUnchangedItems = [];
        }
        item.value.map((valueItem) => {
          diffCellsResult.push(this.getRemovedCellResult(valueItem));
        });
      } else {
        item.value.map((valueItem) => {
          const originCell = this.originContent.content.cells.find((cell) => cell.id === valueItem.id);
          const targetCell = this.targetContent.content.cells.find((cell) => cell.id === valueItem.id);
          if (!originCell || !targetCell) {
            return;
          }
          if (multilineStringEqual(originCell.source, targetCell.source)) {
            if (this.hasUnchangedCells === false) {
              this.hasUnchangedCells = true;
            }
            lastDiffItemTypeIsUnchanged = true;
            diffCellUnchangedItems.push(this.getUnchangedCellResult(originCell, targetCell));
          } else {
            if (this.isDiffSame) {
              this.isDiffSame = false;
            }
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
