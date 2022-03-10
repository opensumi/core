import React from 'react';

import { IRecycleTreeProps, IRecycleTreeHandle } from '../../RecycleTree';
import { TreeModel } from '../../tree';
import { TreeNodeEvent } from '../../types';

type AdaptiveTreeHoc<Props, ExtraProps = any> = (
  Component: React.ComponentType<Props>,
) => React.ComponentType<Props & (ExtraProps extends undefined ? never : ExtraProps)>;

/**
 * 将 RecycleTree 组件装饰到能够自适应高度
 * @param recycleTreeComp RecycleTree 组件
 */
export const RecycleTreeAdaptiveDecorator: AdaptiveTreeHoc<IRecycleTreeProps> =
  (recycleTreeComp) => (props: IRecycleTreeProps) => {
    const { model, itemHeight, onReady } = props;
    const ref = React.useRef<TreeModel>();
    const destroyWhileBlur = React.useRef<boolean>(false);

    const [currentHeight, setCurrentHeight] = React.useState<number>(0);

    const handleExpansionChange = () => {
      setCurrentHeight(model.root.branchSize * itemHeight);
    };

    const handleOnReady = (handle: IRecycleTreeHandle) => {
      if (!onReady) {
        return;
      }
      onReady({
        ...handle,
        promptNewTreeNode: async (at) => {
          const promptHandle = await handle.promptNewTreeNode(at);
          if (ref.current?.root.branchSize) {
            setCurrentHeight(ref.current.root.branchSize * itemHeight + itemHeight);
          } else {
            // 添加节点时，如果不存在 ref.current，即不存在可渲染节点
            // 补全高度便于插入输入框
            setCurrentHeight(itemHeight);
          }
          destroyWhileBlur.current = false;
          promptHandle.onDestroy(() => {
            if (ref.current?.root.branchSize) {
              setCurrentHeight(ref.current.root.branchSize * itemHeight);
            }
          });
          promptHandle.onCancel(() => {
            if (ref.current) {
              setCurrentHeight(ref.current.root.branchSize * itemHeight);
            }
          });
          promptHandle.onBlur(() => destroyWhileBlur.current);
          return promptHandle;
        },
        promptNewCompositeTreeNode: async (at) => {
          const promptHandle = await handle.promptNewCompositeTreeNode(at);
          if (ref.current?.root.branchSize) {
            setCurrentHeight(ref.current.root.branchSize * itemHeight + itemHeight);
          } else {
            // 添加节点时，如果不存在 ref.current，即不存在可渲染节点
            // 补全高度便于插入输入框
            setCurrentHeight(itemHeight);
          }
          promptHandle.onDestroy(() => {
            if (ref.current?.root.branchSize) {
              setCurrentHeight(ref.current.root.branchSize * itemHeight);
            }
          });
          promptHandle.onCancel(() => {
            if (ref.current?.root.branchSize) {
              setCurrentHeight(ref.current.root.branchSize * itemHeight);
            }
          });
          promptHandle.onBlur(() => destroyWhileBlur.current);
          return promptHandle;
        },
      });
    };

    React.useEffect(() => {
      ref.current = model;
      if (ref.current.root) {
        setCurrentHeight(ref.current.root.branchSize * itemHeight);
        ref.current.root.watcher.on(TreeNodeEvent.DidChangeExpansionState, handleExpansionChange);
      }
    }, [model]);

    React.useEffect(() => {
      // currentHeight 更新时，有概率让整个 Tree 重绘
      // 导致 prompt 的 blur 事件触发
      // 这里等待 100 ms 后再将 prompt 失去焦点后关闭的逻辑打开
      setTimeout(() => {
        destroyWhileBlur.current = true;
      }, 100);
    }, [currentHeight]);

    return (
      <>
        {React.createElement(recycleTreeComp, {
          ...props,
          height: currentHeight,
          onReady: handleOnReady,
        })}
      </>
    );
  };
