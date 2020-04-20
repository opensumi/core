import * as React from 'react';
import { IDialogService, ISaveDialogOptions, IOpenDialogOptions } from '@ali/ide-overlay';
import { useInjectable, localize, isOSX } from '@ali/ide-core-browser';
import { Button, Input, Select, Option, RecycleTree, IRecycleTreeHandle, INodeRendererProps, TreeNodeType } from '@ali/ide-components';
import { FileTreeDialogModel } from './file-dialog-model.service';
import { Directory, File } from '../file-tree-nodes';
import { FileTreeDialogNode } from './file-dialog-node';
import * as styles from './file-dialog.module.less';
import * as path from '@ali/ide-core-common/lib/utils/paths';

export interface IFileDialogProps {
  options: ISaveDialogOptions | IOpenDialogOptions;
  model: FileTreeDialogModel;
}

export const FILE_TREE_DIALOG_HEIGHT = 22;

export const FileDialog = (
  {
    options,
    model,
   }: React.PropsWithChildren<IFileDialogProps>,
) => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();
  const [saveOrOpenValue] = React.useState<string[]>([]);
  const [fileName, setFileName] = React.useState<string>((options as ISaveDialogOptions).defaultFileName || '');
  const [isReady, setIsReady] = React.useState<boolean>(false);

  React.useEffect(() => {
    ensureIsReady();
    return () => {
      model.removeFileDecoration();
    };
  }, []);

  const hide = (value?: string[]) => {
    // 如果有文件名的，说明是保存文件的情况
    if (fileName && (options as ISaveDialogOptions).showNameInput && (value?.length === 1 || options.defaultUri)) {
      const filePath = value?.length === 1 ? value[0] : options.defaultUri!.path.toString();
      dialogService.hide([path.resolve(filePath!, fileName)]);
    } else {
      dialogService.hide(value);
    }
  };

  const close = () => {
    dialogService.hide();
  };

  const ensureIsReady = async () => {
    await model.whenReady;
    // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
    // 这里需要重新取一下treeModel的值确保为最新的TreeModel
    await model.treeModel.root.ensureLoaded();
    setIsReady(true);
  };

  const isSaveDialog = !IOpenDialogOptions.is(options) && ISaveDialogOptions.is(options);
  const isNormalDialog = !IOpenDialogOptions.is(options) && !ISaveDialogOptions.is(options);

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    model.handleTreeHandler({
      ...handle,
      getModel: () => model.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: Directory) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { toggleDirectory } = model;

    toggleDirectory(item);

  };

  const hasShiftMask = (event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  };

  const hasCtrlCmdMask = (event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  };

  const handleItemClicked = (ev: React.MouseEvent, item: File | Directory, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleItemClick, handleItemToggleClick, handleItemRangeClick } = model;
    if (!item) {
      return;
    }
    const shiftMask = hasShiftMask(event);
    const ctrlCmdMask = hasCtrlCmdMask(event);
    if (shiftMask) {
      handleItemRangeClick(item, type);
    } else if (ctrlCmdMask) {
      handleItemToggleClick(item, type);
    } else {
      handleItemClick(item, type);
    }
  };

  const onRootChangeHandler = (value: string) => {
    // TODO: Refresh Root
  };

  const directoryOptions = () => {
    const list = model.getDirectoryList();
    return list.map((item, idx) =>
    <Option value={item} key={`${idx} - ${item}`}>{
      item
    }</Option>);
  };

  if (!isReady) {
    return <div>loading...</div>;
  } else {
    if (isNormalDialog) {
      return (
        <React.Fragment>
          <div className={styles.file_dialog_directory_title}>{localize('dialog.file.title')}</div>
          <div className={styles.file_dialog_directory}>
            <Select
              onChange={onRootChangeHandler}
              className={styles.select_control}
              size={ 'small' }
              value={ model.treeModel.root.path }
            >
              {directoryOptions()}
            </Select>
          </div>
          <div className={styles.file_dialog_content} ref={wrapperRef}>
            <RecycleTree
              width = {425}
              height = {300}
              itemHeight={FILE_TREE_DIALOG_HEIGHT}
              onReady={handleTreeReady}
              model={model.treeModel}
            >
              {(props: INodeRendererProps) => <FileTreeDialogNode
                item={props.item}
                itemType={props.itemType}
                labelService={model.labelService}
                decorations={model.decorations.getDecorations(props.item as any)}
                onClick={handleItemClicked}
                onTwistierClick={handleTwistierClick}
                defaultLeftPadding={8}
                leftPadding={8}
              />}
            </RecycleTree>
          </div>
          <div className={styles.buttonWrap}>
            <Button onClick={() => close()} type='secondary' className={styles.button}>{localize('dialog.file.close')}</Button>
            <Button onClick={() => hide(saveOrOpenValue)} type='primary' className={styles.button}>{localize('dialog.file.ok')}</Button>
          </div>
        </React.Fragment>
      );
    } else if (isSaveDialog) {
      return (
        <React.Fragment>
          <div className={styles.file_dialog_directory_title}>{ (options as ISaveDialogOptions).saveLabel || localize('dialog.file.saveLabel')}</div>
          <div className={styles.file_dialog_directory}>
            {/* <Select onChange={onRootChangeHandler}
              className={styles.select_control}
            >
              {directoryOptions}
            </Select> */}
          </div>
          <div className={styles.file_dialog_content}>

          </div>
          {(options as ISaveDialogOptions).showNameInput && (
            <div className={styles.file_dialog_file_container}>
              <span className={styles.file_dialog_file_name}>{localize('dialog.file.name')}: </span>
              <Input size='small' value={fileName} autoFocus={true} selection={{ start: 0, end: fileName.length }} onChange={(event) => setFileName(event.target.value)}></Input>
            </div>
          )}
          <div className={styles.buttonWrap}>
            <Button onClick={() => close()} type='secondary' className={styles.button}>{localize('dialog.file.close')}</Button>
            <Button onClick={() => hide(saveOrOpenValue)} type='primary' className={styles.button} disabled={(options as ISaveDialogOptions).showNameInput && fileName.length === 0 ? true : false }>{localize('dialog.file.ok')}</Button>
          </div>
        </React.Fragment>
      );
    } else {
      return (
        <React.Fragment>
          <div className={styles.file_dialog_directory_title}>{ (options as IOpenDialogOptions).openLabel || localize('dialog.file.openLabel')}</div>
          <div className={styles.file_dialog_directory}>
            {/* <Select onChange={onRootChangeHandler}
              className={styles.select_control}
            >
              {directoryOptions}
            </Select> */}
          </div>
          <div className={styles.file_dialog_content}>

          </div>
          <div className={styles.buttonWrap}>
            <Button onClick={() => close()} type='secondary' className={styles.button}>{localize('dialog.file.close')}</Button>
            <Button onClick={() => hide(saveOrOpenValue)} type='primary' className={styles.button}>{localize('dialog.file.ok')}</Button>
          </div>
        </React.Fragment>
      );
    }
  }
};
