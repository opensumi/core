export const localizationBundle = {
  languageId: 'en-US',
  languageName: 'english',
  localizedLanguageName: 'English',
  contents: {
    'window.title': [
      'Controls the window title based on the active editor. Variables are substituted based on the context:',
      '`${activeEditorShort}`: the file name (e.g. myFile.txt).',
      '`${activeEditorMedium}`: the path of the file relative to the workspace folder (e.g. myFolder/myFileFolder/myFile.txt).',
      '`${activeEditorLong}`: the full path of the file (e.g. /Users/Development/myFolder/myFileFolder/myFile.txt).',
      '`${activeFolderShort}`: the name of the folder the file is contained in (e.g. myFileFolder).',
      '`${activeFolderMedium}`: the path of the folder the file is contained in, relative to the workspace folder (e.g. myFolder/myFileFolder).',
      '`${activeFolderLong}`: the full path of the folder the file is contained in (e.g. /Users/Development/myFolder/myFileFolder).',
      '`${folderName}`: name of the workspace folder the file is contained in (e.g. myFolder).',
      '`${folderPath}`: file path of the workspace folder the file is contained in (e.g. /Users/Development/myFolder).',
      '`${rootName}`: name of the opened workspace or folder (e.g. myFolder or myWorkspace).',
      '`${rootPath}`: file path of the opened workspace or folder (e.g. /Users/Development/myWorkspace).',
      '`${appName}`: e.g. OpenSumi.',
      '`${remoteName}`: e.g. SSH',
      '`${dirty}`: an indicator for when the active editor has unsaved changes.',
      '`${separator}`: a conditional separator (" - ") that only shows when surrounded by variables with values or static text.',
    ].join('\n- '),
  },
};
