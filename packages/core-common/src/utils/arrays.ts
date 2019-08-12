export function isNonEmptyArray<T>(obj: ReadonlyArray<T> | undefined | null): obj is Array<T> {
	return Array.isArray(obj) && obj.length > 0;
}
/**
 * 移除给定数组中的重复值
 * keyFn函数支持指定校验逻辑
 */
export function distinct<T>(array: ReadonlyArray<T>, keyFn?: (t: T) => string): T[] {
	if (!keyFn) {
		return array.filter((element, position) => {
			return array.indexOf(element) === position;
		});
	}

	const seen: { [key: string]: boolean; } = Object.create(null);
	return array.filter((elem) => {
		const key = keyFn(elem);
		if (seen[key]) {
			return false;
		}

		seen[key] = true;

		return true;
	});
}
