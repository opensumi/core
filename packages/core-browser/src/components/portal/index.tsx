import React from 'react';
import ReactDOM from 'react-dom';

import { usePortal } from '../../react-hooks';

const Portal: React.FC<{
  id: string;
}> = ({ id, children }) => {
  const target = usePortal(id);
  return ReactDOM.createPortal(children, target);
};

export default Portal;
