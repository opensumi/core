'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageclient_1 = require("vscode-languageclient");
/**
 * The message type. Copied from vscode protocol
 */
var MessageType;
(function (MessageType) {
    /**
     * An error message.
     */
    MessageType[MessageType["Error"] = 1] = "Error";
    /**
     * A warning message.
     */
    MessageType[MessageType["Warning"] = 2] = "Warning";
    /**
     * An information message.
     */
    MessageType[MessageType["Info"] = 3] = "Info";
    /**
     * A log message.
     */
    MessageType[MessageType["Log"] = 4] = "Log";
})(MessageType = exports.MessageType || (exports.MessageType = {}));
/**
 * A functionality status
 */
var FeatureStatus;
(function (FeatureStatus) {
    /**
     * Disabled.
     */
    FeatureStatus[FeatureStatus["disabled"] = 0] = "disabled";
    /**
     * Enabled manually.
     */
    FeatureStatus[FeatureStatus["interactive"] = 1] = "interactive";
    /**
     * Enabled automatically.
     */
    FeatureStatus[FeatureStatus["automatic"] = 2] = "automatic";
})(FeatureStatus = exports.FeatureStatus || (exports.FeatureStatus = {}));
var CompileWorkspaceStatus;
(function (CompileWorkspaceStatus) {
    CompileWorkspaceStatus[CompileWorkspaceStatus["FAILED"] = 0] = "FAILED";
    CompileWorkspaceStatus[CompileWorkspaceStatus["SUCCEED"] = 1] = "SUCCEED";
    CompileWorkspaceStatus[CompileWorkspaceStatus["WITHERROR"] = 2] = "WITHERROR";
    CompileWorkspaceStatus[CompileWorkspaceStatus["CANCELLED"] = 3] = "CANCELLED";
})(CompileWorkspaceStatus = exports.CompileWorkspaceStatus || (exports.CompileWorkspaceStatus = {}));
var StatusNotification;
(function (StatusNotification) {
    StatusNotification.type = new vscode_languageclient_1.NotificationType('language/status');
})(StatusNotification = exports.StatusNotification || (exports.StatusNotification = {}));
var ProgressReportNotification;
(function (ProgressReportNotification) {
    ProgressReportNotification.type = new vscode_languageclient_1.NotificationType('language/progressReport');
})(ProgressReportNotification = exports.ProgressReportNotification || (exports.ProgressReportNotification = {}));
var ClassFileContentsRequest;
(function (ClassFileContentsRequest) {
    ClassFileContentsRequest.type = new vscode_languageclient_1.RequestType('java/classFileContents');
})(ClassFileContentsRequest = exports.ClassFileContentsRequest || (exports.ClassFileContentsRequest = {}));
var ProjectConfigurationUpdateRequest;
(function (ProjectConfigurationUpdateRequest) {
    ProjectConfigurationUpdateRequest.type = new vscode_languageclient_1.NotificationType('java/projectConfigurationUpdate');
})(ProjectConfigurationUpdateRequest = exports.ProjectConfigurationUpdateRequest || (exports.ProjectConfigurationUpdateRequest = {}));
var ActionableNotification;
(function (ActionableNotification) {
    ActionableNotification.type = new vscode_languageclient_1.NotificationType('language/actionableNotification');
})(ActionableNotification = exports.ActionableNotification || (exports.ActionableNotification = {}));
var CompileWorkspaceRequest;
(function (CompileWorkspaceRequest) {
    CompileWorkspaceRequest.type = new vscode_languageclient_1.RequestType('java/buildWorkspace');
})(CompileWorkspaceRequest = exports.CompileWorkspaceRequest || (exports.CompileWorkspaceRequest = {}));
var ExecuteClientCommandRequest;
(function (ExecuteClientCommandRequest) {
    ExecuteClientCommandRequest.type = new vscode_languageclient_1.RequestType('workspace/executeClientCommand');
})(ExecuteClientCommandRequest = exports.ExecuteClientCommandRequest || (exports.ExecuteClientCommandRequest = {}));
var SendNotificationRequest;
(function (SendNotificationRequest) {
    SendNotificationRequest.type = new vscode_languageclient_1.RequestType('workspace/notify');
})(SendNotificationRequest = exports.SendNotificationRequest || (exports.SendNotificationRequest = {}));
var ListOverridableMethodsRequest;
(function (ListOverridableMethodsRequest) {
    ListOverridableMethodsRequest.type = new vscode_languageclient_1.RequestType('java/listOverridableMethods');
})(ListOverridableMethodsRequest = exports.ListOverridableMethodsRequest || (exports.ListOverridableMethodsRequest = {}));
var AddOverridableMethodsRequest;
(function (AddOverridableMethodsRequest) {
    AddOverridableMethodsRequest.type = new vscode_languageclient_1.RequestType('java/addOverridableMethods');
})(AddOverridableMethodsRequest = exports.AddOverridableMethodsRequest || (exports.AddOverridableMethodsRequest = {}));
var CheckHashCodeEqualsStatusRequest;
(function (CheckHashCodeEqualsStatusRequest) {
    CheckHashCodeEqualsStatusRequest.type = new vscode_languageclient_1.RequestType('java/checkHashCodeEqualsStatus');
})(CheckHashCodeEqualsStatusRequest = exports.CheckHashCodeEqualsStatusRequest || (exports.CheckHashCodeEqualsStatusRequest = {}));
var GenerateHashCodeEqualsRequest;
(function (GenerateHashCodeEqualsRequest) {
    GenerateHashCodeEqualsRequest.type = new vscode_languageclient_1.RequestType('java/generateHashCodeEquals');
})(GenerateHashCodeEqualsRequest = exports.GenerateHashCodeEqualsRequest || (exports.GenerateHashCodeEqualsRequest = {}));
var OrganizeImportsRequest;
(function (OrganizeImportsRequest) {
    OrganizeImportsRequest.type = new vscode_languageclient_1.RequestType('java/organizeImports');
})(OrganizeImportsRequest = exports.OrganizeImportsRequest || (exports.OrganizeImportsRequest = {}));
var CheckToStringStatusRequest;
(function (CheckToStringStatusRequest) {
    CheckToStringStatusRequest.type = new vscode_languageclient_1.RequestType('java/checkToStringStatus');
})(CheckToStringStatusRequest = exports.CheckToStringStatusRequest || (exports.CheckToStringStatusRequest = {}));
var GenerateToStringRequest;
(function (GenerateToStringRequest) {
    GenerateToStringRequest.type = new vscode_languageclient_1.RequestType('java/generateToString');
})(GenerateToStringRequest = exports.GenerateToStringRequest || (exports.GenerateToStringRequest = {}));
var ResolveUnimplementedAccessorsRequest;
(function (ResolveUnimplementedAccessorsRequest) {
    ResolveUnimplementedAccessorsRequest.type = new vscode_languageclient_1.RequestType('java/resolveUnimplementedAccessors');
})(ResolveUnimplementedAccessorsRequest = exports.ResolveUnimplementedAccessorsRequest || (exports.ResolveUnimplementedAccessorsRequest = {}));
var GenerateAccessorsRequest;
(function (GenerateAccessorsRequest) {
    GenerateAccessorsRequest.type = new vscode_languageclient_1.RequestType('java/generateAccessors');
})(GenerateAccessorsRequest = exports.GenerateAccessorsRequest || (exports.GenerateAccessorsRequest = {}));
var CheckConstructorStatusRequest;
(function (CheckConstructorStatusRequest) {
    CheckConstructorStatusRequest.type = new vscode_languageclient_1.RequestType('java/checkConstructorsStatus');
})(CheckConstructorStatusRequest = exports.CheckConstructorStatusRequest || (exports.CheckConstructorStatusRequest = {}));
var GenerateConstructorsRequest;
(function (GenerateConstructorsRequest) {
    GenerateConstructorsRequest.type = new vscode_languageclient_1.RequestType('java/generateConstructors');
})(GenerateConstructorsRequest = exports.GenerateConstructorsRequest || (exports.GenerateConstructorsRequest = {}));
var CheckDelegateMethodsStatusRequest;
(function (CheckDelegateMethodsStatusRequest) {
    CheckDelegateMethodsStatusRequest.type = new vscode_languageclient_1.RequestType('java/checkDelegateMethodsStatus');
})(CheckDelegateMethodsStatusRequest = exports.CheckDelegateMethodsStatusRequest || (exports.CheckDelegateMethodsStatusRequest = {}));
var GenerateDelegateMethodsRequest;
(function (GenerateDelegateMethodsRequest) {
    GenerateDelegateMethodsRequest.type = new vscode_languageclient_1.RequestType('java/generateDelegateMethods');
})(GenerateDelegateMethodsRequest = exports.GenerateDelegateMethodsRequest || (exports.GenerateDelegateMethodsRequest = {}));
var GetRefactorEditRequest;
(function (GetRefactorEditRequest) {
    GetRefactorEditRequest.type = new vscode_languageclient_1.RequestType('java/getRefactorEdit');
})(GetRefactorEditRequest = exports.GetRefactorEditRequest || (exports.GetRefactorEditRequest = {}));
//# sourceMappingURL=protocol.js.map