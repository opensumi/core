'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const cp = require("child_process");
const path = require("path");
const pathExists = require("path-exists");
const expandHomeDir = require("expand-home-dir");
const findJavaHome = require("find-java-home");
const commands_1 = require("./commands");
const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if
 * all requirements are resolved, it will reject with ErrorData if
 * if any of the requirements fails to resolve.
 *
 */
function resolveRequirements() {
    return __awaiter(this, void 0, void 0, function* () {
        const javaHome = yield checkJavaRuntime();
        const javaVersion = yield checkJavaVersion(javaHome);
        return Promise.resolve({ java_home: javaHome, java_version: javaVersion });
    });
}
exports.resolveRequirements = resolveRequirements;
function checkJavaRuntime() {
    return new Promise((resolve, reject) => {
        let source;
        let javaHome = readJavaConfig();
        if (javaHome) {
            source = 'java.home variable defined in VS Code settings';
        }
        else {
            javaHome = process.env['JDK_HOME'];
            if (javaHome) {
                source = 'JDK_HOME environment variable';
            }
            else {
                javaHome = process.env['JAVA_HOME'];
                source = 'JAVA_HOME environment variable';
            }
        }
        if (javaHome) {
            javaHome = expandHomeDir(javaHome);
            if (!pathExists.sync(javaHome)) {
                invalidJavaHome(reject, `The ${source} points to a missing or inaccessible folder (${javaHome})`);
            }
            else if (!pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
                let msg;
                if (pathExists.sync(path.resolve(javaHome, JAVAC_FILENAME))) {
                    msg = `'bin' should be removed from the ${source} (${javaHome})`;
                }
                else {
                    msg = `The ${source} (${javaHome}) does not point to a JDK.`;
                }
                invalidJavaHome(reject, msg);
            }
            return resolve(javaHome);
        }
        // No settings, let's try to detect as last resort.
        findJavaHome((err, home) => {
            if (err) {
                openJDKDownload(reject, 'Java runtime (JDK, not JRE) could not be located');
            }
            else {
                resolve(home);
            }
        });
    });
}
function readJavaConfig() {
    const config = vscode_1.workspace.getConfiguration();
    return config.get('java.home', null);
}
function checkJavaVersion(javaHome) {
    return new Promise((resolve, reject) => {
        cp.execFile(javaHome + '/bin/java', ['-version'], {}, (error, stdout, stderr) => {
            const javaVersion = parseMajorVersion(stderr);
            if (javaVersion < 8) {
                openJDKDownload(reject, 'Java 8 or more recent is required to run. Please download and install a recent JDK');
            }
            else {
                resolve(javaVersion);
            }
        });
    });
}
function parseMajorVersion(content) {
    let regexp = /version "(.*)"/g;
    let match = regexp.exec(content);
    if (!match) {
        return 0;
    }
    let version = match[1];
    // Ignore '1.' prefix for legacy Java versions
    if (version.startsWith('1.')) {
        version = version.substring(2);
    }
    // look into the interesting bits now
    regexp = /\d+/g;
    match = regexp.exec(version);
    let javaVersion = 0;
    if (match) {
        javaVersion = parseInt(match[0]);
    }
    return javaVersion;
}
exports.parseMajorVersion = parseMajorVersion;
function openJDKDownload(reject, cause) {
    let jdkUrl = 'https://developers.redhat.com/products/openjdk/download/?sc_cid=701f2000000RWTnAAO';
    if (process.platform === 'darwin') {
        jdkUrl = 'http://www.oracle.com/technetwork/java/javase/downloads/index.html';
    }
    reject({
        message: cause,
        label: 'Get the Java Development Kit',
        command: commands_1.Commands.OPEN_BROWSER,
        commandParam: vscode_1.Uri.parse(jdkUrl),
    });
}
function invalidJavaHome(reject, cause) {
    if (cause.indexOf("java.home") > -1) {
        reject({
            message: cause,
            label: 'Open settings',
            command: commands_1.Commands.OPEN_JSON_SETTINGS
        });
    }
    else {
        reject({
            message: cause,
        });
    }
}
//# sourceMappingURL=requirements.js.map