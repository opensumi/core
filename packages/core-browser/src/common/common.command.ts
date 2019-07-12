import { Command, localize } from '..';

export namespace FILE_COMMANDS {
  const CATEGORY = localize('file');

  export const NEW_FILE: Command = {
    id: 'file.new',
    category: CATEGORY,
    label: localize('file.new'),
  };

  export const RENAME_FILE: Command = {
    id: 'file.rename',
    category: CATEGORY,
    label: localize('file.rename'),
  };

  export const DELETE_FILE: Command = {
    id: 'file.delete',
    category: CATEGORY,
    label: localize('file.delete'),
  };

  export const NEW_FOLDER: Command = {
    id: 'file.folder.new',
    category: CATEGORY,
    label: localize('file.folder.new'),
  };

  export const COMPARE_SELECTED: Command = {
    id: 'file.compare',
    category: CATEGORY,
    label: localize('file.compare'),
  };

  export const COLLAPSE_ALL: Command = {
    id: 'filetree.collapse.all',
    category: CATEGORY,
    label: localize('file.collapse'),
  };

  export const REFRESH_ALL: Command = {
    id: 'filetree.refresh.all',
    category: CATEGORY,
    label: localize('file.refresh'),
  };
}

export namespace COMMON_COMMANDS {

  export const FIND: Command = {
    id: 'core.find',
    label: 'Find',
  };

  export const REPLACE: Command = {
    id: 'core.replace',
    label: 'Replace',
  };

  export const ABOUT_COMMAND: Command = {
    id: 'core.about',
    label: localize('about'),
  };
}

export namespace EXPLORER_COMMANDS {
  const CATEGORY = localize('explorer');

  export const LOCATION: Command = {
    id: 'explorer.location',
    category: CATEGORY,
    label: localize('explorer.location'),
  };
}

export namespace EDITOR_COMMANDS {
  const CATEGORY = localize('editor');

  export const UNDO: Command = {
    id: 'editor.undo',
    category: CATEGORY,
    label: localize('editor.undo'),
  };
  export const REDO: Command = {
    id: 'editor.redo',
    category: CATEGORY,
    label: localize('editor.redo'),
  };

  export const OPEN_RESOURCE: Command = {
    id: 'editor.openUri',
    category: CATEGORY,
  };

  export const OPEN_RESOURCES: Command = {
    id: 'editor.openUris',
    category: CATEGORY,
  };

  export const SAVE_CURRENT: Command = {
    id: 'editor.saveCurrent',
    category: CATEGORY,
    label: localize('editor.saveCurrent'),
  };

  export const COMPARE: Command = {
    id: 'editor.compare',
    category: CATEGORY,
  };

  export const CLOSE: Command = {
    id: 'editor.close',
    category: CATEGORY,
  };

  export const CLOSE_ALL_IN_GROUP: Command = {
    id: 'editor.closeAllInGroup',
    category: CATEGORY,
    label: localize('editor.closeAllInGroup'),
  };

  export const CLOSE_TO_RIGHT: Command = {
    id: 'editor.closeToRight',
    category: CATEGORY,
  };

  export const GET_CURRENT: Command = {
    id: 'editor.getCurrent',
    category: CATEGORY,
  };

  export const SPLIT_TO_LEFT: Command = {
    id: 'editor.splitToLeft',
    category: CATEGORY,
  };

  export const SPLIT_TO_RIGHT: Command = {
    id: 'editor.splitToRight',
    category: CATEGORY,
  };

  export const SPLIT_TO_TOP: Command = {
    id: 'editor.splitToTop',
    category: CATEGORY,
  };

  export const SPLIT_TO_BOTTOM: Command = {
    id: 'editor.splitToBottom',
    category: CATEGORY,
  };

  export const CHANGE_LANGUAGE: Command = {
    id: 'editor.changeLanguage',
    category: CATEGORY,
  };

  export const CHANGE_ENCODING: Command = {
    id: 'editor.changeEncoding',
    category: CATEGORY,
  };

  export const CHANGE_EOL: Command = {
    id: 'editor.changeEol',
    category: CATEGORY,
  };

}
