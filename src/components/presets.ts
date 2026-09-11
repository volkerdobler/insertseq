import * as vscode from 'vscode';

/**
 * A named sequence preset.
 */
export interface TPreset {
	/** Unique display name for this preset (e.g. "Markdown Row Index"). */
	name: string;
	/** Sequence definition string (e.g. "1:1~<4"). */
	sequence: string;
	/** Optional short description or example output. */
	description?: string;
}

export const PRESETS_KEY = 'insertseq.presets';

/**
 * Built-in default presets provided out-of-the-box.
 */
export const DEFAULT_PRESETS: TPreset[] = [
	{
		name: 'Markdown Row Index',
		sequence: '1:1~<4',
		description: '1, 2, 3... left-aligned with width 4',
	},
	{
		name: 'Zero-padded 3-digit ID',
		sequence: '1~03d',
		description: '001, 002, 003...',
	},
	{
		name: 'IPv4 Local Subnet',
		sequence: '192.168.1.1:1',
		description: '192.168.1.1, 192.168.1.2...',
	},
	{
		name: 'UUID v4',
		sequence: ':uuid',
		description: 'Standard random UUID v4',
	},
	{
		name: 'UUID v7 (Time-sortable)',
		sequence: ':uuid:v7',
		description: 'Timestamp-ordered UUID v7',
	},
	{
		name: 'Secure 16-char Password',
		sequence: ':pwd:16',
		description: 'Strong password with mixed characters and symbols',
	},
	{
		name: 'Roman Numerals',
		sequence: '1~R',
		description: 'I, II, III, IV, V...',
	},
	{
		name: 'Daily ISO Dates',
		sequence: '%now:1d~"yyyy-MM-dd"',
		description: 'Consecutive daily calendar dates',
	},
];

/**
 * Retrieve the current presets list from workspace configuration or globalState.
 * Falls back to built-in presets when none are defined.
 *
 * @param ctx - Optional extension context to access `globalState`.
 * @returns Array of saved presets.
 */
export function getPresets(ctx?: vscode.ExtensionContext): TPreset[] {
	// 1. Check workspace configuration
	try {
		const configPresets = vscode.workspace
			.getConfiguration('insertseq')
			.get<TPreset[]>('presets');
		if (Array.isArray(configPresets) && configPresets.length > 0) {
			return configPresets;
		}
	} catch {
		// ignore settings read error
	}

	// 2. Check globalState
	if (ctx) {
		const stored = ctx.globalState.get<TPreset[]>(PRESETS_KEY);
		if (Array.isArray(stored)) {
			return stored;
		}
	}

	return DEFAULT_PRESETS.slice();
}

/**
 * Save or update a preset.
 *
 * @param ctx - The extension context.
 * @param preset - The preset to persist.
 */
export async function savePreset(
	ctx: vscode.ExtensionContext,
	preset: TPreset,
): Promise<void> {
	if (!preset.name || !preset.sequence) {
		return;
	}

	const list = getPresets(ctx).slice();
	const existingIndex = list.findIndex(
		(p) => p.name.trim().toLowerCase() === preset.name.trim().toLowerCase(),
	);

	if (existingIndex >= 0) {
		list[existingIndex] = preset;
	} else {
		list.push(preset);
	}

	// Persist in globalState
	await ctx.globalState.update(PRESETS_KEY, list);

	// Also attempt to persist in user configuration
	try {
		await vscode.workspace
			.getConfiguration('insertseq')
			.update('presets', list, vscode.ConfigurationTarget.Global);
	} catch {
		// silently accept globalState persistence if configuration write fails
	}
}

/**
 * Delete a preset by name.
 *
 * @param ctx - The extension context.
 * @param name - The name of the preset to delete.
 */
export async function deletePreset(
	ctx: vscode.ExtensionContext,
	name: string,
): Promise<void> {
	if (!name) {
		return;
	}

	const list = getPresets(ctx).filter(
		(p) => p.name.trim().toLowerCase() !== name.trim().toLowerCase(),
	);

	await ctx.globalState.update(PRESETS_KEY, list);

	try {
		await vscode.workspace
			.getConfiguration('insertseq')
			.update('presets', list, vscode.ConfigurationTarget.Global);
	} catch {
		// ignore
	}
}

/**
 * Clear all custom presets.
 *
 * @param ctx - The extension context.
 */
export async function clearPresets(
	ctx: vscode.ExtensionContext,
): Promise<void> {
	await ctx.globalState.update(PRESETS_KEY, []);
	try {
		await vscode.workspace
			.getConfiguration('insertseq')
			.update('presets', [], vscode.ConfigurationTarget.Global);
	} catch {
		// ignore
	}
}

/**
 * Reset presets back to default built-in presets.
 *
 * @param ctx - The extension context.
 */
export async function resetToDefaultPresets(
	ctx: vscode.ExtensionContext,
): Promise<void> {
	await ctx.globalState.update(PRESETS_KEY, DEFAULT_PRESETS.slice());
	try {
		await vscode.workspace
			.getConfiguration('insertseq')
			.update('presets', DEFAULT_PRESETS.slice(), vscode.ConfigurationTarget.Global);
	} catch {
		// ignore
	}
}

