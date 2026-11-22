/**
 * localStorage 读写（隐私模式 / 服务端不炸）
 *
 * 注意：SSR 阶段没有 localStorage，所以调用方要在 `onMount` 里读，
 * 不要在模块顶层或组件体里直接读。
 */

export function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeStored(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// 隐私模式写不进去就算了
	}
}
