import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './panel.module.less';
import { CollapsePanelProps } from './panel.view';

export interface CollapsePanelContainerProps extends React.PropsWithChildren<any> {
  // defaultActiveKey 默认展开的key
  defaultActiveKey?: string[];
  activeKey?: string[];
  headerSize?: number;
  onChange?: (change: string[]) => void;
}

export interface ISize {
  height: number;
  width: number;
}

export interface ISizeMap {
  [key: string]: {
    expanded?: boolean;
    priority?: number;
    size?: ISize;
    style?: React.CSSProperties
  };
}

export const CollapsePanelContainer = (
  {
    children,
    activeKey,
    onChange,
    headerSize,
    style,
  }: CollapsePanelContainerProps,
) => {
  const collapseRef = React.createRef<HTMLDivElement>();
  const [innerActiveKey, setInnerActiveKey] = React.useState<string[]>([]);
  const [sizeMaps, setSizeMaps] = React.useState<ISizeMap>({});
  const defaultSize: ISize = {
    height: headerSize || 22,
    width: style && style.width || collapseRef.current && collapseRef.current.clientWidth,
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
        newSizes[key].size = {
          height: defaultSize.height,
          width: containerWidth,
        };
      }
    }
    return newSizes;
  };

  React.useEffect(() => {
    setInnerActiveKey(activeKey || []);
  }, [activeKey]);

  React.useEffect(() => {
    const sizes: ISizeMap = {};
    children.forEach((child) => {
      const props: CollapsePanelProps = child.props;
      sizes[child.key] = {};
      if (innerActiveKey.indexOf(child.key) >= 0) {
        sizes[child.key].expanded = true;
      } else {
        sizes[child.key].expanded = false;
      }
      sizes[child.key].priority = props.priority || 1;
    });
    const currentContainerHeight = style && style.height || collapseRef.current && collapseRef.current.clientHeight;
    const currentContainerWidth = style && style.width || collapseRef.current && collapseRef.current.clientWidth || defaultSize.width;
    setSizeMaps(evalSize(sizes, currentContainerHeight, currentContainerWidth));
  }, [innerActiveKey, style]);

  const onClickItem = (event: React.MouseEvent, item: string) => {
    const newActiveKey: any = innerActiveKey.slice(0);
    const index = newActiveKey.indexOf(item);
    const isActive = index > -1;
    if (isActive) {
      newActiveKey.splice(index, 1);
    } else {
      newActiveKey.push(item);
    }
    if (!activeKey) {
      setInnerActiveKey(newActiveKey);
    }
    if (onChange) {
      onChange(newActiveKey);
    }
  };

  const getNewChild = (child, index) => {
    if (!child) { return null; }
    const key: string = child.key || String(index);
    const { header, headerClass, disabled } = child.props;
    const isActive = (innerActiveKey as string[]).indexOf(key) > -1;
    const props = {
      key,
      panelKey: key,
      header,
      headerClass,
      isActive,
      size: sizeMaps[key] && sizeMaps[key].size || defaultSize,
      headerSize: defaultSize.height,
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
    style,
  };

  return  <div className={ styles.kt_split_panel_container } {...containerProps} >
     { getItems(children) }
  </div>;
};
