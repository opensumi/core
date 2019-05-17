import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { CloudFile } from '../common';
import { observer } from 'mobx-react-lite';
import FileTreeService from './file-tree.service';
import * as style from './index.less';

const FileItem = observer((props: { file: CloudFile }) => {
  return (
    <li>
      {props.file.name}
    </li>
  );
});

export const FileTree = observer(() => {
  const instance = useInjectable(FileTreeService);
  const files = instance.files;
  return (
    <div className={style.file_tree_container}>
      <h1 className={style.kt_filetree_header}>FileTree:</h1>
      <p><button onClick={ instance.createFile }>创建文件</button></p>
      <ul>
        {files && files.map((file) => (
          <FileItem key={file.path} file={file} />
        ))}
      </ul>
    </div>
  );
});
