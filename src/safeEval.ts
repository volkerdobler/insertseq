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

function tryIfToTernary(code: string): string | null {
	const re =
		/^\s*if\s*\(([\s\S]*?)\)\s*\{\s*([\s\S]*?)\s*\}\s*else\s*\{\s*([\s\S]*?)\s*\}\s*$/i;
	const m = code.match(re);
	if (!m) return null;
	const cond = m[1].trim();
	const thenB = m[2].trim();
	const elseB = m[3].trim();
	return `(${cond}) ? (${thenB}) : (${elseB})`;
}

function runInVmAssignResult(code: string, timeout = 1000): unknown {
	const vm = getVm();
	if (!vm) throw new Error('vm module not available in this environment');
	const sandbox: { result?: unknown } = { result: undefined };
	vm.createContext(sandbox as any);
	// Use vm.Script and runInContext with timeout to ensure Node enforces CPU timeout
	const script = new vm.Script(code);
	// runInContext will throw if the script exceeds the timeout
	script.runInContext(sandbox as any, { timeout });
	return sandbox.result;
}

export function safeEvaluate(code: string, timeout = 1000): SafeEvalResult {
	// 1) try evaluating as an expression by assigning to `result` (works for '1+5')
	try {
		const exprAssign = runInVmAssignResult(
			'result = (' + code + ')',
			timeout,
		);
		if (typeof exprAssign !== 'undefined')
			return { ok: true, value: exprAssign };
	} catch (err: unknown) {
		// expression assignment failed (likely code contains statements) - continue
	}

	// 2) try direct run (code may set result itself)
	try {
		const direct = runInVmAssignResult(code, timeout);
		if (typeof direct !== 'undefined') return { ok: true, value: direct };
	} catch (err: unknown) {
		// continue
	}

	// 2) try if->ternary
	try {
		const tern = tryIfToTernary(code);
		if (tern) {
			const exprRes = runInVmAssignResult('result = ' + tern, timeout);
			if (typeof exprRes !== 'undefined')
				return { ok: true, value: exprRes };
		}
	} catch (err: unknown) {
		// continue
	}

	// 3) wrap in IIFE
	try {
		const wrapped = `(function(){\n${code}\n})()`;
		try {
			const w = runInVmAssignResult('result = ' + wrapped, timeout);
			if (typeof w !== 'undefined') return { ok: true, value: w };
		} catch {
			// vm not available or wrapped IIFE failed — try eval5 fallback
			if (eval5) {
				try {
					// eval5 exposes a top-level evaluate function in this build
					try {
						const directV = eval5.evaluate(code);
						return { ok: true, value: directV };
					} catch {
						// direct evaluate failed, try wrapped IIFE
						const v = eval5.evaluate(wrapped);
						return { ok: true, value: v };
					}
				} catch (err: any) {
					return { ok: false, error: String(err) };
				}
			}
		}
	} catch (err: unknown) {
		return { ok: false, error: String(err) };
	}

	return { ok: true, value: undefined };
}
