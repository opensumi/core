import * as React from 'react';
import throttle = require('lodash.throttle');

import { Icon } from '../../../icon';
import { IInputBaseProps, Input } from '../../../input';
import { LocalizeContext } from '../../../locale-context-provider';
import { IRecycleTreeProps } from '../../RecycleTree';

import './filter.less';

const FILTER_AREA_HEIGHT = 30;
const FILE_TREE_FILTER_DELAY = 500;

type FilterHoc<Props, ExtraProps = any> = (
  Component: React.ComponentType<Props>,
) => React.ComponentType<
  Props & (ExtraProps extends undefined ? never : ExtraProps)
>;

const FilterInput: React.FC<IInputBaseProps> = (props) => {
  const { localize } = React.useContext(LocalizeContext);

  return (
    <div className='kt-recycle-tree-filter-wrapper'>
      <Input
        hasClear
        autoFocus
        size='small'
        onValueChange={props.onValueChange}
        className='kt-recycle-tree-filter-input'
        afterClear={props.afterClear}
        placeholder={localize('tree.filter.placeholder')}
        addonBefore={<Icon className='kt-recycle-tree-filter-icon' icon='retrieval' />} />
    </div>
  );
};

/**
 * 将 RecycleTree 组件装饰到具备筛选功能
 * @param recycleTreeComp RecycleTree 组件
 * 将原有的 RecycleTree 拓展增加三个新的 props
 *  * @param filterEnabled @optional 筛选模式控制开关
 *  * @param fitlerAfterClear @optional 清空筛选 input 输入时的回调
 *  * @param filterPlaceholder @optional 筛选 input 的 placeholder
 */
export const RecycleTreeFilterDecorator: FilterHoc<
  IRecycleTreeProps,
  {
    filterEnabled?: boolean,
    fitlerAfterClear?: IInputBaseProps['afterClear'],
    filterPlaceholder?: IInputBaseProps['placeholder'],
  }
> = (recycleTreeComp) => (props) => {
  const [value, setValue] = React.useState<string>('');

  const handleFilterChange = throttle((value) => {
    setValue(value);
  }, FILE_TREE_FILTER_DELAY);

  const {
    filterEnabled, filterPlaceholder, fitlerAfterClear,
    height, ...recycleTreeProps
  } = props;
  return (
    <>
      {
        filterEnabled && (
          <FilterInput
            afterClear={fitlerAfterClear}
            placeholder={filterPlaceholder}
            value={value}
            onValueChange={handleFilterChange} />
        )
      }
      {React.createElement(recycleTreeComp, {
        ...recycleTreeProps,
        height: height - (filterEnabled ? FILTER_AREA_HEIGHT : 0),
        filter: value,
      })}
    </>
  );
};
