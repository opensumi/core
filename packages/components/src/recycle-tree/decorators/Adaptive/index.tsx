import * as React from 'react';
import { IRecycleTreeProps, IRecycleTreeHandle } from '../../RecycleTree';
import { TreeNodeEvent } from '../../types';
import { TreeModel } from '../../tree';

type AdaptiveTreeHoc<Props, ExtraProps = any> = (
  Component: React.ComponentType<Props>,
) => React.ComponentType<
  Props & (ExtraProps extends undefined ? never : ExtraProps)
>;

/**
 * 将 RecycleTree 组件装饰到能够自适应高度
 * @param recycleTreeComp RecycleTree 组件
 */
export const RecycleTreeAdaptiveDecorator: AdaptiveTreeHoc<
  IRecycleTreeProps
> = (recycleTreeComp) => (props: IRecycleTreeProps) => {
  const { model, itemHeight, onReady } = props;
  const ref = React.useRef<TreeModel>();

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
        if (ref.current) {
          setCurrentHeight(ref.current.root.branchSize * itemHeight + itemHeight);
        }
        promptHandle.onDestroy(() => {
          if (ref.current) {
            setCurrentHeight(ref.current.root.branchSize * itemHeight);
          }
        });
        promptHandle.onCancel(() => {
          if (ref.current) {
            setCurrentHeight(ref.current.root.branchSize * itemHeight);
          }
        });
        return promptHandle;
      },
      promptNewCompositeTreeNode: async (at) => {
        const promptHandle = await handle.promptNewCompositeTreeNode(at);
        if (ref.current) {
          setCurrentHeight(ref.current.root.branchSize * itemHeight + itemHeight);
        }
        promptHandle.onDestroy(() => {
          if (ref.current) {
            setCurrentHeight(ref.current.root.branchSize * itemHeight);
          }
        });
        promptHandle.onCancel(() => {
          if (ref.current) {
            setCurrentHeight(ref.current.root.branchSize * itemHeight);
          }
        });
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

  return (
    <>
      {
        React.createElement(recycleTreeComp, {
          ...props,
          height: currentHeight,
          onReady: handleOnReady,
        })
      }
    </>
  );
};
