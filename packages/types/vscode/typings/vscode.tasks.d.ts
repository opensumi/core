declare module 'vscode' {
	/**
	 * Controls how the task channel is used between tasks
	 */
	export enum TaskPanelKind {

		/**
		 * Shares a panel with other tasks. This is the default.
		 */
		Shared = 1,

		/**
		 * Uses a dedicated panel for this tasks. The panel is not
		 * shared with other tasks.
		 */
		Dedicated = 2,

		/**
		 * Creates a new panel whenever this task is executed.
		 */
		New = 3,
	}


	/**
	 * Controls the behaviour of the terminal's visibility.
	 */
	export enum TaskRevealKind {
		/**
		 * Always brings the terminal to front if the task is executed.
		 */
		Always = 1,

		/**
		 * Only brings the terminal to front if a problem is detected executing the task
		 * (e.g. the task couldn't be started because).
		 */
		Silent = 2,

		/**
		 * The terminal never comes to front when the task is executed.
		 */
		Never = 3,
	}

	/**
	 * Controls how the task is presented in the UI.
	 */
	export interface TaskPresentationOptions {
		/**
		 * Controls whether the task output is reveal in the user interface.
		 * Defaults to `RevealKind.Always`.
		 */
		reveal?: TaskRevealKind;

		/**
		 * Controls whether the command associated with the task is echoed
		 * in the user interface.
		 */
		echo?: boolean;

		/**
		 * Controls whether the panel showing the task output is taking focus.
		 */
		focus?: boolean;

		/**
		 * Controls if the task panel is used for this task only (dedicated),
		 * shared between tasks (shared) or if a new panel is created on
		 * every task execution (new). Defaults to `TaskInstanceKind.Shared`
		 */
		panel?: TaskPanelKind;

		/**
		 * Controls whether to show the "Terminal will be reused by tasks, press any key to close it" message.
		 */
		showReuseMessage?: boolean;

		/**
		 * Controls whether the terminal is cleared before executing the task.
		 */
		clear?: boolean;
	}

	/**
	 * A grouping for tasks. The editor by default supports the
	 * 'Clean', 'Build', 'RebuildAll' and 'Test' group.
	 */
	export class TaskGroup {

		/**
		 * The clean task group;
		 */
		static Clean: TaskGroup;

		/**
		 * The build task group;
		 */
		static Build: TaskGroup;

		/**
		 * The rebuild all task group;
		 */
		static Rebuild: TaskGroup;

		/**
		 * The test all task group;
		 */
		static Test: TaskGroup;

		/**
		 * Whether the task that is part of this group is the default for the group.
		 * This property cannot be set through API, and is controlled by a user's task configurations.
		 */
		readonly isDefault?: boolean;

		/**
		* The ID of the task group. Is one of TaskGroup.Clean.id, TaskGroup.Build.id, TaskGroup.Rebuild.id, or TaskGroup.Test.id.
		*/
		readonly id: string;

		private constructor(id: string, label: string);
	}

	/**
	 * A structure that defines a task kind in the system.
	 * The value must be JSON-stringifyable.
	 */
	export interface TaskDefinition {
		/**
		 * The task definition describing the task provided by an extension.
		 * Usually a task provider defines more properties to identify
		 * a task. They need to be defined in the package.json of the
		 * extension under the 'taskDefinitions' extension point. The npm
		 * task definition for example looks like this
		 * ```typescript
		 * interface NpmTaskDefinition extends TaskDefinition {
		 *     script: string;
		 * }
		 * ```
		 *
		 * Note that type identifier starting with a '$' are reserved for internal
		 * usages and shouldn't be used by extensions.
		 */
		readonly type: string;

		/**
		 * Additional attributes of a concrete task definition.
		 */
		[name: string]: any;
	}

	/**
	 * Options for a process execution
	 */
	export interface ProcessExecutionOptions {
		/**
		 * The current working directory of the executed program or shell.
		 * If omitted the tools current workspace root is used.
		 */
		cwd?: string;

		/**
		 * The additional environment of the executed program or shell. If omitted
		 * the parent process' environment is used. If provided it is merged with
		 * the parent process' environment.
		 */
		env?: { [key: string]: string };
	}

	/**
	 * The execution of a task happens as an external process
	 * without shell interaction.
	 */
	export class ProcessExecution {

		/**
		 * Creates a process execution.
		 *
		 * @param process The process to start.
		 * @param options Optional options for the started process.
		 */
		constructor(process: string, options?: ProcessExecutionOptions);

		/**
		 * Creates a process execution.
		 *
		 * @param process The process to start.
		 * @param args Arguments to be passed to the process.
		 * @param options Optional options for the started process.
		 */
		constructor(process: string, args: string[], options?: ProcessExecutionOptions);

		/**
		 * The process to be executed.
		 */
		process: string;

		/**
		 * The arguments passed to the process. Defaults to an empty array.
		 */
		args: string[];

		/**
		 * The process options used when the process is executed.
		 * Defaults to undefined.
		 */
		options?: ProcessExecutionOptions;
	}

	/**
	 * The shell quoting options.
	 */
	export interface ShellQuotingOptions {

		/**
		 * The character used to do character escaping. If a string is provided only spaces
		 * are escaped. If a `{ escapeChar, charsToEscape }` literal is provide all characters
		 * in `charsToEscape` are escaped using the `escapeChar`.
		 */
		escape?: string | {
			/**
			 * The escape character.
			 */
			escapeChar: string;
			/**
			 * The characters to escape.
			 */
			charsToEscape: string;
		};

		/**
		 * The character used for strong quoting. The string's length must be 1.
		 */
		strong?: string;

		/**
		 * The character used for weak quoting. The string's length must be 1.
		 */
		weak?: string;
	}

	/**
	 * Options for a shell execution
	 */
	export interface ShellExecutionOptions {
		/**
		 * The shell executable.
		 */
		executable?: string;

		/**
		 * The arguments to be passed to the shell executable used to run the task. Most shells
		 * require special arguments to execute a command. For  example `bash` requires the `-c`
		 * argument to execute a command, `PowerShell` requires `-Command` and `cmd` requires both
		 * `/d` and `/c`.
		 */
		shellArgs?: string[];

		/**
		 * The shell quotes supported by this shell.
		 */
		shellQuoting?: ShellQuotingOptions;

		/**
		 * The current working directory of the executed shell.
		 * If omitted the tools current workspace root is used.
		 */
		cwd?: string;

		/**
		 * The additional environment of the executed shell. If omitted
		 * the parent process' environment is used. If provided it is merged with
		 * the parent process' environment.
		 */
		env?: { [key: string]: string };
	}

	/**
	 * Defines how an argument should be quoted if it contains
	 * spaces or unsupported characters.
	 */
	export enum ShellQuoting {

		/**
		 * Character escaping should be used. This for example
		 * uses \ on bash and ` on PowerShell.
		 */
		Escape = 1,

		/**
		 * Strong string quoting should be used. This for example
		 * uses " for Windows cmd and ' for bash and PowerShell.
		 * Strong quoting treats arguments as literal strings.
		 * Under PowerShell echo 'The value is $(2 * 3)' will
		 * print `The value is $(2 * 3)`
		 */
		Strong = 2,

		/**
		 * Weak string quoting should be used. This for example
		 * uses " for Windows cmd, bash and PowerShell. Weak quoting
		 * still performs some kind of evaluation inside the quoted
		 * string.  Under PowerShell echo "The value is $(2 * 3)"
		 * will print `The value is 6`
		 */
		Weak = 3,
	}

	/**
	 * A string that will be quoted depending on the used shell.
	 */
	export interface ShellQuotedString {
		/**
		 * The actual string value.
		 */
		value: string;

		/**
		 * The quoting style to use.
		 */
		quoting: ShellQuoting;
	}

	export class ShellExecution {
		/**
		 * Creates a shell execution with a full command line.
		 *
		 * @param commandLine The command line to execute.
		 * @param options Optional options for the started the shell.
		 */
		constructor(commandLine: string, options?: ShellExecutionOptions);

		/**
		 * Creates a shell execution with a command and arguments. For the real execution VS Code will
		 * construct a command line from the command and the arguments. This is subject to interpretation
		 * especially when it comes to quoting. If full control over the command line is needed please
		 * use the constructor that creates a `ShellExecution` with the full command line.
		 *
		 * @param command The command to execute.
		 * @param args The command arguments.
		 * @param options Optional options for the started the shell.
		 */
		constructor(command: string | ShellQuotedString, args: (string | ShellQuotedString)[], options?: ShellExecutionOptions);

		/**
		 * The shell command line. Is `undefined` if created with a command and arguments.
		 */
		commandLine: string;

		/**
		 * The shell command. Is `undefined` if created with a full command line.
		 */
		command: string | ShellQuotedString;

		/**
		 * The shell args. Is `undefined` if created with a full command line.
		 */
		args: (string | ShellQuotedString)[];

		/**
		 * The shell options used when the command line is executed in a shell.
		 * Defaults to undefined.
		 */
		options?: ShellExecutionOptions;
	}

	/**
	 * The scope of a task.
	 */
	export enum TaskScope {
		/**
		 * The task is a global task
		 */
		Global = 1,

		/**
		 * The task is a workspace task
		 */
		Workspace = 2,
	}

	/**
	 * Run options for a task.
	 */
	export interface RunOptions {
		/**
		 * Controls whether task variables are re-evaluated on rerun.
		 */
		reevaluateOnRerun?: boolean;
	}

	/**
	 * A task to execute
	 */
	export class Task {

		/**
		 * Creates a new task.
		 *
		 * @param definition The task definition as defined in the taskDefinitions extension point.
		 * @param scope Specifies the task's scope. It is either a global or a workspace task or a task for a specific workspace folder.
		 * @param name The task's name. Is presented in the user interface.
		 * @param source The task's source (e.g. 'gulp', 'npm', ...). Is presented in the user interface.
		 * @param execution The process or shell execution.
		 * @param problemMatchers the names of problem matchers to use, like '$tsc'
		 *  or '$eslint'. Problem matchers can be contributed by an extension using
		 *  the `problemMatchers` extension point.
		 */
		constructor(taskDefinition: TaskDefinition, scope: WorkspaceFolder | TaskScope.Global | TaskScope.Workspace, name: string, source: string, execution?: ProcessExecution | ShellExecution | CustomExecution, problemMatchers?: string | string[]);

		/**
		 * ~~Creates a new task.~~
		 *
		 * @deprecated Use the new constructors that allow specifying a scope for the task.
		 *
		 * @param definition The task definition as defined in the taskDefinitions extension point.
		 * @param name The task's name. Is presented in the user interface.
		 * @param source The task's source (e.g. 'gulp', 'npm', ...). Is presented in the user interface.
		 * @param execution The process or shell execution.
		 * @param problemMatchers the names of problem matchers to use, like '$tsc'
		 *  or '$eslint'. Problem matchers can be contributed by an extension using
		 *  the `problemMatchers` extension point.
		 */
		constructor(taskDefinition: TaskDefinition, name: string, source: string, execution?: ProcessExecution | ShellExecution | CustomExecution, problemMatchers?: string | string[]);
		/**
		 * ~~Creates a new task.~~
		 *
		 * @deprecated Use the new constructors that allow specifying a scope for the task.
		 *
		 * @param definition The task definition as defined in the taskDefinitions extension point.
		 * @param name The task's name. Is presented in the user interface.
		 * @param source The task's source (e.g. 'gulp', 'npm', ...). Is presented in the user interface.
		 * @param execution The process or shell execution.
		 * @param problemMatchers the names of problem matchers to use, like '$tsc'
		 *  or '$eslint'. Problem matchers can be contributed by an extension using
		 *  the `problemMatchers` extension point.
		 */
		constructor(taskDefinition: TaskDefinition, name: string, source: string, execution?: ProcessExecution | ShellExecution, problemMatchers?: string | string[]);

		/**
		 * The task's definition.
		 */
		definition: TaskDefinition;

		/**
		 * The task's scope.
		 */
		readonly scope?: TaskScope.Global | TaskScope.Workspace | WorkspaceFolder;

		/**
		 * The task's name
		 */
		name: string;

		/**
		 * A human-readable string which is rendered less prominently on a separate line in places
		 * where the task's name is displayed. Supports rendering of {@link ThemeIcon theme icons}
		 * via the `$(<name>)`-syntax.
		 */
		detail?: string;

		/**
		 * The task's execution engine
		 */
		execution?: ProcessExecution | ShellExecution | CustomExecution;

		/**
		 * Whether the task is a background task or not.
		 */
		isBackground: boolean;

		/**
		 * A human-readable string describing the source of this
		 * shell task, e.g. 'gulp' or 'npm'.
		 */
		source: string;

		/**
		 * The task group this tasks belongs to. See TaskGroup
		 * for a predefined set of available groups.
		 * Defaults to undefined meaning that the task doesn't
		 * belong to any special group.
		 */
		group?: TaskGroup;

		/**
		 * The presentation options. Defaults to an empty literal.
		 */
		presentationOptions: TaskPresentationOptions;

		/**
		 * The problem matchers attached to the task. Defaults to an empty
		 * array.
		 */
		problemMatchers: string[];

		/**
		 * Run options for the task
		 */
		runOptions: RunOptions;
	}

	/**
	 * A task provider allows to add tasks to the task service.
	 * A task provider is registered via #tasks.registerTaskProvider.
	 */
	export interface TaskProvider<T extends Task = Task> {
		/**
		 * Provides tasks.
		 * @param token A cancellation token.
		 * @return an array of tasks
		 */
		provideTasks(token: CancellationToken): ProviderResult<T[]>;

		/**
		 * Resolves a task that has no {@link Task.execution `execution`} set. Tasks are
		 * often created from information found in the `tasks.json`-file. Such tasks miss
		 * the information on how to execute them and a task provider must fill in
		 * the missing information in the `resolveTask`-method. This method will not be
		 * called for tasks returned from the above `provideTasks` method since those
		 * tasks are always fully resolved. A valid default implementation for the
		 * `resolveTask` method is to return `undefined`.
		 *
		 * Note that when filling in the properties of `task`, you _must_ be sure to
		 * use the exact same `TaskDefinition` and not create a new one. Other properties
		 * may be changed.
		 *
		 * @param task The task to resolve.
		 * @param token A cancellation token.
		 * @return The resolved task
		 */
		resolveTask(task: T, token: CancellationToken): ProviderResult<T>;
	}

	/**
	 * An object representing an executed Task. It can be used
	 * to terminate a task.
	 *
	 * This interface is not intended to be implemented.
	 */
	export interface TaskExecution {
		/**
		 * The task that got started.
		 */
		task: Task;

		/**
		 * Terminates the task execution.
		 */
		terminate(): void;
	}

	/**
	 * An event signaling the start of a task execution.
	 *
	 * This interface is not intended to be implemented.
	 */
	interface TaskStartEvent {
		/**
		 * The task item representing the task that got started.
		 */
		readonly execution: TaskExecution;
	}

	/**
	 * An event signaling the end of an executed task.
	 *
	 * This interface is not intended to be implemented.
	 */
	interface TaskEndEvent {
		/**
		 * The task item representing the task that finished.
		 */
		readonly execution: TaskExecution;
	}

	/**
	 * An event signaling the start of a process execution
	 * triggered through a task
	 */
	export interface TaskProcessStartEvent {

		/**
		 * The task execution for which the process got started.
		 */
		readonly execution: TaskExecution;

		/**
		 * The underlying process id.
		 */
		readonly processId: number;
	}

	/**
	 * An event signaling the end of a process execution
	 * triggered through a task
	 */
	export interface TaskProcessEndEvent {

		/**
		 * The task execution for which the process got started.
		 */
		readonly execution: TaskExecution;

		/**
		 * The process's exit code.
		 */
		readonly exitCode: number;
	}

	export interface TaskFilter {
		/**
		 * The task version as used in the tasks.json file.
		 * The string support the package.json semver notation.
		 */
		version?: string;

		/**
		 * The task type to return;
		 */
		type?: string;
	}

	/**
	 * Namespace for tasks functionality.
	 */
	export namespace tasks {

		/**
		 * Register a task provider.
		 *
		 * @param type The task kind type this provider is registered for.
		 * @param provider A task provider.
		 * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
		 */
		export function registerTaskProvider(type: string, provider: TaskProvider): Disposable;

		/**
		 * Fetches all tasks available in the systems. This includes tasks
		 * from `tasks.json` files as well as tasks from task providers
		 * contributed through extensions.
		 *
		 * @param filter Optional filter to select tasks of a certain type or version.
		 */
		export function fetchTasks(filter?: TaskFilter): Thenable<Task[]>;

		/**
		 * Executes a task that is managed by VS Code. The returned
		 * task execution can be used to terminate the task.
		 *
		 * @param task the task to execute
		 */
		export function executeTask(task: Task): Thenable<TaskExecution>;

		/**
		 * The currently active task executions or an empty array.
		 */
		export const taskExecutions: ReadonlyArray<TaskExecution>;

		/**
		 * Fires when a task starts.
		 */
		export const onDidStartTask: Event<TaskStartEvent>;

		/**
		 * Fires when a task ends.
		 */
		export const onDidEndTask: Event<TaskEndEvent>;

		/**
		 * Fires when the underlying process has been started.
		 * This event will not fire for tasks that don't
		 * execute an underlying process.
		 */
		export const onDidStartTaskProcess: Event<TaskProcessStartEvent>;

		/**
		 * Fires when the underlying process has ended.
		 * This event will not fire for tasks that don't
		 * execute an underlying process.
		 */
		export const onDidEndTaskProcess: Event<TaskProcessEndEvent>;
	}
}
