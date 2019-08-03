'use strict';

import { workspace, Uri } from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as pathExists from 'path-exists';
import * as expandHomeDir from 'expand-home-dir';
import * as findJavaHome from 'find-java-home';
import { Commands } from './commands';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');

export interface RequirementsData {
    java_home: string;
    java_version: number;
}

interface ErrorData {
    message: string;
    label: string;
    command: string;
    commandParam: any;
}
/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if
 * all requirements are resolved, it will reject with ErrorData if
 * if any of the requirements fails to resolve.
 *
 */
export async function resolveRequirements(): Promise<RequirementsData> {
    const javaHome = await checkJavaRuntime();
    const javaVersion = await checkJavaVersion(javaHome);
    return Promise.resolve({ java_home: javaHome, java_version: javaVersion });
}

function checkJavaRuntime(): Promise<string> {
    return new Promise((resolve, reject) => {
        let source: string;
        let javaHome: string = readJavaConfig();
        if (javaHome) {
            source = 'java.home variable defined in VS Code settings';
        } else {
            javaHome = process.env['JDK_HOME'];
            if (javaHome) {
                source = 'JDK_HOME environment variable';
            } else {
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
                let msg: string;
                if (pathExists.sync(path.resolve(javaHome, JAVAC_FILENAME))) {
                    msg = `'bin' should be removed from the ${source} (${javaHome})`;
                } else {
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

function readJavaConfig(): string {
    const config = workspace.getConfiguration();
    return config.get<string>('java.home', null);
}

function checkJavaVersion(javaHome: string): Promise<number> {
    return new Promise((resolve, reject) => {
        cp.execFile(javaHome + '/bin/java', ['-version'], {}, (error, stdout, stderr) => {
            const javaVersion = parseMajorVersion(stderr);
            if (javaVersion < 8) {
                openJDKDownload(reject, 'Java 8 or more recent is required to run. Please download and install a recent JDK');
            } else {
                resolve(javaVersion);
            }
        });
    });
}

export function parseMajorVersion(content: string): number {
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

function openJDKDownload(reject, cause) {
    let jdkUrl = 'https://developers.redhat.com/products/openjdk/download/?sc_cid=701f2000000RWTnAAO';
    if (process.platform === 'darwin') {
        jdkUrl = 'http://www.oracle.com/technetwork/java/javase/downloads/index.html';
    }
    reject({
        message: cause,
        label: 'Get the Java Development Kit',
        command: Commands.OPEN_BROWSER,
        commandParam: Uri.parse(jdkUrl),
    });
}

function invalidJavaHome(reject, cause: string) {
    if (cause.indexOf("java.home") > -1) {
        reject({
            message: cause,
            label: 'Open settings',
            command: Commands.OPEN_JSON_SETTINGS
        });
    } else {
        reject({
            message: cause,
        });
    }
}
