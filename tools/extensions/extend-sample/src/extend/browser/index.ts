import ComponentA from './component-a';
import ComponentB from './component-b';

export default{
  left: {
    type: 'add',
    component: [
      {
        id: 'comA',
        icon: 'volans_icon debug',
        panel: ComponentA,
      },
    ],
  },
  right: {
    type: 'add',
    component: [
      {
        id: 'comB',
        icon: 'volans_icon debug',
        panel: ComponentB,
      },
    ],
  },
};
