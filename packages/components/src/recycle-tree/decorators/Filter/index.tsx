import throttle from 'lodash/throttle';
import React from 'react';

import { Icon } from '../../../icon';
import { IInputBaseProps, Input } from '../../../input';
import { LocalizeContext } from '../../../locale-context-provider';
import { IRecycleTreeProps, IRecycleTreeHandle } from '../../RecycleTree';

import './filter.less';

const FILTER_AREA_HEIGHT = 30;
const TREE_FILTER_DELAY = 500;

type FilterHoc<Props, ExtraProps = any> = (
  Component: React.ComponentType<Props>,
) => React.ComponentType<Props & (ExtraProps extends undefined ? never : ExtraProps)>;

const FilterInput: React.FC<IInputBaseProps> = (props) => {
  const { localize } = React.useContext(LocalizeContext);

  return (
    <div className='kt-recycle-tree-filter-wrapper'>
      <Input
        hasClear
        autoFocus
        className='kt-recycle-tree-filter-input'
        size='small'
        {...props}
        placeholder={props.placeholder || localize('tree.filter.placeholder')}
        addonBefore={<Icon className='kt-recycle-tree-filter-icon' icon='retrieval' />}
      />
    </div>
  );
};

export interface IRecycleTreeFilterHandle extends IRecycleTreeHandle {
  clearFilter: () => void;
}

/**
 * 将 RecycleTree 组件装饰到具备筛选功能
 * @param recycleTreeComp RecycleTree 组件
 * 将原有的 RecycleTree 拓展增加三个新的 props
 *  * @param filterEnabled @optional 筛选模式控制开关
 *  * @param filterAfterClear @optional 清空筛选 input 输入时的回调
 *  * @param filterAutoFocus @optional 是否自动聚焦
 *  * @param filterPlaceholder @optional 筛选 input 的 placeholder
 */
export const RecycleTreeFilterDecorator: FilterHoc<
  IRecycleTreeProps,
  {
    filterEnabled?: boolean;
    // 用于在filter变化前进行额外处理，例如展开所有目录
    beforeFilterValueChange?: (value: string) => Promise<void>;
    filterAfterClear?: IInputBaseProps['afterClear'];
    filterPlaceholder?: IInputBaseProps['placeholder'];
    filterAutoFocus?: IInputBaseProps['autoFocus'];
  }
> = (recycleTreeComp) => (props) => {
  const [value, setValue] = React.useState<string>('');
  // 引入多一个filter状态是为了在实际filter生效前不阻塞输入框值变化的过程
  const [filter, setFilter] = React.useState<string>('');

  const {
    beforeFilterValueChange,
    filterEnabled,
    height,
    filterPlaceholder,
    filterAfterClear,
    onReady,
    filterAutoFocus,
    ...recycleTreeProps
  } = props;

  const handleFilterChange = throttle(async (value: string) => {
    if (beforeFilterValueChange) {
      await beforeFilterValueChange(value);
    }
    setFilter(value);
  }, TREE_FILTER_DELAY);

  const handleFilterInputChange = (value: string) => {
    setValue(value);
    handleFilterChange(value);
  };

  const filterTreeReadyHandle = (api: IRecycleTreeHandle) => {
    onReady &&
      onReady({
        ...api,
        clearFilter: () => {
          setFilter('');
          setValue('');
        },
      } as IRecycleTreeFilterHandle);
  };

  return (
    <>
      {filterEnabled && (
        <FilterInput
          afterClear={filterAfterClear}
          placeholder={filterPlaceholder}
          value={value}
          autoFocus={filterAutoFocus}
          onValueChange={handleFilterInputChange}
        />
      )}
      {React.createElement(recycleTreeComp, {
        ...recycleTreeProps,
        height: height - (filterEnabled ? FILTER_AREA_HEIGHT : 0),
        onReady: filterTreeReadyHandle,
        filter,
      })}
    </>
  );
};
