"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class UpdateCompilerOptionsCommand {
    constructor(lazyClientHost) {
        this.lazyClientHost = lazyClientHost;
        this.id = 'typescript.updateCompilerOptionsCommand';
    }
    execute(extraCompilerOptions = {}) {
        this.lazyClientHost.value.serviceClient.setCompilerOptionsForInferredProjects(this.lazyClientHost.value.serviceClient.configuration, extraCompilerOptions);
    }
}
exports.UpdateCompilerOptionsCommand = UpdateCompilerOptionsCommand;
