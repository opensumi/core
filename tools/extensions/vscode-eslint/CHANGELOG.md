### 1.9.0

- Moved to latest LSP libraries
- Added support for [eslint.quiet](https://github.com/microsoft/vscode-eslint/pull/661)

### 1.8.2

- Fix version mismatch problem between LSP client lib and VS Code version.

### 1.8.1

- Moved to latest LSP libraries
- Web pack extension and server
- Fixes [Extension causes high CPU load](https://github.com/Microsoft/vscode-eslint/issues/620)

### 1.8.0

- Moved to latest LSP libraries
- Merged in [PR #588](https://github.com/Microsoft/vscode-eslint/pull/588/) which adds to turn off the actions to disable rules per line and to open the documentation.
- Merged in [PR #572](https://github.com/Microsoft/vscode-eslint/pull/572) which adds support for pnpm.

### 1.7.0

- Merged in [PR #530](https://github.com/Microsoft/vscode-eslint/pull/530) which adds support to disable a rule per line or for the whole file as well as navigating to the documentation.

### 1.6.1

- Fixes [#558](https://github.com/Microsoft/vscode-eslint/issues/558) to adopt new functionality in VS Code 1.28

### 1.6.0

- Adopt the LSP JSON tracing options from the LSP libraries to enable better tracing support

### 1.5.0

- Allow setting the node runtime to use for the language server. Fixes #345 [PR #516](https://github.com/Microsoft/vscode-eslint/pull/516)
- eslintignore comment syntax highlighting [PR #473](https://github.com/Microsoft/vscode-eslint/pull/473)

### 1.4.14

- Include `semver` for client

### 1.4.13

- Upgraded to latest LSP libraries to handle process spawn / fork crashes under Electron 2.x

### 1.4.12

- Upgrade to latest version of the LSP libraries
- Fixes [eslint server crashed 5 times in the last 3 minutes. the server will not be restarted.](https://github.com/Microsoft/vscode-eslint/issues/437)

### 1.4.11

Internal version to track down [eslint server crashed 5 times in the last 3 minutes. the server will not be restarted.](https://github.com/Microsoft/vscode-eslint/issues/437)

### 1.4.10

- [Add Command to create a YAML configuration](https://github.com/Microsoft/vscode-eslint/issues/409)

### 1.4.9

- Using latest vscode-languageclient library to fix problems with server restarts and double change notifications.

### 1.4.8

- Using latest vscode-languageclient library to get rid of unnecessary console.log statements.

### 1.4.7

- [extension not working](https://github.com/Microsoft/vscode-eslint/issues/365)
- [Create a task provider for linting the whole workspace](https://github.com/Microsoft/vscode-eslint/pull/410)

### 1.4.6

- [Rename server.js to a more specific name so that eslint is easily recognized by code --status](https://github.com/Microsoft/vscode-eslint/issues/406)

### 1.4.5

- [UnhandledPromiseRejectionWarning when renaming .eslintrc.json](https://github.com/Microsoft/vscode-eslint/issues/403)
- [update error message and add a hint to update yarn setting if using yarn](https://github.com/Microsoft/vscode-eslint/pull/390)

### 1.4.4

- [request: better error message if eslint crashes](https://github.com/Microsoft/vscode-eslint/issues/391)

### 1.4.3

- Moved to version 3.5.0 of the vscode-languageserver-node libraries.

### 1.4.2

- [ESLint should show a warning icon when something failed in the status bar](https://github.com/Microsoft/vscode-eslint/issues/328)

### 1.4.1

- small setting description fix.
- tagged extension as multi root ready.

### 1.4.0

- Add support for [Yarn](https://yarnpkg.com/lang/en/). To use yarn instead of npm with the eslint extension set the settings `"eslint.packageManager": "yarn"`. To use npm set the value to `"npm"`.

### 1.3.2

Fixes:

- [Latest update appears to have broken nodePath specification ](https://github.com/Microsoft/vscode-eslint/issues/298)

### 1.3.1

Fixes:

- [Failed to lint Untitled JavaScript file.](https://github.com/Microsoft/vscode-eslint/issues/295)

### 1.3.0

- Add support for multi workspace folder setups. Adding this support required a major code change both on the extension and the server side. So if you recognized problems with this version please report them as quick as possible in the [GitHub repository](https://github.com/Microsoft/vscode-eslint).

  Version 1.3.0 of the ESLint extension requires at least version 1.16 of VS Code.

### 1.2.11

Fixes:

- [(Insiders/1.2.10) "Cannot read property 'then' of undefined](https://github.com/Microsoft/vscode-eslint/issues/240)

### 1.2.10

Performance work around code actions and validation. Fixed:

- [Slowdown on code assist with eslint enabled](https://github.com/Microsoft/vscode-eslint/issues/215)

### 1.2.9

This version was an internal test release which wasn't available in the market place

### 1.2.8

### Fixes:

- [Linting is still enabled when viewing git diff.](https://github.com/Microsoft/vscode-eslint/issues/216)

### 1.2.7

#### Fixes:

- [Don't lint git diff.](https://github.com/Microsoft/vscode-eslint/issues/200)

### 1.2.6

#### Fixes:

- [Do not always run eslint from the project's root directory](https://github.com/Microsoft/vscode-eslint/issues/196)
- [baseDir should be an absolute path](https://github.com/Microsoft/vscode-eslint/issues/202)


### <a name="RN125"></a>1.2.5

- Validating a single file (no workspace folder open) will set the working directory to the directory containing the file.
- Added support for working directories. ESLint resolves configuration files relative to a working directory. This new settings allows users to control which working directory is used for which files. Consider the following setups:

```
client/
  .eslintignore
  .eslintrc.json
  client.js
server/
  .eslintignore
  .eslintrc.json
  server.js
```

Then using the setting:
```json
  "eslint.workingDirectories": [
    "./client", "./server"
  ]
```
will validate files inside the server directory with the server directory as the current working directory. Same for files in the client directory. If the setting is omitted the working directory is the workspace folder.


### 1.2.4

- fixes [.eslintignore is completely ignored](https://github.com/Microsoft/vscode-eslint/issues/198)
- reverted fix for [Does not respect nested eslintignore files](https://github.com/Microsoft/vscode-eslint/issues/111) since it broke the use case of a single global .eslintrc file

### 1.2.3

- Bug fixes:
  - [Does not respect nested eslintignore files](https://github.com/Microsoft/vscode-eslint/issues/111)
  - [eslintrc configuration cascading not being honored ](https://github.com/Microsoft/vscode-eslint/issues/97)
  - [autoFixOnSave not working with eslint.run=onSave](https://github.com/Microsoft/vscode-eslint/issues/158)
  - [autoFixOnSave not listed under Settings Options in Readme](https://github.com/Microsoft/vscode-eslint/issues/188)

### 1.2.2

- Added configuration options to enable code actions and auto fix on save selectively per language. In release 1.2.1 code actions and auto fix on save very still only
available for JavaScript. In 1.2.2 you can now enable this selectively per language. For compatibility it is enabled by default for JavaScript and disabled by default for all
other languages. The reason is that I encounter cases for non JavaScript file types where the computed fixes had wrong positions resulting in 'broken' documents. To enable it simply
provide an object literal in the validate setting with the properties `language` and `autoFix` instead of a simple `string`. An example is:
```json
"eslint.validate": [ "javascript", "javascriptreact", { "language": "html", "autoFix": true } ]
```

### <a name="RN121"></a>1.2.1

- Added support to validate file types other than JavaScript. To enable this, you need to do the following:
  - Configure ESLint with an additional plugin to do the actual validation. For example, to validate HTML files install
`eslint-plugin-html` using `npm install eslint-plugin-html --save-dev` and update the eslint configuration (e.g. .eslintrc.json file)
with `"plugin": [ "html" ]`.
  - Add the corresponding language identifier to the `eslint.validate` setting. Something like `"eslint.validate": [ "javascript", "javascriptreact", "html" ]`.
If the setting is missing, it defaults to `["javascript", "javascriptreact"]`

Please note that code actions and auto fix on save is still only available for JavaScript. The reason is that I detected position problems with fixes contributed by plugins
resulting in broken source code when applied.

### 1.1.0

- Supports more than one ESLint module installation in a workspace. This eases working with typical client / server setups where ESLint is installed
in a `node_modules` folder in the `server` and the `client` directory.
- Improved error handling if a plugin can't be loaded.
- Added commands to enable and disable ESLint.

### 1.0.8

- Supports auto fix on save. Needs to be enabled via `"eslint.autoFixOnSave": true`. Please note that auto fix on save will only happen
if the save happened manually or via focus lost. This is consistent with VS Code's format on save behavior. Auto fix on save requires
VS Code version 1.6 or newer.

### 1.0.7

- Fixed problem with validating package.json when editing .eslintrc.* files.

### 1.0.5

- Moving to official 2.5.0 language server libraries.

### 1.0.4

- Bug fixing: eslint is validating package.json files

### 1.0.3

- Errors in configuration files are only shown in a status message if the file is not open in the editor. Otherwise message are shown in the output channel only.

### 1.0.2

- Added a status bar item to inform the user about problems with ESLint. A message box only appears if the user attention is required.
- Improved handling of missing corrupted configuration files.
- The ESLint package is now loaded from parent folders as well.
- Added an action to create a .eslintrc.json file.
