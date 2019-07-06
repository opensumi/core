export function isNonEmptyArray<T>(obj: ReadonlyArray<T> | undefined | null): obj is Array<T> {
	return Array.isArray(obj) && obj.length > 0;
}
