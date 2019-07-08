import * as React from 'react';
import * as styles from './index.module.less';
import * as cls from 'classnames';

export interface OpenedEditorTreeProps {
  nodes: any;
}

export const OpenedEditorTree = ({
  nodes,
}: React.PropsWithChildren<OpenedEditorTreeProps>) => {

  const renderGroupTree = (datas: any[]) => {
    if (!datas) { return; }
    return datas.map((data: any) => {
      console.log(data.childrens);
      return <div className={ styles.kt_openeditor_group } title={ data.tooltip } key= {data.description} >
        <div className={ styles.kt_openeditor_group_title }>{ data.label }</div>
        { renderTree(data.childrens) }
      </div>;
    });
  };

  const renderTree = (datas: any[]) => {
    if (!datas) { return; }
    return datas.map((data: any) => {
      return <div className={ styles.kt_openeditor_node } title={ data.tooltip } key= {data.description} >
        <div className={ data.iconClass }></div>
        <div className={ styles.kt_openeditor_label_description_contianer }>
          <a className={ styles.kt_openeditor_label }>{ data.label }</a>
          <div className={ styles.kt_openeditor_description }>{ data.description }</div>
        </div>
      </div>;
    });
  };

  const renderOpenedEditorTree = (datas: any[]) => {
    if (isGroupData(datas)) {
      return renderGroupTree(datas);
    }
    return renderTree(datas);
  };

  const isGroupData = (datas: any[]) => {
    if (datas.length > 0 && 'childrens' in datas[0]) {
      return true;
    }
    return false;
  };

  return <div className={ styles.kt_openeditor_container }>
    { renderOpenedEditorTree(nodes) }
  </div>;
};
