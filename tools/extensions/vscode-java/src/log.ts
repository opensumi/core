import { createLogger, format, transports } from 'winston';

export function initializeLogFile(filename: string) {
	logger.add(new transports.File({
		filename: filename,
		maxsize: 100 * 1024, // 100k max size per file
		maxFiles: 2 // the last 100k of logs are always available
	}));
}

export const logger = createLogger({
	format: format.combine(
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss.SSS'
		}),
		format.prettyPrint()
	),
	transports: [
		new transports.Console()
	]
});
