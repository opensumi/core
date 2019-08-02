"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
function initializeLogFile(filename) {
    exports.logger.add(new winston_1.transports.File({
        filename: filename,
        maxsize: 100 * 1024,
        maxFiles: 2 // the last 100k of logs are always available
    }));
}
exports.initializeLogFile = initializeLogFile;
exports.logger = winston_1.createLogger({
    format: winston_1.format.combine(winston_1.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }), winston_1.format.prettyPrint()),
    transports: [
        new winston_1.transports.Console()
    ]
});
//# sourceMappingURL=log.js.map