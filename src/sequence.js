"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSequence = generateSequence;
/**
 * Generate a numeric sequence.
 *
 * Parameters:
 * - start: starting numeric value
 * - step: amount to increase at each logical step
 * - count: total number of emitted values
 * - freq?: if provided (>0), each logical value is repeated `freq` times
 * - repe?: if provided (>0), after every `repe` emitted values the sequence restarts from `start`
 * - startover?: if provided (>0), the sequence restarts unconditionally after `startover` emitted values
 *
 * Behavior notes / precedence:
 * - Emission happens one-by-one. We consider an internal logical index `i` that increments when we advance to the next logical value (i.e. after repeating freq times).
 * - The numeric value emitted at logical index `i` is start + i*step.
 * - If `freq` is set, each logical value is emitted `freq` times before i increments.
 * - If `repe` is set, then after `repe` emitted values (counting repeats) the sequence index i is reset to 0 (start).
 * - If `startover` is set, then after `startover` emitted values the sequence restarts as if new (i=0) regardless of freq/repe.
 * - If both `repe` and `startover` are set, `startover` takes precedence for unconditional restart; `repe` restarts only when its boundary is reached.
 */
function generateSequence(start, step, count, freq, repe, startover) {
    const out = [];
    if (count <= 0)
        return out;
    const f = (freq && freq > 0) ? Math.floor(freq) : 1;
    const r = (repe && repe > 0) ? Math.floor(repe) : 0;
    const s = (startover && startover > 0) ? Math.floor(startover) : 0;
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
exports.default = generateSequence;
//# sourceMappingURL=sequence.js.map