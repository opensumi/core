"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const nls = require("vscode-nls");
const api_1 = require("../utils/api");
const codeAction_1 = require("../utils/codeAction");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const typeConverters = require("../utils/typeConverters");
const cancellation_1 = require("../utils/cancellation");
const localize = nls.loadMessageBundle();
class ApplyCodeActionCommand {
    constructor(client, telemetryReporter) {
        this.client = client;
        this.telemetryReporter = telemetryReporter;
        this.id = ApplyCodeActionCommand.ID;
    }
    async execute(action) {
        /* __GDPR__
            "quickFix.execute" : {
                "fixName" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
                "${include}": [
                    "${TypeScriptCommonProperties}"
                ]
            }
        */
        this.telemetryReporter.logTelemetry('quickFix.execute', {
            fixName: action.fixName
        });
        return codeAction_1.applyCodeActionCommands(this.client, action.commands, cancellation_1.nulToken);
    }
}
ApplyCodeActionCommand.ID = '_typescript.applyCodeActionCommand';
class ApplyFixAllCodeAction {
    constructor(client, telemetryReporter) {
        this.client = client;
        this.telemetryReporter = telemetryReporter;
        this.id = ApplyFixAllCodeAction.ID;
    }
    async execute(file, tsAction) {
        if (!tsAction.fixId) {
            return;
        }
        /* __GDPR__
            "quickFixAll.execute" : {
                "fixName" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
                "${include}": [
                    "${TypeScriptCommonProperties}"
                ]
            }
        */
        this.telemetryReporter.logTelemetry('quickFixAll.execute', {
            fixName: tsAction.fixName
        });
        const args = {
            scope: {
                type: 'file',
                args: { file }
            },
            fixId: tsAction.fixId,
        };
        const response = await this.client.execute('getCombinedCodeFix', args, cancellation_1.nulToken);
        if (response.type !== 'response' || !response.body) {
            return undefined;
        }
        const edit = typeConverters.WorkspaceEdit.fromFileCodeEdits(this.client, response.body.changes);
        await vscode.workspace.applyEdit(edit);
        await codeAction_1.applyCodeActionCommands(this.client, response.body.commands, cancellation_1.nulToken);
    }
}
ApplyFixAllCodeAction.ID = '_typescript.applyFixAllCodeAction';
/**
 * Unique set of diagnostics keyed on diagnostic range and error code.
 */
class DiagnosticsSet {
    constructor(_values) {
        this._values = _values;
    }
    static from(diagnostics) {
        const values = new Map();
        for (const diagnostic of diagnostics) {
            values.set(DiagnosticsSet.key(diagnostic), diagnostic);
        }
        return new DiagnosticsSet(values);
    }
    static key(diagnostic) {
        const { start, end } = diagnostic.range;
        return `${diagnostic.code}-${start.line},${start.character}-${end.line},${end.character}`;
    }
    get values() {
        return this._values.values();
    }
    get size() {
        return this._values.size;
    }
}
class CodeActionSet {
    constructor() {
        this._actions = new Set();
        this._fixAllActions = new Map();
    }
    get values() {
        return this._actions;
    }
    addAction(action) {
        this._actions.add(action);
    }
    addFixAllAction(fixId, action) {
        const existing = this._fixAllActions.get(fixId);
        if (existing) {
            // reinsert action at back
            this._actions.delete(existing);
        }
        this.addAction(action);
        this._fixAllActions.set(fixId, action);
    }
    hasFixAllAction(fixId) {
        return this._fixAllActions.has(fixId);
    }
}
class SupportedCodeActionProvider {
    constructor(client) {
        this.client = client;
    }
    async getFixableDiagnosticsForContext(context) {
        const supportedActions = await this.supportedCodeActions;
        return DiagnosticsSet.from(context.diagnostics.filter(diagnostic => supportedActions.has(+(diagnostic.code))));
    }
    get supportedCodeActions() {
        if (!this._supportedCodeActions) {
            this._supportedCodeActions = this.client.execute('getSupportedCodeFixes', null, cancellation_1.nulToken)
                .then(response => response.type === 'response' ? response.body || [] : [])
                .then(codes => codes.map(code => +code).filter(code => !isNaN(code)))
                .then(codes => new Set(codes));
        }
        return this._supportedCodeActions;
    }
}
class TypeScriptQuickFixProvider {
    constructor(client, formattingConfigurationManager, commandManager, diagnosticsManager, telemetryReporter) {
        this.client = client;
        this.formattingConfigurationManager = formattingConfigurationManager;
        this.diagnosticsManager = diagnosticsManager;
        commandManager.register(new ApplyCodeActionCommand(client, telemetryReporter));
        commandManager.register(new ApplyFixAllCodeAction(client, telemetryReporter));
        this.supportedCodeActionProvider = new SupportedCodeActionProvider(client);
    }
    async provideCodeActions(document, _range, context, token) {
        const file = this.client.toPath(document.uri);
        if (!file) {
            return [];
        }
        const fixableDiagnostics = await this.supportedCodeActionProvider.getFixableDiagnosticsForContext(context);
        if (!fixableDiagnostics.size) {
            return [];
        }
        if (this.client.bufferSyncSupport.hasPendingDiagnostics(document.uri)) {
            return [];
        }
        await this.formattingConfigurationManager.ensureConfigurationForDocument(document, token);
        const results = [];
        for (const diagnostic of fixableDiagnostics.values) {
            results.push(...await this.getFixesForDiagnostic(document, file, diagnostic, token));
        }
        return results;
    }
    async getFixesForDiagnostic(document, file, diagnostic, token) {
        const args = Object.assign({}, typeConverters.Range.toFileRangeRequestArgs(file, diagnostic.range), { errorCodes: [+(diagnostic.code)] });
        const response = await this.client.execute('getCodeFixes', args, token);
        if (response.type !== 'response' || !response.body) {
            return [];
        }
        const results = new CodeActionSet();
        for (const tsCodeFix of response.body) {
            this.addAllFixesForTsCodeAction(results, document, file, diagnostic, tsCodeFix);
        }
        return results.values;
    }
    addAllFixesForTsCodeAction(results, document, file, diagnostic, tsAction) {
        results.addAction(this.getSingleFixForTsCodeAction(diagnostic, tsAction));
        this.addFixAllForTsCodeAction(results, document, file, diagnostic, tsAction);
        return results;
    }
    getSingleFixForTsCodeAction(diagnostic, tsAction) {
        const codeAction = new vscode.CodeAction(tsAction.description, vscode.CodeActionKind.QuickFix);
        codeAction.edit = codeAction_1.getEditForCodeAction(this.client, tsAction);
        codeAction.diagnostics = [diagnostic];
        codeAction.command = {
            command: ApplyCodeActionCommand.ID,
            arguments: [tsAction],
            title: ''
        };
        return codeAction;
    }
    addFixAllForTsCodeAction(results, document, file, diagnostic, tsAction) {
        if (!tsAction.fixId || this.client.apiVersion.lt(api_1.default.v270) || results.hasFixAllAction(results)) {
            return results;
        }
        // Make sure there are multiple diagnostics of the same type in the file
        if (!this.diagnosticsManager.getDiagnostics(document.uri).some(x => x.code === diagnostic.code && x !== diagnostic)) {
            return results;
        }
        const action = new vscode.CodeAction(tsAction.fixAllDescription || localize('fixAllInFileLabel', '{0} (Fix all in file)', tsAction.description), vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.command = {
            command: ApplyFixAllCodeAction.ID,
            arguments: [file, tsAction],
            title: ''
        };
        results.addFixAllAction(tsAction.fixId, action);
        return results;
    }
}
TypeScriptQuickFixProvider.metadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
};
function register(selector, client, fileConfigurationManager, commandManager, diagnosticsManager, telemetryReporter) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v213, () => vscode.languages.registerCodeActionsProvider(selector, new TypeScriptQuickFixProvider(client, fileConfigurationManager, commandManager, diagnosticsManager, telemetryReporter), TypeScriptQuickFixProvider.metadata));
}
exports.register = register;
