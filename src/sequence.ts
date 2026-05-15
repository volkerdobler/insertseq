/**
 * Generate a numeric sequence as an array of numbers.
 *
 * The value emitted at logical index `i` is `start + i * step`.
 *
 * Precedence when both `repe` and `startover` are set: `startover` triggers
 * an unconditional restart; `repe` only restarts when its own boundary is
 * reached and `startover` has not fired first.
 *
 * @param start - Starting numeric value.
 * @param step - Amount added per logical step.
 * @param count - Total number of values to emit.
 * @param freq - Times each logical value is repeated before the index advances (default 1).
 * @param repe - Emitted-value count after which the sequence restarts from `start` (default off).
 * @param startover - Unconditional restart interval counted in emitted values (default off).
 * @returns Array of `count` numbers following the described pattern.
 */
export function generateSequence(
	start: number,
	step: number,
	count: number,
	freq?: number,
	repe?: number,
	startover?: number,
): number[] {
	const out: number[] = [];
	if (count <= 0) return out;
	const f = freq && freq > 0 ? Math.floor(freq) : 1;
	const r = repe && repe > 0 ? Math.floor(repe) : 0;
	const s = startover && startover > 0 ? Math.floor(startover) : 0;

	let emitted = 0; // number of emitted values so far
	let logicalIndex = 0; // i for computing value = start + i*step
	let repeatCountForLogical = 0; // how many times current logical value has been emitted

	while (emitted < count) {
		// compute current value
		const value = start + logicalIndex * step;
		out.push(value);
		emitted++;

		// check unconditional restart (startover) first
		if (s > 0 && emitted % s === 0) {
			// restart sequence
			logicalIndex = 0;
			repeatCountForLogical = 0;
			continue;
		}

		// check repe restart
		if (r > 0 && emitted % r === 0) {
			logicalIndex = 0;
			repeatCountForLogical = 0;
			continue;
		}

		// advance repetition logic
		repeatCountForLogical++;
		if (repeatCountForLogical >= f) {
			logicalIndex++;
			repeatCountForLogical = 0;
		}
	}

	return out;
}

export default generateSequence;
