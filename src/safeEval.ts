declare const require: any;

function getVm(): any | null {
	try {
		// require dynamically so bundlers / TS don't need to resolve 'vm' at compile time
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		return require('vm');
	} catch {
		return null;
	}
}

let eval5: any = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	eval5 = require('eval5');
} catch {
	eval5 = null;
}

export type SafeEvalResult =
	| { ok: true; value: unknown }
	| { ok: false; error: string };

// function tryIfToTernary(code: string): string | null {
// 	const re =
// 		/^\s*if\s*\(([\s\S]*?)\)\s*\{\s*([\s\S]*?)\s*\}\s*else\s*\{\s*([\s\S]*?)\s*\}\s*$/i;
// 	const m = code.match(re);
// 	if (!m) return null;
// 	const cond = m[1].trim();
// 	const thenB = m[2].trim();
// 	const elseB = m[3].trim();
// 	return `(${cond}) ? (${thenB}) : (${elseB})`;
// }

function tryIfToTernary(code: string): string | null {
	// if (...) { then } else { else }
	const reElse =
		/^\s*if\s*\(([\s\S]*?)\)\s*\{\s*([\s\S]*?)\s*\}\s*else\s*\{\s*([\s\S]*?)\s*\}\s*$/i;
	let m = code.match(reElse);
	if (m) {
		const cond = m[1].trim();
		const thenB = m[2].trim();
		const elseB = m[3].trim();
		return `(${cond}) ? (${thenB}) : (${elseB})`;
	}

	// if (...) { then }  -> becomes (cond) ? (then) : (undefined)
	const reIfOnly = /^\s*if\s*\(([\s\S]*?)\)\s*\{\s*([\s\S]*?)\s*\}\s*$/i;
	m = code.match(reIfOnly);
	if (m) {
		const cond = m[1].trim();
		const thenB = m[2].trim();
		return `(${cond}) ? (${thenB}) : (undefined)`;
	}

	return null;
}

function runInVmAssignResult(
	code: string,
	context: Record<string, unknown> | null = null,
	timeout = 1000,
): unknown {
	const vm = getVm();

	// prepare sandbox with provided context (globals for vm)
	const sandbox: Record<string, unknown> = Object.assign(
		{ result: undefined },
		context || {},
	);

	// 1) Prefer Node's vm if available (desktop)
	if (vm) {
		vm.createContext(sandbox as any);
		const script = new vm.Script(code);
		script.runInContext(sandbox as any, { timeout });
		return (sandbox as any).result;
	}

	// 2) Fallback to eval5 (works in browser and node if bundled)
	if (eval5) {
		try {
			// Serializer that produces JS literal/source for common types
			const serialize = (v: unknown, seen = new WeakSet()): string => {
				try {
					if (v === null) return 'null';
					if (v === undefined) return 'undefined';
					const t = typeof v;
					if (t === 'number' || t === 'boolean') return String(v);
					if (t === 'string') return JSON.stringify(v);
					if (t === 'function') {
						// inject function source (may be unsafe but useful)
						try {
							return (v as Function).toString();
						} catch {
							return 'undefined';
						}
					}
					if (v instanceof Date)
						return `new Date(${(v as Date).getTime()})`;
					if (v instanceof RegExp) return (v as RegExp).toString();
					if (Array.isArray(v)) {
						if (seen.has(v as object)) return 'null';
						seen.add(v as object);
						return (
							'[' +
							(v as Array<unknown>)
								.map((e) => serialize(e, seen))
								.join(',') +
							']'
						);
					}
					if (t === 'object') {
						if (seen.has(v as object)) return 'null';
						seen.add(v as object);
						const obj = v as Record<string, unknown>;
						const entries = Object.keys(obj).map((k) => {
							const key = /^[A-Za-z$_][A-Za-z0-9$_]*$/.test(k)
								? k
								: JSON.stringify(k);
							return `${key}:${serialize(obj[k], seen)}`;
						});
						return '{' + entries.join(',') + '}';
					}
					// fallback
					return JSON.stringify(v);
				} catch {
					// on any serialization error, fall back to null to keep wrapper safe
					return 'null';
				}
			};

			const ctx = context || {};
			const keys = Object.keys(ctx);

			// serialized literal values for __ctx (guard each serialization)
			const ctxEntries = keys
				.map((k) => {
					let val: string;
					try {
						val = serialize((ctx as any)[k]);
					} catch {
						val = 'null';
					}
					return `${JSON.stringify(k)}:${val}`;
				})
				.join(',');

			// create local const declarations for keys that are valid JS identifiers
			const validId = (k: string) => /^[A-Za-z$_][A-Za-z0-9$_]*$/.test(k);
			const declarations = keys
				.filter(validId)
				.map((k) => `const ${k} = __ctx[${JSON.stringify(k)}];`)
				.join('\n');

			// wrapper: provide __ctx, local declarations, and a mutable `result` variable
			// return `result` if set, otherwise return the IIFE's return value
			const wrapped =
				`(function(){\n` +
				`const __ctx = {${ctxEntries}};\n` +
				`${declarations}\n` +
				`let result = undefined;\n` +
				`const __ret = (function(){\n${code}\n})();\n` +
				`return (typeof result !== 'undefined') ? result : __ret;\n` +
				`})()`;

			if (typeof eval5.evaluate === 'function') {
				return eval5.evaluate(wrapped);
			}
			if (typeof eval5.eval === 'function') {
				return eval5.eval(wrapped);
			}
			if (typeof eval5 === 'function') {
				return eval5(wrapped);
			}
		} catch (e) {
			// provide a clearer error message for callers
			throw new Error(`eval5 execution failed: ${String(e)}`);
		}
	}

	// 3) Last resort: no sandbox available
	throw new Error('No VM or eval5 available to execute code');
}

export function safeEvaluate(
	code: string,
	timeout = 1000,
	context: Record<string, unknown> | null = null,
): SafeEvalResult {
	// 1) try evaluating as an expression by assigning to `result`
	try {
		const exprAssign = runInVmAssignResult(
			'result = (' + code + ')',
			context,
			timeout,
		);
		if (typeof exprAssign !== 'undefined')
			return { ok: true, value: exprAssign };
	} catch {
		// continue
	}

	// 2) try direct run (code may set result itself)
	try {
		const direct = runInVmAssignResult(code, context, timeout);
		if (typeof direct !== 'undefined') return { ok: true, value: direct };
	} catch {
		// continue
	}

	// 3) try if->ternary (handles if without else)
	try {
		const tern = tryIfToTernary(code);
		if (tern) {
			const exprRes = runInVmAssignResult(
				'result = ' + tern,
				context,
				timeout,
			);
			if (typeof exprRes !== 'undefined')
				return { ok: true, value: exprRes };
		}
	} catch {
		// continue
	}

	// 4) wrap in IIFE
	try {
		const wrapped = `(function(){\n${code}\n})()`;
		const w = runInVmAssignResult('result = ' + wrapped, context, timeout);
		if (typeof w !== 'undefined') return { ok: true, value: w };
	} catch (err: unknown) {
		return { ok: false, error: String(err) };
	}

	return { ok: true, value: undefined };
}
