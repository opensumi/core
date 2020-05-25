import { Injectable } from '@ali/common-di';

@Injectable()
export class MockFileServiceClient {
  resolveContent(uri: string) {
    if (uri.indexOf('configuration') > -1) {
      return {
        content: `{
          'comments': {
            'blockComment': [ '<!--', '-->' ]
          },
          'brackets': [
            ['<!--', '-->'],
            ['<', '>'],
            ['{', '}'],
            ['(', ')']
          ],
          'autoClosingPairs': [
            { 'open': '{', 'close': '}'},
            { 'open': '[', 'close': ']'},
            { 'open': '(', 'close': ')' },
            { 'open': ''', 'close': ''' },
            { 'open': '<!--', 'close': '-->', 'notIn': [ 'comment', 'string' ]}
          ],
          'surroundingPairs': [
            { 'open': ''', 'close': ''' },
            { 'open': '{', 'close': '}'},
            { 'open': '[', 'close': ']'},
            { 'open': '(', 'close': ')' },
            { 'open': '<', 'close': '>' }
          ]
        }`,
      };
    }
    return {
      content: `{
        'iconDefinitions': {
          '_root_folder_dark': {
            'iconPath': './images/RootFolder_16x_inverse.svg'
          },
          '_root_folder_open_dark': {
            'iconPath': './images/RootFolderOpen_16x_inverse.svg'
          },
          '_folder_dark': {
            'iconPath': './images/Folder_16x_inverse.svg'
          },
          '_folder_open_dark': {
            'iconPath': './images/FolderOpen_16x_inverse.svg'
          },
          '_file_dark': {
            'iconPath': './images/Document_16x_inverse.svg'
          },
          '_root_folder': {
            'iconPath': './images/RootFolder_16x.svg'
          },
          '_root_folder_open': {
            'iconPath': './images/RootFolderOpen_16x.svg'
          },
          '_folder_light': {
            'iconPath': './images/Folder_16x.svg'
          },
          '_folder_open_light': {
            'iconPath': './images/FolderOpen_16x.svg'
          },
          '_file_light': {
            'iconPath': './images/Document_16x.svg'
          }
        },
        'folderExpanded': '_folder_open_dark',
        'folder': '_folder_dark',
        'file': '_file_dark',
        'rootFolderExpanded': '_root_folder_open_dark',
        'rootFolder': '_root_folder_dark',
        'fileExtensions': {
          'js.map': '_file_dark'
        },
        'fileNames': {
          'readme.md': '_file_dark'
        },
        'languageIds': {
          'jsonc': '_file_dark'
        },
        'light': {
          'folderExpanded': '_folder_open_light',
          'folder': '_folder_light',
          'rootFolderExpanded': '_root_folder_open',
          'rootFolder': '_root_folder',
          'file': '_file_light',
          'fileExtensions': {
            'js.map': '_file_dark'
          },
          'fileNames': {
            'readme.md': '_file_dark'
          },
          'languageIds': {
            'jsonc': '_file_dark'
          }
        },
        'highContrast': {
          'folderExpanded': '_folder_open_light'
        }
      }`,
    };
  }
}
