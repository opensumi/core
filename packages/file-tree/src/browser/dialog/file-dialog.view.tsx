import * as React from 'react';
import { IDialogService, ISaveDialogOptions, IOpenDialogOptions } from '@ali/ide-overlay';
import { useInjectable, localize, URI, TreeNode } from '@ali/ide-core-browser';
import { Button, Input, Select } from '@ali/ide-components';
import * as path from '@ali/ide-core-common/lib/utils/paths';

import { FileDialogService } from './file-dialog.service';
import { FileDialogTree } from './file-dialog.tree';
import { Directory, File } from '../file-tree-item';

import * as styles from './file-dialog.module.less';

export const FileDialog = (
  { options }: React.PropsWithChildren<{
    options: ISaveDialogOptions | IOpenDialogOptions,
  }>,
) => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const {
    labelService,
    getFiles,
    getDirectoryList,
  }: FileDialogService = useInjectable<FileDialogService>(FileDialogService);
  const [node, setNode] = React.useState<Directory | File | undefined>();
  const [saveOrOpenValue, setSaveOrOpenValue] = React.useState<string[]>([]);
  const [ fileName, setFileName] = React.useState<string>((options as ISaveDialogOptions).defaultFileName || '');

  function hide(value?: string[]) {
    // 如果有文件名的，说明是保存文件的情况
    if (fileName && (options as ISaveDialogOptions).showNameInput && (value?.length === 1 || options.defaultUri)) {
      const filePath = value?.length === 1 ? value[0] : options.defaultUri!.path.toString();
      dialogService.hide([path.resolve(filePath!, fileName)]);
    } else {
      dialogService.hide(value);
    }
  }

  function close() {
    dialogService.hide();
  }

  React.useEffect(() => {
    getFiles(options.defaultUri).then((file) => {
      setNode(file);
    });
  }, []);

  const onChangeHandler = (event) => {
    const value = event.target.value;
    getFiles(URI.file(value!)).then((file) => {
      setNode(file);
    });
  };

  const onSelectHandler = (nodes: TreeNode<any>) => {
    const values = nodes.map((node) => {
      return node.uri.withoutScheme().toString();
    });
    setSaveOrOpenValue(values);
  };

  const isSaveDialog = !IOpenDialogOptions.is(options) && ISaveDialogOptions.is(options);
  // const isOpenDialog = IOpenDialogOptions.is(options) && !ISaveDialogOptions.is(options);
  const isNormalDialog = !IOpenDialogOptions.is(options) && !ISaveDialogOptions.is(options);

  const directoryOptions = getDirectoryList().map((item, idx) =>
    <option value={item} key={`${idx} - ${item}`}>{
      item
    }</option>);

  if (!node) {
    return <div>loading...</div>;
  } else {
    if (isNormalDialog) {
      return (
        <React.Fragment>
          <div className={styles.file_dialog_directory_title}>{localize('dialog.file.title')}</div>
          <div className={styles.file_dialog_directory}>
            <Select onChange={onChangeHandler}
              className={styles.select_control}
            >
              {directoryOptions}
            </Select>
          </div>
          <div className={styles.file_dialog_content}>
            <FileDialogTree
              width = {425}
              height = {300}
              expandedOnFirst = {true}
              onSelect = {onSelectHandler}
              node = {node}
              labelService = {labelService}
              canSelectFiles = {false}
              multiSelectable = {false}
            />
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
            <Select onChange={onChangeHandler}
              className={styles.select_control}
            >
              {directoryOptions}
            </Select>
          </div>
          <div className={styles.file_dialog_content}>
            <FileDialogTree
              width = {425}
              height = {300}
              expandedOnFirst = {true}
              onSelect = {onSelectHandler}
              node = {node}
              labelService = {labelService}
              canSelectFiles = {false}
              multiSelectable = {false}
            />
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
            <Select onChange={onChangeHandler}
              className={styles.select_control}
            >
              {directoryOptions}
            </Select>
          </div>
          <div className={styles.file_dialog_content}>
            <FileDialogTree
              width = {425}
              height = {300}
              expandedOnFirst = {true}
              onSelect = {onSelectHandler}
              node = {node}
              labelService = {labelService}
              multiSelectable = {(options as IOpenDialogOptions).canSelectMany}
              canSelectFiles = {(options as IOpenDialogOptions).canSelectFiles}
              canSelectFolders = {(options as IOpenDialogOptions).canSelectFolders}
            />
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
