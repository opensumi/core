export function isFalsyOrWhitespace(str: string | undefined): boolean {
	if (!str || typeof str !== 'string') {
		return true;
	}
	return str.trim().length === 0;
}

export function escapeRegExpCharacters(value: string): string {
	return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\[\]\(\)\#]/g, '\\$&');
}

export function regExpFlags(regexp: RegExp): string {
	return (regexp.global ? 'g' : '')
		+ (regexp.ignoreCase ? 'i' : '')
		+ (regexp.multiline ? 'm' : '')
		+ ((regexp as any).unicode ? 'u' : '');
}
