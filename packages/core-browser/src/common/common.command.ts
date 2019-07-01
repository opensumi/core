import { Command, localize } from '..';

export namespace FILE_COMMANDS {
  const CATEGORY = 'File';

  export const NEW_FILE: Command = {
    id: 'file.new',
    category: CATEGORY,
    label: localize('file.new'),
  };

  export const SAVE_FILE: Command = {
    id: 'file.save',
    category: CATEGORY,
    label: localize('file.save'),
  };

  export const NEW_FOLDER: Command = {
    id: 'file.folder.new',
    category: CATEGORY,
    label: localize('file.folder.new'),
  };
}

export namespace COMMON_COMMANDS {
  export const ABOUT_COMMAND: Command = {
    id: 'core.about',
    label: localize('about'),
  };
}

export namespace EXPLORER_COMMANDS {
  const CATEGORY = 'Explorer';

  export const LOCATION: Command = {
    id: 'explorer.location',
    category: CATEGORY,
    label: localize('explorer.location'),
  };
}
