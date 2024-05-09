import React from 'react';
import ReactDOM from 'react-dom';

import { usePortal } from '../../react-hooks';

const Portal: React.FC<{
  id: string;
  className?: string;
  children: React.ReactElement;
}> = ({ id, className, children }) => {
  const target = usePortal(id, className);
  return ReactDOM.createPortal(children, target);
};

export default Portal;
