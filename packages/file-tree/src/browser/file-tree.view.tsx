import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IFileTreeItem } from '../common';
import { observer } from 'mobx-react-lite';
import { Autowired, Injectable } from '@ali/common-di';
import FileTreeService from './file-tree.service';
import LabelStore from './label.store';
import * as style from './index.module.less';

export interface IFileTreeItemRendered extends IFileTreeItem {
  indent: number;
}

export type FileIconTypes = 'js' | 'html' | 'html';

export const FileTree = observer(() => {
  const instance = useInjectable(FileTreeService);
  const files: IFileTreeItem[] = instance.files;
  const FileTreeStyle = {
    position: 'absolute',
    minWidth: '100px',
    minHeight: '100px',
    bottom: '22px',
    left: '0',
    width: '100%',
    height: '100%',
  } as React.CSSProperties;
  return (
    <div className={ `${style.kt_tree} ${style.kt_filetree}` } style={ FileTreeStyle }>
      <div className={ style.kt_filetree_container }>
        <FileItems files={ files } />
      </div>
    </div>
  );
});

const FileItems = observer(({ files }: { files: IFileTreeItem[] }) => {
  const fileItems: IFileTreeItemRendered[] = extractFileItemShouldBeRendered(files);
  return (
    <React.Fragment>
      {
        fileItems.map((file: IFileTreeItemRendered, index: number) => {
          if (file.filestat.isDirectory) {
            return <DirFileItems file={file} index={index} />;
          } else {
            return <SingleFileItems file={file} index={index} />;
          }
        })
      }
    </React.Fragment>
  );
});

const DirFileItems = observer(({file, index}: {file: IFileTreeItemRendered, index: number}) => {
  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    left: '0',
    top: `${index * 22}px`,
  } as React.CSSProperties;
  const FileTreeNodeStyle = {
    paddingLeft: `${file.indent * 8}px`,
  } as React.CSSProperties;

  const labelStore = useInjectable(LabelStore);

  React.useEffect(() => {
    labelStore.parse(file.uri);
  }, [file.uri]);

  return (
    <div style={ FileTreeNodeWrapperStyle } key={ file.id }>
      <div className={ style.kt_filetree_treenode } style={ FileTreeNodeStyle }>
        <div className={ style.kt_filetree_treenode_content }>
          <div
            className={
              `${style.kt_filetree_treenode_segment}
               ${style.kt_filetree_expansion_toggle}
               ${file.expanded ? '' : style.kt_filetree_mod_collapsed}`
            }
          >
          </div>
          <div className={ `${labelStore.icon} ${style.kt_filetree_file_icon}` }></div>
          <div
            className={ `${style.kt_filetree_treenode_segment} ${style.kt_filetree_treenode_segment_grow}`}
          >
            { file.name }
          </div>
          <div className={ `${style.kt_filetree_treenode_segment} ${style.kt_filetree_treeNode_tail}`}>M</div>
        </div>
      </div>
    </div>
  );
});

const SingleFileItems = observer(({file, index}: {file: IFileTreeItemRendered, index: number}) => {
  const labelStore = useInjectable(LabelStore);

  React.useEffect(() => {
    labelStore.parse(file.uri);
  }, [file.uri]);

  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    left: '0',
    top: `${index * 22}px`,
  } as React.CSSProperties;

  const FileTreeNodeStyle = {
    paddingLeft: `${18 + file.indent * 8}px`,
  } as React.CSSProperties;

  return (
    <div style={ FileTreeNodeWrapperStyle } key={ file.id }>
      <div className={ style.kt_filetree_treenode } style={ FileTreeNodeStyle }>
        <div className={ style.kt_filetree_treenode_content }>
          <div className={ `${labelStore.icon} ${style.kt_filetree_file_icon}` }></div>
          <div
            className={ `${style.kt_filetree_treenode_segment} ${style.kt_filetree_treenode_segment_grow}`}
          >
            { file.name }
          </div>
          <div className={ `${style.kt_filetree_treenode_segment} ${style.kt_filetree_treeNode_tail}`}>M</div>
        </div>
      </div>
    </div>
  );
});

const extractFileItemShouldBeRendered = (files: IFileTreeItem[], indent: number = 0): IFileTreeItemRendered[] => {
  let renderedFiles: IFileTreeItemRendered[] = [];
  files.forEach((file: IFileTreeItem) => {
    const childrens = file.children;
    renderedFiles.push({
      ...file,
      indent,
    });
    if (file.expanded && childrens && childrens.length > 0) {
      renderedFiles = renderedFiles.concat(extractFileItemShouldBeRendered(file.children, indent + 1 ));
    }
  });
  return renderedFiles;
};
