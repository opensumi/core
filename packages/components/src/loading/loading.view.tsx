import React from 'react';

import './loading.less';

export const Loading: React.FC<React.HTMLAttributes<HTMLDivElement>> = () => {
  return <div className='loading_indicator '/>;
};

Loading.displayName = 'Loading';
