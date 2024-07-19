import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  INodeRendererProps,
  IRecycleTreeHandle,
  Input,
  Option,
  RecycleTree,
  Select,
  TreeNodeType,
} from '@opensumi/ide-components';
import { URI, isMacintosh, localize, path, useInjectable } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { IDialogService, IOpenDialogOptions, ISaveDialogOptions } from '@opensumi/ide-overlay';

import { Directory, File } from '../../common/file-tree-node.define';

import { FileTreeDialogModel } from './file-dialog-model.service';
import { FileTreeDialogNode } from './file-dialog-node';
import styles from './file-dialog.module.less';

export interface IFileDialogProps {
  options: ISaveDialogOptions | IOpenDialogOptions;
  model: FileTreeDialogModel;
  isOpenDialog: boolean;
}

export const FILE_TREE_DIALOG_HEIGHT = 22;

export const FileDialog = ({ options, model, isOpenDialog }: React.PropsWithChildren<IFileDialogProps>) => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [selectPath, setSelectPath] = useState<string>('');
  const [directoryList, setDirectoryList] = useState<string[]>([]);

  useEffect(() => {
    if (model) {
      setIsReady(false);
      ensureIsReady();
    }
    return () => {
      model.dispose();
    };
  }, [model]);

  useEffect(() => {
    if ((options as ISaveDialogOptions).defaultFileName) {
      setFileName((options as ISaveDialogOptions).defaultFileName!);
    }
  }, [options]);

  useEffect(() => {
    if (isReady) {
      const list = model.getDirectoryList();
      setDirectoryList(list);
    }
  }, [isReady]);

  const hide = useCallback(() => {
    const value: string[] = model.selectedFiles.map((file) => file.uri.path.toString());
    // 如果有文件名的，说明肯定是保存文件的情况
    if (fileName && (options as ISaveDialogOptions).showNameInput && (value?.length === 1 || options.defaultUri)) {
      const filePath = value?.length === 1 ? value[0] : options.defaultUri!.path.toString();
      dialogService.hide([path.join(filePath!, fileName)]);
    } else {
      if (value.length > 0) {
        dialogService.hide(value);
      } else if (options.defaultUri) {
        dialogService.hide([options.defaultUri!.path.toString()]);
      } else if (model.treeModel && model.treeModel.root) {
        dialogService.hide([(model.treeModel.root as Directory).uri.path.toString()]);
      } else {
        dialogService.hide([]);
      }
    }
    setIsReady(false);
  }, [isReady, dialogService, model, fileName, options]);

  const close = useCallback(() => {
    setIsReady(false);
    dialogService.hide();
  }, [isReady, dialogService]);

  const ensureIsReady = useCallback(async () => {
    await model.whenReady;
    // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
    // 这里需要重新取一下treeModel的值确保为最新的TreeModel
    await model.treeModel.ensureReady;
    setSelectPath((model.treeModel.root as Directory).uri.codeUri.fsPath);
    setIsReady(true);
  }, [model, selectPath, isReady]);

  const isSaveDialog = !isOpenDialog;

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      model.handleTreeHandler({
        ...handle,
        getModel: () => model.treeModel,
        hasDirectFocus: () => wrapperRef.current === document.activeElement,
      });
    },
    [model],
  );

  const handleTwistierClick = useCallback(
    (ev: React.MouseEvent, item: Directory) => {
      // 阻止点击事件冒泡
      ev.stopPropagation();

      const { toggleDirectory } = model;

      toggleDirectory(item);
    },
    [model],
  );

  const hasShiftMask = useCallback((event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  }, []);

  const hasCtrlCmdMask = useCallback((event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isMacintosh && metaKey) || ctrlKey;
  }, []);

  const handleItemClicked = useCallback(
    (ev: React.MouseEvent, item: File | Directory, type: TreeNodeType) => {
      // 阻止点击事件冒泡
      ev.stopPropagation();

      const { handleItemClick, handleItemToggleClick, handleItemRangeClick } = model;
      if (!item) {
        return;
      }
      const shiftMask = hasShiftMask(event);
      const ctrlCmdMask = hasCtrlCmdMask(event);
      if (shiftMask && !isSaveDialog && (options as IOpenDialogOptions).canSelectMany) {
        handleItemRangeClick(item, type);
      } else if (ctrlCmdMask && !isSaveDialog && (options as IOpenDialogOptions).canSelectMany) {
        handleItemToggleClick(item, type);
      } else {
        if (isSaveDialog) {
          if (type === TreeNodeType.CompositeTreeNode) {
            handleItemClick(item, type);
          }
        } else {
          if ((options as IOpenDialogOptions).canSelectFiles && type === TreeNodeType.TreeNode) {
            const filterExts = new Set(
              Object.values((options as IOpenDialogOptions).filters ?? {})
                .flat()
                .map((item) => `.${item}`),
            );
            if (filterExts.size > 0) {
              const ext = URI.parse(item.filestat.uri).path.ext;
              if (filterExts.has(ext)) {
                handleItemClick(item, type);
              }
            } else {
              handleItemClick(item, type);
            }
          } else if ((options as IOpenDialogOptions).canSelectFolders && type === TreeNodeType.CompositeTreeNode) {
            handleItemClick(item, type);
          }
        }
      }
    },
    [model, isSaveDialog, options],
  );

  const onRootChangeHandler = useCallback(
    async (value: string) => {
      setIsReady(false);
      setSelectPath(value);
      await model.updateTreeModel(value);
      setIsReady(true);
    },
    [model, isReady, selectPath],
  );

  const renderDialogTreeNode = useCallback(
    (props: INodeRendererProps) => (
      <FileTreeDialogNode
        item={props.item}
        itemType={props.itemType}
        labelService={model.labelService}
        decorations={model.decorations.getDecorations(props.item as any)}
        onClick={handleItemClicked}
        onTwistierClick={handleTwistierClick}
        defaultLeftPadding={8}
        leftPadding={8}
      />
    ),
    [model.treeModel],
  );

  const renderDialogTree = useCallback(() => {
    if (!isReady) {
      return <Progress loading />;
    } else if (model.treeModel) {
      return (
        <RecycleTree
          height={300}
          itemHeight={FILE_TREE_DIALOG_HEIGHT}
          onReady={handleTreeReady}
          model={model.treeModel}
        >
          {renderDialogTreeNode}
        </RecycleTree>
      );
    }
  }, [isReady, model]);

  const renderDirectorySelection = useCallback(() => {
    if (directoryList.length > 0) {
      return (
        <Select onChange={onRootChangeHandler} className={styles.select_control} size={'small'} value={selectPath}>
          {directoryList.map((item, idx) => (
            <Option value={item} key={`${idx} - ${item}`}>
              {item}
            </Option>
          ))}
        </Select>
      );
    }
  }, [directoryList, selectPath]);

  if (isOpenDialog) {
    return (
      <div className={styles.file_dialog_wrapper}>
        <div className={styles.file_dialog_directory_title}>{options.title || localize('dialog.file.openLabel')}</div>
        <div className={styles.file_dialog_directory}>{renderDirectorySelection()}</div>
        <div className={styles.file_dialog_content} ref={wrapperRef}>
          {renderDialogTree()}
        </div>
        <div className={styles.file_dialog_buttons}>
          <Button onClick={() => close()} type='secondary' className={styles.button}>
            {localize('dialog.file.close')}
          </Button>
          <Button onClick={() => hide()} type='primary' className={styles.button}>
            {(options as IOpenDialogOptions).openLabel || localize('dialog.file.ok')}
          </Button>
        </div>
      </div>
    );
  } else {
    return (
      <div className={styles.file_dialog_wrapper}>
        <div className={styles.file_dialog_directory_title}>
          {(options as ISaveDialogOptions).saveLabel || localize('dialog.file.saveLabel')}
        </div>
        <div className={styles.file_dialog_directory}>{renderDirectorySelection()}</div>
        <div className={styles.file_dialog_content}>{renderDialogTree()}</div>
        {(options as ISaveDialogOptions).showNameInput && (
          <div className={styles.file_dialog_file_container}>
            <span className={styles.file_dialog_file_name}>{localize('dialog.file.name')}: </span>
            <Input
              size='small'
              value={fileName}
              autoFocus={true}
              selection={{ start: 0, end: fileName.indexOf('.') || fileName.length }}
              onChange={(event) => setFileName(event.target.value)}
            ></Input>
          </div>
        )}
        <div className={styles.file_dialog_buttons}>
          <Button onClick={() => close()} type='secondary' className={styles.button}>
            {localize('dialog.file.close')}
          </Button>
          <Button
            onClick={() => hide()}
            type='primary'
            className={styles.button}
            disabled={(options as ISaveDialogOptions).showNameInput && fileName.length === 0 ? true : false}
          >
            {localize('dialog.file.ok')}
          </Button>
        </div>
      </div>
    );
  }
};
