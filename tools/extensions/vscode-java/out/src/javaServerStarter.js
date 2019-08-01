"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const net = require("net");
const glob = require("glob");
const os = require("os");
const settings_1 = require("./settings");
const DEBUG = (typeof v8debug === 'object') || startedInDebugMode();
function prepareExecutable(requirements, workspacePath, javaConfig) {
    const executable = Object.create(null);
    const options = Object.create(null);
    options.env = process.env;
    options.stdio = 'pipe';
    executable.options = options;
    executable.command = path.resolve(requirements.java_home + '/bin/java');
    executable.args = prepareParams(requirements, javaConfig, workspacePath);
    console.log(executable);
    console.log(`Starting Java server with: ${executable.command} ${executable.args.join(' ')}`);
    return executable;
}
exports.prepareExecutable = prepareExecutable;
function awaitServerConnection(port) {
    console.log(port);
    const addr = parseInt(port);
    return new Promise((res, rej) => {
        const server = net.createServer(stream => {
            server.close();
            console.log('JDT LS connection established on port ' + addr);
            res({ reader: stream, writer: stream });
        });
        server.on('error', rej);
        server.listen(addr, () => {
            server.removeListener('error', rej);
            console.log('Awaiting JDT LS connection on port ' + addr);
        });
        return server;
    });
}
exports.awaitServerConnection = awaitServerConnection;
function prepareParams(requirements, javaConfiguration, workspacePath) {
    const params = [];
    if (DEBUG) {
        params.push('-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=1044,quiet=y');
        // suspend=y is the default. Use this form if you need to debug the server startup code:
        //  params.push('-agentlib:jdwp=transport=dt_socket,server=y,address=1044');
    }
    if (requirements.java_version > 8) {
        params.push('--add-modules=ALL-SYSTEM', '--add-opens', 'java.base/java.util=ALL-UNNAMED', '--add-opens', 'java.base/java.lang=ALL-UNNAMED');
    }
    params.push('-Declipse.application=org.eclipse.jdt.ls.core.id1', '-Dosgi.bundles.defaultStartLevel=4', '-Declipse.product=org.eclipse.jdt.ls.core.product');
    if (DEBUG) {
        params.push('-Dlog.level=ALL');
    }
    const vmargs = javaConfiguration.get('jdt.ls.vmargs', '');
    const encodingKey = '-Dfile.encoding=';
    if (vmargs.indexOf(encodingKey) < 0) {
        params.push(encodingKey + settings_1.getJavaEncoding());
    }
    if (os.platform() === 'win32') {
        const watchParentProcess = '-DwatchParentProcess=';
        if (vmargs.indexOf(watchParentProcess) < 0) {
            params.push(watchParentProcess + 'false');
        }
    }
    parseVMargs(params, vmargs);
    const serverHome = path.resolve(__dirname, '../server');
    const launchersFound = glob.sync('**/plugins/org.eclipse.equinox.launcher_*.jar', { cwd: serverHome });
    console.log('launchersFound', launchersFound);
    if (launchersFound.length) {
        params.push('-jar');
        params.push(path.resolve(serverHome, launchersFound[0]));
    }
    else {
        return null;
    }
    // select configuration directory according to OS
    let configDir = 'config_win';
    if (process.platform === 'darwin') {
        configDir = 'config_mac';
    }
    else if (process.platform === 'linux') {
        configDir = 'config_linux';
    }
    params.push('-configuration');
    params.push(path.resolve(__dirname, '../server', configDir));
    params.push('-data');
    params.push(workspacePath);
    return params;
}
function startedInDebugMode() {
    const args = process.execArgv;
    if (args) {
        return args.some((arg) => /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg) || /^--inspect-brk=?/.test(arg));
    }
    return false;
}
// exported for tests
function parseVMargs(params, vmargsLine) {
    if (!vmargsLine) {
        return;
    }
    const vmargs = vmargsLine.match(/(?:[^\s"]+|"[^"]*")+/g);
    if (vmargs === null) {
        return;
    }
    vmargs.forEach(arg => {
        // remove all standalone double quotes
        arg = arg.replace(/(\\)?"/g, ($0, $1) => { return ($1 ? $0 : ''); });
        // unescape all escaped double quotes
        arg = arg.replace(/(\\)"/g, '"');
        if (params.indexOf(arg) < 0) {
            params.push(arg);
        }
    });
}
exports.parseVMargs = parseVMargs;
//# sourceMappingURL=javaServerStarter.js.map