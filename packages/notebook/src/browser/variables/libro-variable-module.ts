import { ManaModule } from '@difizen/mana-app';

import { LibroVariableColorRegistry } from './libro-variable-color-registry';
import { LibroVariablePanelView } from './variable-view';

export const LibroVariableModule = ManaModule.create().register(LibroVariablePanelView, LibroVariableColorRegistry);
