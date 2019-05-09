import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import Store from './file-tree.store';
import { CloudFile } from '../common';
import { observer } from 'mobx-react-lite';

const FileItem = observer((props: { file: CloudFile }) => {
  const store = useInjectable(Store);
  // tslint:disable-next-line
  console.log('render FileItem', props.file.name);
  return (
    <li>
      {props.file.name}
      {store.timer.count}
    </li>
  );
});

export const FileTree = observer(() => {
  const store = useInjectable(Store);
  // tslint:disable-next-line
  console.log('render FileTree');

  const files = store.fileTreeService.files;
  return (
    <div>
      <h1>FileTree:</h1>
      <h1>Count: {store.count}</h1>
      <p><button onClick={ store.fileTreeService.createFile }>创建文件</button></p>
      <ul>
        {files && files.map((file) => (
          <FileItem key={file.path} file={file} />
        ))}
      </ul>
    </div>
  );
});
