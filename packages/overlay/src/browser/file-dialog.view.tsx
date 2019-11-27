import * as React from 'react';
import { IDialogService, ISaveDialogOptions, IOpenDialogOptions } from '../common';
import { Button } from '@ali/ide-core-browser/lib/components';
import * as styles from './dialog.module.less';
import { useInjectable, localize, URI, TreeNode } from '@ali/ide-core-browser';
import { observer } from 'mobx-react-lite';
import { FileDialogService } from './file-dialog.service';
import { FileDialogTree } from './file-dialog.tree';
import { Select } from '@ali/ide-core-browser/lib/components/select';

export const FileDialog = observer((
  { options }: {
    options: ISaveDialogOptions | IOpenDialogOptions,
  },
) => {
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const {
    labelService,
    getFiles,
    getDirectoryList,
  }: FileDialogService = useInjectable<FileDialogService>(FileDialogService);
  const [node, setNode] = React.useState();
  const [saveOrOpenValue, setSaveOrOpenValue] = React.useState<string[]>([]);

  function hide(value?: string[]) {
    dialogService.hide('1');
  }

  const noop = () => {};

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
      return node.uri.toString();
    });
    setSaveOrOpenValue(values);
  };

  const isSaveDialog = !IOpenDialogOptions.is(options) && ISaveDialogOptions.is(options);
  const isOpenDialog = IOpenDialogOptions.is(options) && !ISaveDialogOptions.is(options);
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
            <Button onClick={() => hide()} type='secondary' className={styles.button}>{localize('dialog.file.close')}</Button>
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
          <div className={styles.buttonWrap}>
            <Button onClick={() => hide()} type='secondary' className={styles.button}>{localize('dialog.file.close')}</Button>
            <Button onClick={() => hide(saveOrOpenValue)} type='primary' className={styles.button}>{localize('dialog.file.ok')}</Button>
          </div>
        </React.Fragment>
      );
    } else if (isOpenDialog) {
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
            <Button onClick={() => hide()} type='secondary' className={styles.button}>{localize('dialog.file.close')}</Button>
            <Button onClick={() => hide(saveOrOpenValue)} type='primary' className={styles.button}>{localize('dialog.file.ok')}</Button>
          </div>
        </React.Fragment>
      );
    }
  }
});
