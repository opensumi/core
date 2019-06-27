import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './panel.module.less';
import { CollapsePanelProps } from './panel.view';

export interface CollapsePanelContainerProps extends React.PropsWithChildren<any> {
  // defaultActiveKey 默认展开的key
  defaultActiveKey?: string[];
  onChange?: (key: string | string[]) => void;
}

export interface ISize {
  height: string | number;
  width: string | number;
}

export interface ISizeMap {
  [key: string]: {
    expanded?: boolean;
    priority?: number;
    size?: ISize;
  };
}

export const CollapsePanelContainer = (
  {
    children,
    defaultActiveKey,
    onChange,
  }: CollapsePanelContainerProps,
) => {
  const collapseRef = React.createRef<HTMLDivElement>();
  const [activeKey, setActiveKey] = React.useState<string[]>([]);
  const [sizeMaps, setSizeMaps] = React.useState<ISizeMap>({});
  const defaultSize: ISize = {
    height: 22,
    width: collapseRef.current && collapseRef.current.clientWidth || '100%',
  };

  // 计算panel高度，根据priority参数进行分配
  const evalSize = (sizeMaps: ISizeMap, containerHeight: any, containerWidth: any): ISizeMap => {
    const newSizes = Object.assign({}, sizeMaps);
    const keys = Object.keys(newSizes);
    const expandedKeys: string[] = [];
    let prioritySum = 0;
    for (const key of keys) {
      if (newSizes[key].expanded) {
        prioritySum += newSizes[key].priority || 1;
        expandedKeys.push(key);
      }
    }
    for (const key of keys) {
      if (newSizes[key].expanded) {
        const nextHeight = Math.floor((containerHeight - (keys.length - expandedKeys.length) * (+defaultSize.height)) * ((newSizes[key].priority || 1) / prioritySum));
        newSizes[key].size = {
          height: nextHeight,
          width: containerWidth,
        };
      } else {
        newSizes[key].size = defaultSize;
      }
    }
    return newSizes;
  };

  React.useEffect(() => {
    setActiveKey(defaultActiveKey || []);
  }, [defaultActiveKey]);

  React.useEffect(() => {
    const sizes: ISizeMap = {};
    children.forEach((child) => {
      const props: CollapsePanelProps = child.props;
      sizes[child.key] = {};
      if (activeKey.indexOf(child.key) >= 0) {
        sizes[child.key].expanded = true;
      } else {
        sizes[child.key].expanded = false;
      }
      sizes[child.key].priority = props.priority || 1;
    });
    const currentContainerHeight = collapseRef.current && collapseRef.current.clientHeight;
    const currentContainerwidth = collapseRef.current && collapseRef.current.clientWidth;
    setSizeMaps(evalSize(sizes, currentContainerHeight, currentContainerwidth));
  }, [activeKey]);

  const onClickItem = (event: React.MouseEvent, item: string) => {
    const newActiveKey: any = activeKey.slice(0);
    const index = newActiveKey.indexOf(item);
    const isActive = index > -1;
    if (isActive) {
      newActiveKey.splice(index, 1);
    } else {
      newActiveKey.push(item);
    }
    setActiveKey(newActiveKey);
    if (onChange) {
      onChange(newActiveKey);
    }
  };

  const getNewChild = (child, index) => {
    if (!child) { return null; }
    const key: string = child.key || String(index);
    const { header, headerClass, disabled } = child.props;
    const isActive = (activeKey as string[]).indexOf(key) > -1;
    const props = {
      key,
      panelKey: key,
      header,
      headerClass,
      isActive,
      size: sizeMaps[key] && sizeMaps[key].size || defaultSize,
      children: child.props.children,
      onItemClick: disabled ? null : onClickItem,
    };

    return React.cloneElement(child, props);
  };

  const getItems = (children: React.ReactChild) => {
    const newChildren = React.Children.map(children, getNewChild);
    return newChildren;
  };

  const containerProps = {
    ref: collapseRef,
  };

  return  <div className={ styles.kt_split_panel_container } {...containerProps} >
     { getItems(children) }
  </div>;
};
