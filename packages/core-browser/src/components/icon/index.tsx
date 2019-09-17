import * as React from 'react';
import clx from 'classnames';

const Icon: React.FC<{
  name: string;
  iconset?: 'fa' | 'octicon';
}> = ({ name, iconset = 'fa' }) => {
  return <span className={clx(iconset, `${iconset}-${name}`)}></span>;
};

export default Icon;
