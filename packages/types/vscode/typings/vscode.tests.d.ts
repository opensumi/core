declare module "vscode" {
  /**
   * Namespace for testing functionality. Tests are published by registering
   * {@link TestController} instances, then adding {@link TestItem TestItems}.
   * Controllers may also describe how to run tests by creating one or more
   * {@link TestRunProfile} instances.
   */
  export namespace tests {
    /**
     * Creates a new test controller.
     *
     * @param id Identifier for the controller, must be globally unique.
     * @param label A human-readable label for the controller.
     * @returns An instance of the {@link TestController}.
     */
    export function createTestController(
      id: string,
      label: string
    ): TestController;


    //#region Test Observer
    /**
     * Requests that tests be run by their controller.
     * @param run Run options to use.
     * @param token Cancellation token for the test run
     */
    export function runTests(run: TestRunRequest, token?: CancellationToken): Thenable<void>;

    /**
     * Returns an observer that watches and can request tests.
     */
    export function createTestObserver(): TestObserver;
    /**
     * List of test results stored by the editor, sorted in descending
     * order by their `completedAt` time.
     */
    export const testResults: ReadonlyArray<TestRunResult>;

    /**
     * Event that fires when the {@link testResults} array is updated.
     */
    export const onDidChangeTestResults: Event<void>;
    //#endregion
  }
  /**
   * The kind of executions that {@link TestRunProfile TestRunProfiles} control.
   */
  export enum TestRunProfileKind {
    Run = 1,
    Debug = 2,
    Coverage = 3,
  }
  /**
   * A TestRunProfile describes one way to execute tests in a {@link TestController}.
   */
  export interface TestRunProfile {
    /**
     * Label shown to the user in the UI.
     *
     * Note that the label has some significance if the user requests that
     * tests be re-run in a certain way. For example, if tests were run
     * normally and the user requests to re-run them in debug mode, the editor
     * will attempt use a configuration with the same label of the `Debug`
     * kind. If there is no such configuration, the default will be used.
     */
    label: string;
    /**
     * Configures what kind of execution this profile controls. If there
     * are no profiles for a kind, it will not be available in the UI.
     */
    readonly kind: TestRunProfileKind;
    /**
     * Controls whether this profile is the default action that will
     * be taken when its kind is actioned. For example, if the user clicks
     * the generic "run all" button, then the default profile for
     * {@link TestRunProfileKind.Run} will be executed, although the
     * user can configure this.
     */
    isDefault: boolean;
    /**
     * Fired when a user has changed whether this is a default profile. The
     * event contains the new value of {@link isDefault}
     */
    onDidChangeDefault: Event<boolean>;
    /**
     * Whether this profile supports continuous running of requests. If so,
     * then {@link TestRunRequest.continuous} may be set to `true`. Defaults
     * to false.
     */
    supportsContinuousRun: boolean;
    /**
     * Associated tag for the profile. If this is set, only {@link TestItem}
     * instances with the same tag will be eligible to execute in this profile.
     */
    tag: TestTag | undefined;
    /**
     * If this method is present, a configuration gear will be present in the
     * UI, and this method will be invoked when it's clicked. When called,
     * you can take other editor actions, such as showing a quick pick or
     * opening a configuration file.
     */
    configureHandler: (() => void) | undefined;
    /**
     * Handler called to start a test run. When invoked, the function should call
     * {@link TestController.createTestRun} at least once, and all test runs
     * associated with the request should be created before the function returns
     * or the returned promise is resolved.
     *
     * If {@link supportsContinuousRun} is set, then {@link TestRunRequest.continuous}
     * may be `true`. In this case, the profile should observe changes to
     * source code and create new test runs by calling {@link TestController.createTestRun},
     * until the cancellation is requested on the `token`.
     *
     * @param request Request information for the test run.
     * @param cancellationToken Token that signals the used asked to abort the
     * test run. If cancellation is requested on this token, all {@link TestRun}
     * instances associated with the request will be
     * automatically cancelled as well.
     */
    runHandler: (
      request: TestRunRequest,
      token: CancellationToken
    ) => Thenable<void> | void;

    /**
     * An extension-provided function that provides detailed statement and
     * function-level coverage for a file. The editor will call this when more
     * detail is needed for a file, such as when it's opened in an editor or
     * expanded in the **Test Coverage** view.
     *
     * The {@link FileCoverage} object passed to this function is the same instance
     * emitted on {@link TestRun.addCoverage} calls associated with this profile.
     */
    loadDetailedCoverage?: (testRun: TestRun, fileCoverage: FileCoverage, token: CancellationToken) => Thenable<FileCoverageDetail[]>;

    /**
     * An extension-provided function that provides detailed statement and
     * function-level coverage for a single test in a file. This is the per-test
     * sibling of {@link TestRunProfile.loadDetailedCoverage}, called only if
     * a test item is provided in {@link FileCoverage.includesTests} and only
     * for files where such data is reported.
     *
     * Often {@link TestRunProfile.loadDetailedCoverage} will be called first
     * when a user opens a file, and then this method will be called if they
     * drill down into specific per-test coverage information. This method
     * should then return coverage data only for statements and declarations
     * executed by the specific test during the run.
     *
     * The {@link FileCoverage} object passed to this function is the same
     * instance emitted on {@link TestRun.addCoverage} calls associated with this profile.
     *
     * @param testRun The test run that generated the coverage data.
     * @param fileCoverage The file coverage object to load detailed coverage for.
     * @param fromTestItem The test item to request coverage information for.
     * @param token A cancellation token that indicates the operation should be cancelled.
     */
    loadDetailedCoverageForTest?: (testRun: TestRun, fileCoverage: FileCoverage, fromTestItem: TestItem, token: CancellationToken) => Thenable<FileCoverageDetail[]>;

    /**
     * Deletes the run profile.
     */
    dispose(): void;
  }
  /**
   * Entry point to discover and execute tests. It contains {@link TestController.items} which
   * are used to populate the editor UI, and is associated with
   * {@link TestController.createRunProfile run profiles} to allow
   * for tests to be executed.
   */
  export interface TestController {
    /**
     * The id of the controller passed in {@link vscode.tests.createTestController}.
     * This must be globally unique.
     */
    readonly id: string;
    /**
     * Human-readable label for the test controller.
     */
    label: string;
    /**
     * A collection of "top-level" {@link TestItem} instances, which can in
     * turn have their own {@link TestItem.children children} to form the
     * "test tree."
     *
     * The extension controls when to add tests. For example, extensions should
     * add tests for a file when {@link vscode.workspace.onDidOpenTextDocument}
     * fires in order for decorations for tests within a file to be visible.
     *
     * However, the editor may sometimes explicitly request children using the
     * {@link resolveHandler} See the documentation on that method for more details.
     */
    readonly items: TestItemCollection;
    /**
     * Creates a profile used for running tests. Extensions must create
     * at least one profile in order for tests to be run.
     * @param label A human-readable label for this profile.
     * @param kind Configures what kind of execution this profile manages.
     * @param runHandler Function called to start a test run.
     * @param isDefault Whether this is the default action for its kind.
     * @param tag Profile test tag.
     * @returns An instance of a {@link TestRunProfile}, which is automatically
     * associated with this controller.
     */
    createRunProfile(
      label: string,
      kind: TestRunProfileKind,
      runHandler: (
        request: TestRunRequest,
        token: CancellationToken
      ) => Thenable<void> | void,
      isDefault?: boolean,
      tag?: TestTag
    ): TestRunProfile;
    /**
     * A function provided by the extension that the editor may call to request
     * children of a test item, if the {@link TestItem.canResolveChildren} is
     * `true`. When called, the item should discover children and call
     * {@link vscode.tests.createTestItem} as children are discovered.
     *
     * Generally the extension manages the lifecycle of test items, but under
     * certain conditions the editor may request the children of a specific
     * item to be loaded. For example, if the user requests to re-run tests
     * after reloading the editor, the editor may need to call this method
     * to resolve the previously-run tests.
     *
     * The item in the explorer will automatically be marked as "busy" until
     * the function returns or the returned thenable resolves.
     *
     * @param item An unresolved test item for which children are being
     * requested, or `undefined` to resolve the controller's initial {@link items}.
     */
    resolveHandler?: (item: TestItem | undefined) => Thenable<void> | void;

    /**
     * If this method is present, a refresh button will be present in the
     * UI, and this method will be invoked when it's clicked. When called,
     * the extension should scan the workspace for any new, changed, or
     * removed tests.
     *
     * It's recommended that extensions try to update tests in realtime, using
     * a {@link FileSystemWatcher} for example, and use this method as a fallback.
     *
     * @returns A thenable that resolves when tests have been refreshed.
     */
    refreshHandler: ((token: CancellationToken) => Thenable<void> | void) | undefined;

    /**
     * Creates a {@link TestRun}. This should be called by the
     * {@link TestRunProfile} when a request is made to execute tests, and may
     * also be called if a test run is detected externally. Once created, tests
     * that are included in the request will be moved into the queued state.
     *
     * All runs created using the same `request` instance will be grouped
     * together. This is useful if, for example, a single suite of tests is
     * run on multiple platforms.
     *
     * @param request Test run request. Only tests inside the `include` may be
     * modified, and tests in its `exclude` are ignored.
     * @param name The human-readable name of the run. This can be used to
     * disambiguate multiple sets of results in a test run. It is useful if
     * tests are run across multiple platforms, for example.
     * @param persist Whether the results created by the run should be
     * persisted in the editor. This may be false if the results are coming from
     * a file already saved externally, such as a coverage information file.
     * @returns An instance of the {@link TestRun}. It will be considered "running"
     * from the moment this method is invoked until {@link TestRun.end} is called.
     */
    createTestRun(
      request: TestRunRequest,
      name?: string,
      persist?: boolean
    ): TestRun;
    /**
     * Creates a new managed {@link TestItem} instance. It can be added into
     * the {@link TestItem.children} of an existing item, or into the
     * {@link TestController.items}.
     *
     * @param id Identifier for the TestItem. The test item's ID must be unique
     * in the {@link TestItemCollection} it's added to.
     * @param label Human-readable label of the test item.
     * @param uri URI this TestItem is associated with. May be a file or directory.
     */
    createTestItem(id: string, label: string, uri?: Uri): TestItem;
    /**
     * Marks an item's results as being outdated. This is commonly called when
     * code or configuration changes and previous results should no longer
     * be considered relevant. The same logic used to mark results as outdated
     * may be used to drive {@link TestRunRequest.continuous continuous test runs}.
     *
     * If an item is passed to this method, test results for the item and all of
     * its children will be marked as outdated. If no item is passed, then all
     * test owned by the TestController will be marked as outdated.
     *
     * Any test runs started before the moment this method is called, including
     * runs which may still be ongoing, will be marked as outdated and deprioritized
     * in the editor's UI.
     *
     * @param item Item to mark as outdated. If undefined, all the controller's items are marked outdated.
     */
    invalidateTestResults(items?: TestItem | readonly TestItem[]): void;
    /**
     * Unregisters the test controller, disposing of its associated tests
     * and unpersisted results.
     */
    dispose(): void;
  }
  /**
   * A TestRunRequest is a precursor to a {@link TestRun}, which in turn is
   * created by passing a request to {@link tests.runTests}. The TestRunRequest
   * contains information about which tests should be run, which should not be
   * run, and how they are run (via the {@link profile}).
   *
   * In general, TestRunRequests are created by the editor and pass to
   * {@link TestRunProfile.runHandler}, however you can also create test
   * requests and runs outside of the `runHandler`.
   */
  export class TestRunRequest {
    /**
     * A filter for specific tests to run. If given, the extension should run
     * all of the included tests and all their children, excluding any tests
     * that appear in {@link TestRunRequest.exclude}. If this property is
     * undefined, then the extension should simply run all tests.
     *
     * The process of running tests should resolve the children of any test
     * items who have not yet been resolved.
     */
    readonly include: TestItem[] | undefined;
    /**
     * An array of tests the user has marked as excluded from the test included
     * in this run; exclusions should apply after inclusions.
     *
     * May be omitted if no exclusions were requested. Test controllers should
     * not run excluded tests or any children of excluded tests.
     */
    readonly exclude: TestItem[] | undefined;
    /**
     * The profile used for this request. This will always be defined
     * for requests issued from the editor UI, though extensions may
     * programmatically create requests not associated with any profile.
     */
    readonly profile: TestRunProfile | undefined;
    /**
     * Whether the profile should run continuously as source code changes. Only
     * relevant for profiles that set {@link TestRunProfile.supportsContinuousRun}.
     */
    readonly continuous?: boolean;
    /**
     * Controls how test Test Results view is focused.  If true, the editor
     * will keep the maintain the user's focus. If false, the editor will
     * prefer to move focus into the Test Results view, although
     * this may be configured by users.
    */
    readonly preserveFocus?: boolean;
    /**
     * @param tests Array of specific tests to run, or undefined to run all tests
     * @param exclude An array of tests to exclude from the run.
     * @param profile The run profile used for this request.
     */
    constructor(
      include?: readonly TestItem[],
      exclude?: readonly TestItem[],
      profile?: TestRunProfile
    );
  }
  /**
   * Tags can be associated with {@link TestItem TestItems} and
   * {@link TestRunProfile TestRunProfiles}. A profile with a tag can only
   * execute tests that include that tag in their {@link TestItem.tags} array.
   */
  export class TestTag {
    /**
     * ID of the test tag. `TestTag` instances with the same ID are considered
     * to be identical.
     */
    readonly id: string;
    /**
     * Creates a new TestTag instance.
     * @param id ID of the test tag.
     */
    constructor(id: string);
  }
  /**
   * Options given to {@link TestController.runTests}
   */
  export interface TestRun {
    /**
     * The human-readable name of the run. This can be used to
     * disambiguate multiple sets of results in a test run. It is useful if
     * tests are run across multiple platforms, for example.
     */
    readonly name: string | undefined;
    /**
     * A cancellation token which will be triggered when the test run is
     * canceled from the UI.
     */
    readonly token: CancellationToken;
    /**
     * Whether the test run will be persisted across reloads by the editor.
     */
    readonly isPersisted: boolean;
    /**
     * Indicates a test is queued for later execution.
     * @param test Test item to update.
     */
    enqueued(test: TestItem): void;
    /**
     * Indicates a test has started running.
     * @param test Test item to update.
     */
    started(test: TestItem): void;
    /**
     * Indicates a test has been skipped.
     * @param test Test item to update.
     */
    skipped(test: TestItem): void;
    /**
     * Indicates a test has failed. You should pass one or more
     * {@link TestMessage TestMessages} to describe the failure.
     * @param test Test item to update.
     * @param messages Messages associated with the test failure.
     * @param duration How long the test took to execute, in milliseconds.
     */
    failed(
      test: TestItem,
      message: TestMessage | readonly TestMessage[],
      duration?: number
    ): void;
    /**
     * Indicates a test has errored. You should pass one or more
     * {@link TestMessage TestMessages} to describe the failure. This differs
     * from the "failed" state in that it indicates a test that couldn't be
     * executed at all, from a compilation error for example.
     * @param test Test item to update.
     * @param messages Messages associated with the test failure.
     * @param duration How long the test took to execute, in milliseconds.
     */
    errored(
      test: TestItem,
      message: TestMessage | readonly TestMessage[],
      duration?: number
    ): void;
    /**
     * Indicates a test has passed.
     * @param test Test item to update.
     * @param duration How long the test took to execute, in milliseconds.
     */
    passed(test: TestItem, duration?: number): void;
    /**
     * Appends raw output from the test runner. On the user's request, the
     * output will be displayed in a terminal. ANSI escape sequences,
     * such as colors and text styles, are supported.
     *
     * @param output Output text to append.
     * @param location Indicate that the output was logged at the given
     * location.
     * @param test Test item to associate the output with.
     */
    appendOutput(output: string, location?: Location, test?: TestItem): void;
    /**
     * Adds coverage for a file in the run.
     */
    addCoverage(fileCoverage: FileCoverage): void;
    /**
     * Signals that the end of the test run. Any tests included in the run whose
     * states have not been updated will have their state reset.
     */
    end(): void;
    /**
     * An event fired when the editor is no longer interested in data
     * associated with the test run.
     */
    onDidDispose: Event<void>;
  }

  /**
   * Collection of test items, found in {@link TestItem.children} and
   * {@link TestController.items}.
   */
  export interface TestItemCollection {
    /**
     * Gets the number of items in the collection.
     */
    readonly size: number;
    /**
     * Replaces the items stored by the collection.
     * @param items Items to store.
     */
    replace(items: readonly TestItem[]): void;
    /**
     * Iterate over each entry in this collection.
     *
     * @param callback Function to execute for each entry.
     * @param thisArg The `this` context used when invoking the handler function.
     */
    forEach(
      callback: (item: TestItem, collection: TestItemCollection) => unknown,
      thisArg?: unknown
    ): void;
    /**
     * Adds the test item to the children. If an item with the same ID already
     * exists, it'll be replaced.
     * @param items Item to add.
     */
    add(item: TestItem): void;
    /**
     * Removes a single test item from the collection.
     * @param itemId Item ID to delete.
     */
    delete(itemId: string): void;
    /**
     * Efficiently gets a test item by ID, if it exists, in the children.
     * @param itemId Item ID to get.
     * @returns The found item or undefined if it does not exist.
     */
    get(itemId: string): TestItem | undefined;
  }
  /**
   * An item shown in the "test explorer" view.
   *
   * A `TestItem` can represent either a test suite or a test itself, since
   * they both have similar capabilities.
   */
  export interface TestItem {
    /**
     * Identifier for the `TestItem`. This is used to correlate
     * test results and tests in the document with those in the workspace
     * (test explorer). This cannot change for the lifetime of the `TestItem`,
     * and must be unique among its parent's direct children.
     */
    readonly id: string;
    /**
     * URI this `TestItem` is associated with. May be a file or directory.
     */
    readonly uri: Uri | undefined;
    /**
     * The children of this test item. For a test suite, this may contain the
     * individual test cases or nested suites.
     */
    readonly children: TestItemCollection;
    /**
     * The parent of this item. It's set automatically, and is undefined
     * top-level items in the {@link TestController.items} and for items that
     * aren't yet included in another item's {@link children}.
     */
    readonly parent: TestItem | undefined;
    /**
     * Tags associated with this test item. May be used in combination with
     * {@link TestRunProfile.tags}, or simply as an organizational feature.
     */
    tags: readonly TestTag[];
    /**
     * Indicates whether this test item may have children discovered by resolving.
     *
     * If true, this item is shown as expandable in the Test Explorer view and
     * expanding the item will cause {@link TestController.resolveHandler}
     * to be invoked with the item.
     *
     * Default to `false`.
     */
    canResolveChildren: boolean;
    /**
     * Controls whether the item is shown as "busy" in the Test Explorer view.
     * This is useful for showing status while discovering children.
     *
     * Defaults to `false`.
     */
    busy: boolean;
    /**
     * Display name describing the test case.
     */
    label: string;
    /**
     * Optional description that appears next to the label.
     */
    description?: string;
    /**
     * A string that should be used when comparing this item
     * with other items. When `falsy` the {@link TestItem.label label}
     * is used.
     */
    sortText?: string | undefined;
    /**
     * Location of the test item in its {@link uri}.
     *
     * This is only meaningful if the `uri` points to a file.
     */
    range: Range | undefined;
    /**
     * Optional error encountered while loading the test.
     *
     * Note that this is not a test result and should only be used to represent errors in
     * test discovery, such as syntax errors.
     */
    error: string | MarkdownString | undefined;
    /**
     * Marks the test as outdated. This can happen as a result of file changes,
     * for example. In "auto run" mode, tests that are outdated will be
     * automatically rerun after a short delay. Invoking this on a
     * test with children will mark the entire subtree as outdated.
     *
     * Extensions should generally not override this method.
     */
    // todo@api still unsure about this
    invalidateResults(): void;
  }
  /**
   * Message associated with the test state. Can be linked to a specific
   * source range -- useful for assertion failures, for example.
   */
  export class TestMessage {
    /**
     * Human-readable message text to display.
     */
    message: string | MarkdownString;
    /**
     * Expected test output. If given with {@link actualOutput}, a diff view will be shown.
     */
    expectedOutput?: string;
    /**
     * Actual test output. If given with {@link expectedOutput}, a diff view will be shown.
     */
    actualOutput?: string;
    /**
     * Associated file location.
     */
    location?: Location;
    /**
     * Context value of the test item. This can be used to contribute message-
     * specific actions to the test peek view. The value set here can be found
     * in the `testMessage` property of the following `menus` contribution points:
     *
     * - `testing/message/context` - context menu for the message in the results tree
     * - `testing/message/content` - a prominent button overlaying editor content where
     *    the message is displayed.
     *
     * For example:
     *
     * ```json
     * "contributes": {
     *   "menus": {
     *     "testing/message/content": [
     *       {
     *         "command": "extension.deleteCommentThread",
     *         "when": "testMessage == canApplyRichDiff"
     *       }
     *     ]
     *   }
     * }
     * ```
     *
     * The command will be called with an object containing:
     * - `test`: the {@link TestItem} the message is associated with, *if* it
     *    is still present in the {@link TestController.items} collection.
     * - `message`: the {@link TestMessage} instance.
     */
    contextValue?: string;
    /**
     * Creates a new TestMessage that will present as a diff in the editor.
     * @param message Message to display to the user.
     * @param expected Expected output.
     * @param actual Actual output.
     */
    static diff(
      message: string | MarkdownString,
      expected: string,
      actual: string
    ): TestMessage;
    /**
     * Creates a new TestMessage instance.
     * @param message The message to show to the user.
     */
    constructor(message: string | MarkdownString);
  }

  /**
   * A class that contains information about a covered resource. A count can
   * be give for lines, branches, and declarations in a file.
   */
  export class TestCoverageCount {
    /**
     * Number of items covered in the file.
     */
    covered: number;
    /**
     * Total number of covered items in the file.
     */
    total: number;

    /**
     * @param covered Value for {@link TestCoverageCount.covered}
     * @param total Value for {@link TestCoverageCount.total}
     */
    constructor(covered: number, total: number);
  }

  //#region Test Observer

  export interface TestObserver {
    /**
     * List of tests returned by test provider for files in the workspace.
     */
    readonly tests: ReadonlyArray<TestItem>;

    /**
     * An event that fires when an existing test in the collection changes, or
     * null if a top-level test was added or removed. When fired, the consumer
     * should check the test item and all its children for changes.
     */
    readonly onDidChangeTest: Event<TestsChangeEvent>;

    /**
     * Dispose of the observer, allowing the editor to eventually tell test
     * providers that they no longer need to update tests.
     */
    dispose(): void;
  }

  export interface TestsChangeEvent {
    /**
     * List of all tests that are newly added.
     */
    readonly added: ReadonlyArray<TestItem>;

    /**
     * List of existing tests that have updated.
     */
    readonly updated: ReadonlyArray<TestItem>;

    /**
     * List of existing tests that have been removed.
     */
    readonly removed: ReadonlyArray<TestItem>;
  }

  /**
   * TestResults can be provided to the editor in {@link tests.publishTestResult},
   * or read from it in {@link tests.testResults}.
   *
   * The results contain a 'snapshot' of the tests at the point when the test
   * run is complete. Therefore, information such as its {@link Range} may be
   * out of date. If the test still exists in the workspace, consumers can use
   * its `id` to correlate the result instance with the living test.
   */
  export interface TestRunResult {
    /**
     * Unix milliseconds timestamp at which the test run was completed.
     */
    readonly completedAt: number;

    /**
     * Optional raw output from the test run.
     */
    readonly output?: string;

    /**
     * List of test results. The items in this array are the items that
     * were passed in the {@link tests.runTests} method.
     */
    readonly results: ReadonlyArray<Readonly<TestResultSnapshot>>;
  }

  /**
   * A {@link TestItem}-like interface with an associated result, which appear
   * or can be provided in {@link TestResult} interfaces.
   */
  export interface TestResultSnapshot {
    /**
     * Unique identifier that matches that of the associated TestItem.
     * This is used to correlate test results and tests in the document with
     * those in the workspace (test explorer).
     */
    readonly id: string;

    /**
     * Parent of this item.
     */
    readonly parent?: TestResultSnapshot;

    /**
     * URI this TestItem is associated with. May be a file or file.
     */
    readonly uri?: Uri;

    /**
     * Display name describing the test case.
     */
    readonly label: string;

    /**
     * Optional description that appears next to the label.
     */
    readonly description?: string;

    /**
     * Location of the test item in its `uri`. This is only meaningful if the
     * `uri` points to a file.
     */
    readonly range?: Range;

    /**
     * State of the test in each task. In the common case, a test will only
     * be executed in a single task and the length of this array will be 1.
     */
    readonly taskStates: ReadonlyArray<TestSnapshotTaskState>;

    /**
     * Optional list of nested tests for this item.
     */
    readonly children: Readonly<TestResultSnapshot>[];
  }

  export interface TestSnapshotTaskState {
    /**
     * Current result of the test.
     */
    readonly state: TestResultState;

    /**
     * The number of milliseconds the test took to run. This is set once the
     * `state` is `Passed`, `Failed`, or `Errored`.
     */
    readonly duration?: number;

    /**
     * Associated test run message. Can, for example, contain assertion
     * failure information if the test fails.
     */
    readonly messages: ReadonlyArray<TestMessage>;
  }

  /**
   * Possible states of tests in a test run.
   */
  export enum TestResultState {
    // Test will be run, but is not currently running.
    Queued = 1,
    // Test is currently running
    Running = 2,
    // Test run has passed
    Passed = 3,
    // Test run has failed (on an assertion)
    Failed = 4,
    // Test run has been skipped
    Skipped = 5,
    // Test run failed for some other reason (compilation error, timeout, etc)
    Errored = 6
  }
  //#endregion

  /**
   * A class that contains information about a covered resource. A count can
   * be give for lines, branches, and functions in a file.
   */
  export class CoveredCount {
    /**
     * Number of items covered in the file.
     */
    covered: number;
    /**
     * Total number of covered items in the file.
     */
    total: number;

    /**
     * @param covered Value for {@link CovereredCount.covered}
     * @param total Value for {@link CovereredCount.total}
     */
    constructor(covered: number, total: number);
  }

  /**
   * Contains coverage metadata for a file.
   */
  export class FileCoverage {
    /**
     * File URI.
     */
    readonly uri: Uri;

    /**
     * Statement coverage information. If the reporter does not provide statement
     * coverage information, this can instead be used to represent line coverage.
     */
    statementCoverage: TestCoverageCount;

    /**
     * Branch coverage information.
     */
    branchCoverage?: TestCoverageCount;

    /**
     * Declaration coverage information. Depending on the reporter and
     * language, this may be types such as functions, methods, or namespaces.
     */
    declarationCoverage?: TestCoverageCount;

    /**
     * A list of {@link TestItem test cases} that generated coverage in this
     * file. If set, then {@link TestRunProfile.loadDetailedCoverageForTest}
     * should also be defined in order to retrieve detailed coverage information.
     */
    includesTests?: TestItem[];

    /**
     * Creates a {@link FileCoverage} instance with counts filled in from
     * the coverage details.
     * @param uri Covered file URI
     * @param detailed Detailed coverage information
     */
    static fromDetails(uri: Uri, details: readonly FileCoverageDetail[]): FileCoverage;

    /**
     * @param uri Covered file URI
     * @param statementCoverage Statement coverage information. If the reporter
     * does not provide statement coverage information, this can instead be
     * used to represent line coverage.
     * @param branchCoverage Branch coverage information
     * @param declarationCoverage Declaration coverage information
     * @param includesTests Test cases included in this coverage report, see {@link includesTests}
     */
    constructor(
      uri: Uri,
      statementCoverage: TestCoverageCount,
      branchCoverage?: TestCoverageCount,
      declarationCoverage?: TestCoverageCount,
      includesTests?: TestItem[],
    );
  }

  /**
   * Contains coverage information for a single statement or line.
   */
  export class StatementCoverage {
    /**
     * The number of times this statement was executed, or a boolean indicating
     * whether it was executed if the exact count is unknown. If zero or false,
     * the statement will be marked as un-covered.
     */
    executed: number | boolean;

    /**
     * Statement location.
     */
    location: Position | Range;

    /**
     * Coverage from branches of this line or statement. If it's not a
     * conditional, this will be empty.
     */
    branches: BranchCoverage[];

    /**
     * @param location The statement position.
     * @param executed The number of times this statement was executed, or a
     * boolean indicating  whether it was executed if the exact count is
     * unknown. If zero or false, the statement will be marked as un-covered.
     * @param branches Coverage from branches of this line.  If it's not a
     * conditional, this should be omitted.
     */
    constructor(executed: number | boolean, location: Position | Range, branches?: BranchCoverage[]);
  }

  /**
   * Contains coverage information for a branch of a {@link StatementCoverage}.
   */
  export class BranchCoverage {
    /**
     * The number of times this branch was executed, or a boolean indicating
     * whether it was executed if the exact count is unknown. If zero or false,
     * the branch will be marked as un-covered.
     */
    executed: number | boolean;

    /**
     * Branch location.
     */
    location?: Position | Range;

    /**
     * Label for the branch, used in the context of "the ${label} branch was
     * not taken," for example.
     */
    label?: string;

    /**
     * @param executed The number of times this branch was executed, or a
     * boolean indicating  whether it was executed if the exact count is
     * unknown. If zero or false, the branch will be marked as un-covered.
     * @param location The branch position.
     */
    constructor(executed: number | boolean, location?: Position | Range, label?: string);
  }

  /**
   * Contains coverage information for a declaration. Depending on the reporter
   * and language, this may be types such as functions, methods, or namespaces.
   */
  export class DeclarationCoverage {
    /**
     * Name of the declaration.
     */
    name: string;

    /**
     * The number of times this declaration was executed, or a boolean
     * indicating whether it was executed if the exact count is unknown. If
     * zero or false, the declaration will be marked as un-covered.
     */
    executed: number | boolean;

    /**
     * Declaration location.
     */
    location: Position | Range;

    /**
     * @param executed The number of times this declaration was executed, or a
     * boolean indicating  whether it was executed if the exact count is
     * unknown. If zero or false, the declaration will be marked as un-covered.
     * @param location The declaration position.
     */
    constructor(name: string, executed: number | boolean, location: Position | Range);
  }

  /**
   * Coverage details returned from {@link TestRunProfile.loadDetailedCoverage}.
   */
  export type FileCoverageDetail = StatementCoverage | DeclarationCoverage;

  /**
   * Contains coverage information for a function or method.
   */
  export class FunctionCoverage {
    /**
     * The number of times this function was executed. If zero, the
     * function will be marked as un-covered.
     */
    executionCount: number;

    /**
     * Function location.
     */
    location: Position | Range;

    /**
     * @param executionCount The number of times this function was executed.
     * @param location The function position.
     */
    constructor(executionCount: number, location: Position | Range);
  }

  export type DetailedCoverage = StatementCoverage | FunctionCoverage;

  //#endregion
}
