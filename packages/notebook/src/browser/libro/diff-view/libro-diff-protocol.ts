import { concatMultilineString } from '@difizen/libro-common';

import type { ICell, INotebookContent } from '@difizen/libro-common';
import type { URI, View } from '@difizen/libro-common/app';

export const libroDiffViewFactoryId = 'libro-diff-view-factory';

export const getLibroCellType = (cell: ICell) => {
  const cellType = (cell.metadata?.libroCellType as string) ?? cell.cell_type;
  if (cellType === 'sql') {
    return 'SQL';
  }
  return cellType.charAt(0).toUpperCase() + cellType.slice(1);
};

export const getSource = (cell: ICell) => {
  let codeValue = concatMultilineString(cell.source);
  if (getLibroCellType(cell) === 'SQL' && codeValue.includes(',tmp_table:')) {
    codeValue = decodeURIComponent(escape(atob(codeValue.split(',tmp_table:')[0].substring(6))));
  }
  if (getLibroCellType(cell) === 'SQL' && codeValue.includes(',variable:')) {
    codeValue = decodeURIComponent(escape(atob(codeValue.split(',variable:')[0].substring(6))));
  }
  return codeValue;
};

export type DiffCellItemResult = DiffCellItem | DiffCellUnchangedItems;
export interface DiffView extends View {
  diffCellsResult: DiffCellItemResult[];
  originContent: IDiffNotebookContent;
  targetContent: IDiffNotebookContent;
  diffUnchangedCellsRenderStatus: 'all' | 'part' | 'none';
  options?: Record<string, any>;
}
export interface IDiffNotebookContent {
  content: INotebookContent;
  diffTag: string;
}

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';
export interface DiffCellItem {
  diffType: DiffType;
  origin: ICell;
  target: ICell;
}

export const DiffCellItem = {
  is: (arg: Record<any, any>): arg is DiffCellItem =>
    !!arg &&
    'diffType' in arg &&
    typeof (arg as any).diffType === 'string' &&
    'origin' in arg &&
    typeof (arg as any).origin === 'object' &&
    'target' in arg &&
    typeof (arg as any).target === 'object',
};

export interface DiffCellUnchangedItems {
  isShown: boolean;
  unchangedResultItems: DiffCellItem[];
}

export const DiffCellUnchangedItems = {
  is: (arg: Record<any, any>): arg is DiffCellUnchangedItems =>
    !!arg &&
    'isShown' in arg &&
    typeof (arg as any).isShown === 'boolean' &&
    'unchangedResultItems' in arg &&
    typeof (arg as any).unchangedResultItems === 'object',
};

export interface DiffArrayItem {
  count: number;
  added?: undefined | string;
  removed?: undefined | string;
  value: ICell[];
}

export interface DiffEditorProps {
  diffCellResultItem: DiffCellItem & { originFilePath?: string; targetFilePath?: string };
}

export const DiffOption = Symbol('DiffOption');
/**
 * LibroDiff 创建参数
 * 默认可 json 序列化
 */
export interface DiffOption {
  loadType: string;
  id?: string;
  origin: URI;
  target: URI;
  [key: string]: any;
}
