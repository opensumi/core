'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Commonly used commands
 */
var Commands;
(function (Commands) {
    /**
     * Open Browser
     */
    Commands.OPEN_BROWSER = 'vscode.open';
    /**
     * Open Output view
     */
    Commands.OPEN_OUTPUT = 'java.open.output';
    /**
     * Show Java references
     */
    Commands.SHOW_JAVA_REFERENCES = 'java.show.references';
    /**
     * Show Java implementations
     */
    Commands.SHOW_JAVA_IMPLEMENTATIONS = 'java.show.implementations';
    /**
     * Show editor references
     */
    Commands.SHOW_REFERENCES = 'editor.action.showReferences';
    /**
     * Update project configuration
     */
    Commands.CONFIGURATION_UPDATE = 'java.projectConfiguration.update';
    /**
     * Ignore "Incomplete Classpath" messages
     */
    Commands.IGNORE_INCOMPLETE_CLASSPATH = 'java.ignoreIncompleteClasspath';
    /**
     * Open help for "Incomplete Classpath" message
     */
    Commands.IGNORE_INCOMPLETE_CLASSPATH_HELP = 'java.ignoreIncompleteClasspath.help';
    /**
     * Reload VS Code window
     */
    Commands.RELOAD_WINDOW = 'workbench.action.reloadWindow';
    /**
     * Set project configuration update mode
     */
    Commands.PROJECT_CONFIGURATION_STATUS = 'java.projectConfiguration.status';
    /**
     * Apply Workspace Edit
     */
    Commands.APPLY_WORKSPACE_EDIT = 'java.apply.workspaceEdit';
    /**
     * Execute Workspace Command
     */
    Commands.EXECUTE_WORKSPACE_COMMAND = 'java.execute.workspaceCommand';
    /**
     * Execute Workspace build (compilation)
     */
    Commands.COMPILE_WORKSPACE = 'java.workspace.compile';
    /**
    * Open Java Language Server Log file
    */
    Commands.OPEN_SERVER_LOG = 'java.open.serverLog';
    /**
    * Open Java client Log file
    */
    Commands.OPEN_CLIENT_LOG = 'java.open.clientLog';
    /**
     * Open Java formatter settings
     */
    Commands.OPEN_FORMATTER = 'java.open.formatter.settings';
    /**
     * Clean the Java language server workspace
     */
    Commands.CLEAN_WORKSPACE = 'java.clean.workspace';
    /**
     * Update the source attachment for the selected class file
     */
    Commands.UPDATE_SOURCE_ATTACHMENT = 'java.project.updateSourceAttachment';
    /**
     * Resolve the source attachment information for the selected class file
     */
    Commands.RESOLVE_SOURCE_ATTACHMENT = 'java.project.resolveSourceAttachment';
    /**
     * Mark the folder as the source root of the closest project.
     */
    Commands.ADD_TO_SOURCEPATH = 'java.project.addToSourcePath';
    /**
     * Unmark the folder as the source root of the project.
     */
    Commands.REMOVE_FROM_SOURCEPATH = 'java.project.removeFromSourcePath';
    /**
     * List all recognized source roots in the workspace.
     */
    Commands.LIST_SOURCEPATHS = 'java.project.listSourcePaths';
    /**
     * Override or implements the methods from the supertypes.
     */
    Commands.OVERRIDE_METHODS_PROMPT = 'java.action.overrideMethodsPrompt';
    /**
     * Generate hashCode() and equals().
     */
    Commands.HASHCODE_EQUALS_PROMPT = 'java.action.hashCodeEqualsPrompt';
    /**
     * Open settings.json
     */
    Commands.OPEN_JSON_SETTINGS = 'workbench.action.openSettingsJson';
    /**
     * Organize imports.
     */
    Commands.ORGANIZE_IMPORTS = "java.action.organizeImports";
    /**
     * Choose type to import.
     */
    Commands.CHOOSE_IMPORTS = "java.action.organizeImports.chooseImports";
    /**
     * Generate toString().
     */
    Commands.GENERATE_TOSTRING_PROMPT = 'java.action.generateToStringPrompt';
    /**
     * Generate Getters and Setters.
     */
    Commands.GENERATE_ACCESSORS_PROMPT = 'java.action.generateAccessorsPrompt';
    /**
     * Generate Constructors.
     */
    Commands.GENERATE_CONSTRUCTORS_PROMPT = 'java.action.generateConstructorsPrompt';
    /**
     * Generate Delegate Methods.
     */
    Commands.GENERATE_DELEGATE_METHODS_PROMPT = 'java.action.generateDelegateMethodsPrompt';
    /**
     * Apply Refactoring Command.
     */
    Commands.APPLY_REFACTORING_COMMAND = 'java.action.applyRefactoringCommand';
    /**
     * Rename Command.
     */
    Commands.RENAME_COMMAND = 'java.action.rename';
})(Commands = exports.Commands || (exports.Commands = {}));
//# sourceMappingURL=commands.js.map