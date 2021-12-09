import React from 'react';

import './loading.less';

export const Loading = React.memo(() => {
  return <div className='loading_indicator'/>;
});

Loading.displayName = 'Loading';
