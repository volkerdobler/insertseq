import * as vscode from 'vscode';
import { TParameter, TSpecialReplacementValues, TOwnFunction } from '../types';
import { safeEvaluate } from '../safeEval';
import {
	printToConsole,
	replaceSpecialChars,
	runExpression,
	getStepValue,
	getFrequencyValue,
	getRepeatValue,
	getStartOverValue,
	getStopExpression,
	checkStopExpression,
	getExpression,
} from '../utils';

export function createFunctionSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	function loadUserFunctionsFromConfig(
		cfg: vscode.WorkspaceConfiguration,
	): TOwnFunction[] {
		const raw = cfg.get('myfunctions') as any;
		let res: TOwnFunction[] = [];

		if (!Array.isArray(raw)) return res;

		for (const item of raw) {
			try {
				if (typeof item === 'string') {
					const s = item.trim();
					// Try evaluating a function expression "(i)=>..." or "function(...) {...}"
					printToConsole(`Parsing user function 1: ${s}`);
					const fn = safeEvaluate(`(${s})`);
					printToConsole(
						`Evaluation result: ${fn.ok}` +
							(fn.ok
								? `value: ${fn.value}`
								: `error: ${fn.error}`),
					);
					if (fn.ok && typeof fn.value === 'function') {
						res.push(fn.value as TOwnFunction);
						continue;
					}

					// Optional: if string is a JSON object like "{name:'x', code:'...'}"
					try {
						const obj = JSON.parse(
							s.replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":'),
						);
						if (obj && obj.code) {
							printToConsole(
								`Parsing user function 2: ${obj.code}`,
							);
							const fn2 = safeEvaluate(`(${obj.code})`);
							printToConsole(
								`Evaluation result: ${fn2.ok}` +
									(fn2.ok
										? `value: ${fn2.value}`
										: `error: ${fn2.error}`),
							);
							if (fn2.ok && typeof fn2.value === 'function')
								res.push(fn2.value as TOwnFunction);
						}
					} catch {
						/* ignore */
					}
				} else if (item && typeof item === 'object') {
					const code = (item as any).code || (item as any).function;
					if (typeof code === 'string') {
						printToConsole(`Parsing user function 3: ${code}`);
						const fn = safeEvaluate(`(${code})`);
						printToConsole(
							`Evaluation result: ${fn.ok}` +
								(fn.ok
									? `value: ${fn.value}`
									: `error: ${fn.error}`),
						);
						if (fn.ok && typeof fn.value === 'function')
							res.push(fn.value as TOwnFunction);
					}
				}
			} catch (e) {
				printToConsole(`Failed parsing user function: ${String(e)}`);
			}
		}
		return res;
	}

	const functionArray: TOwnFunction[] = loadUserFunctionsFromConfig(
		parameter.config,
	);

	const functionParameter = input.match(parameter.segments['start_function']);
	// if start_predefined group exists, extract sequence text (could be within quotes or plain text)
	const functionNr =
		Number(functionParameter?.groups?.funcNr) ||
		parameter.config.get('defaultFunctionNr') ||
		1;

	const myFunc = functionArray && functionArray.at(functionNr - 1);

	if (!myFunc) {
		return (i) => ({ stringFunction: '', stopFunction: true });
	}

	const functionStartAt = Number(
		functionParameter?.groups?.funcStartAt || '1',
	);

	const steps = getStepValue(input, parameter, 'steps_other');
	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '', // only for stopexpression
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	printToConsole(`Current function: ${myFunc.toString()}`);

	return (i) => {
		replacableValues.currentIndexStr = i.toString();
		replacableValues.origTextStr =
			i < parameter.origTextSel.length ? parameter.origTextSel[i] : '';

		const value = myFunc(i, functionStartAt, steps, freq, repe, startover);

		// set special replacement values for origTextStr and currentIndexStr
		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		}
		replacableValues.currentIndexStr = i.toString();

		// set current value string before expression evaluation
		replacableValues.currentValueStr = value.toString();
		replacableValues.valueAfterExpressionStr = '';

		// default: stop expression triggered if i >= number of original selections
		let stopExpressionTriggered = i >= parameter.origCursorPos.length;

		// check stop expression if given
		if (stopexpr.length > 0) {
			stopExpressionTriggered = checkStopExpression(
				i,
				stopexpr,
				parameter.origCursorPos.length,
				replacableValues,
			);
		} else {
			stopExpressionTriggered = i >= parameter.origCursorPos.length;
		}

		// set previous value string for next iteration
		replacableValues.previousValueStr = value.toString();

		return {
			stringFunction: value.toString(),
			stopFunction: stopExpressionTriggered,
		};
	};
}
