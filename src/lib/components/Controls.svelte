<script lang="ts">
	import { PRESETS, type JointPreset, type CopeParams } from '$lib/math/cope.js';

	interface Props {
		params: CopeParams;
		onchange: (params: CopeParams) => void;
		units: 'mm' | 'in';
		onunitschange: (units: 'mm' | 'in') => void;
	}

	let { params: initialParams, onchange, units, onunitschange }: Props = $props();

	let selectedPreset = $state('Custom');
	let isElliptical = $state(Array.isArray(initialParams.cutDiameter));
	let showAdvanced = $state(false);

	// Local state — Controls owns its own values and emits changes via onchange
	let cutMajor = $state(Array.isArray(initialParams.cutDiameter) ? initialParams.cutDiameter[0] : initialParams.cutDiameter as number);
	let cutMinor = $state(Array.isArray(initialParams.cutDiameter) ? initialParams.cutDiameter[1] : initialParams.cutDiameter as number);
	let parentDia = $state(initialParams.parentDiameter);
	let wall = $state(initialParams.wallThickness);
	let angle = $state(initialParams.angle);
	let offset = $state(initialParams.offset ?? 0);
	let taper = $state(initialParams.taper ?? 0);
	let twist = $state(initialParams.twist ?? 0);
	let flat = $state(initialParams.flat ?? false);

	const MM_PER_INCH = 25.4;

	function toDisplay(mm: number): number {
		return units === 'in' ? mm / MM_PER_INCH : mm;
	}

	function fromDisplay(val: number): number {
		return units === 'in' ? val * MM_PER_INCH : val;
	}

	function dimStep(): number {
		return units === 'in' ? 0.01 : 0.1;
	}

	function dimLabel(name: string): string {
		return `${name} (${units === 'in' ? 'in' : 'mm'})`;
	}

	function emitParams() {
		const p: CopeParams = {
			cutDiameter: isElliptical ? [cutMajor, cutMinor] : cutMajor,
			parentDiameter: parentDia,
			wallThickness: wall,
			angle,
			offset: offset || undefined,
			taper: taper || undefined,
			twist: twist || undefined,
			flat: flat || undefined
		};
		onchange(p);
	}

	function applyPreset(preset: JointPreset) {
		if (Array.isArray(preset.cutDiameter)) {
			isElliptical = true;
			cutMajor = preset.cutDiameter[0];
			cutMinor = preset.cutDiameter[1];
		} else {
			isElliptical = false;
			cutMajor = preset.cutDiameter;
			cutMinor = preset.cutDiameter;
		}
		parentDia = preset.parentDiameter;
		wall = preset.wallThickness;
		angle = preset.angle;
		offset = preset.offset ?? 0;
		twist = preset.twist ?? 0;
		taper = 0;
		flat = false;
		emitParams();
	}

	function handlePresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedPreset = name;
		const preset = PRESETS.find((p) => p.name === name);
		if (preset) applyPreset(preset);
	}

	// Re-emit on any input change
	function handleInput() {
		if (!isElliptical) cutMinor = cutMajor;
		emitParams();
	}
</script>

<div class="controls">
	<div class="control-group">
		<label class="group-label" for="preset-select">Joint Preset</label>
		<select id="preset-select" value={selectedPreset} onchange={handlePresetChange}>
			{#each PRESETS as preset}
				<option value={preset.name}>{preset.name}</option>
			{/each}
		</select>
	</div>

	<div class="control-row">
		<span class="group-label">Units</span>
		<div class="toggle-group">
			<button
				class:active={units === 'mm'}
				onclick={() => onunitschange('mm')}
			>mm</button>
			<button
				class:active={units === 'in'}
				onclick={() => onunitschange('in')}
			>inches</button>
		</div>
	</div>

	<div class="separator"></div>

	<div class="control-group">
		<label>
			{dimLabel('Cut Tube OD')}
			<input
				type="number"
				value={toDisplay(cutMajor).toFixed(units === 'in' ? 3 : 1)}
				step={dimStep()}
				min={0.1}
				onchange={(e) => {
					cutMajor = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
					handleInput();
				}}
			/>
		</label>
	</div>

	<div class="control-group">
		<label class="checkbox-label">
			<input
				type="checkbox"
				bind:checked={isElliptical}
				onchange={() => {
					if (!isElliptical) cutMinor = cutMajor;
					handleInput();
				}}
			/>
			Elliptical cut tube
		</label>
	</div>

	{#if isElliptical}
		<div class="control-group indent">
			<label>
				{dimLabel('Minor OD')}
				<input
					type="number"
					value={toDisplay(cutMinor).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						cutMinor = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
						handleInput();
					}}
				/>
			</label>
		</div>
	{/if}

	<div class="control-group">
		<label>
			{dimLabel('Parent Tube OD')}
			<input
				type="number"
				value={toDisplay(parentDia).toFixed(units === 'in' ? 3 : 1)}
				step={dimStep()}
				min={0.1}
				onchange={(e) => {
					parentDia = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
					handleInput();
				}}
			/>
		</label>
	</div>

	<div class="control-group">
		<label>
			{dimLabel('Wall Thickness')}
			<input
				type="number"
				value={toDisplay(wall).toFixed(units === 'in' ? 4 : 2)}
				step={units === 'in' ? 0.001 : 0.05}
				min={0.01}
				onchange={(e) => {
					wall = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
					handleInput();
				}}
			/>
		</label>
	</div>

	<div class="control-group">
		<label>
			Angle (°)
			<input
				type="number"
				bind:value={angle}
				step={0.5}
				min={1}
				max={179}
				oninput={() => handleInput()}
			/>
		</label>
		<span class="hint">Angle between tube centerlines</span>
	</div>

	<div class="separator"></div>

	<button class="advanced-toggle" onclick={() => (showAdvanced = !showAdvanced)}>
		{showAdvanced ? '▾' : '▸'} Advanced Options
	</button>

	{#if showAdvanced}
		<div class="advanced-panel">
			<div class="control-group">
				<label>
					{dimLabel('Offset')}
					<input
						type="number"
						value={toDisplay(offset).toFixed(units === 'in' ? 3 : 1)}
						step={dimStep()}
						onchange={(e) => {
							offset = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
							handleInput();
						}}
					/>
				</label>
				<span class="hint">Distance from parent center (for seatstays)</span>
			</div>

			<div class="control-group">
				<label>
					Twist (°)
					<input
						type="number"
						bind:value={twist}
						step={1}
						oninput={() => handleInput()}
					/>
				</label>
				<span class="hint">Clock rotation of the cut (for fork blades)</span>
			</div>

			<div class="control-group">
				<label>
					Taper ratio
					<input
						type="number"
						bind:value={taper}
						step={0.001}
						min={0}
						oninput={() => handleInput()}
					/>
				</label>
				<span class="hint">Parent diameter change per unit length</span>
			</div>

			<div class="control-group">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={flat}
						onchange={() => handleInput()}
					/>
					Flat cut (parent = ∞ diameter)
				</label>
			</div>
		</div>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.control-group label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.85rem;
		color: var(--color-text-secondary, #aaa);
	}

	.control-group.indent {
		padding-left: 20px;
	}

	.control-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.group-label {
		font-size: 0.85rem;
		color: var(--color-text-secondary, #aaa);
		margin-bottom: 4px;
	}

	input[type='number'] {
		background: var(--bg-input, #16213e);
		border: 1px solid var(--border-input, #333);
		border-radius: 4px;
		padding: 8px 10px;
		color: var(--color-text, #e0e0e0);
		font-size: 0.95rem;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		width: 100%;
		box-sizing: border-box;
	}

	input[type='number']:focus {
		outline: none;
		border-color: var(--color-accent, #00d4ff);
	}

	select {
		background: var(--bg-input, #16213e);
		border: 1px solid var(--border-input, #333);
		border-radius: 4px;
		padding: 8px 10px;
		color: var(--color-text, #e0e0e0);
		font-size: 0.9rem;
		width: 100%;
		cursor: pointer;
	}

	select:focus {
		outline: none;
		border-color: var(--color-accent, #00d4ff);
	}

	.toggle-group {
		display: flex;
		gap: 0;
	}

	.toggle-group button {
		background: var(--bg-input, #16213e);
		border: 1px solid var(--border-input, #333);
		padding: 6px 14px;
		color: var(--color-text-secondary, #aaa);
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.15s;
	}

	.toggle-group button:first-child {
		border-radius: 4px 0 0 4px;
	}

	.toggle-group button:last-child {
		border-radius: 0 4px 4px 0;
		border-left: none;
	}

	.toggle-group button.active {
		background: var(--color-accent, #00d4ff);
		color: var(--bg-page, #0a0a1a);
		border-color: var(--color-accent, #00d4ff);
		font-weight: 600;
	}

	.checkbox-label {
		flex-direction: row !important;
		align-items: center;
		gap: 8px !important;
		cursor: pointer;
	}

	input[type='checkbox'] {
		accent-color: var(--color-accent, #00d4ff);
		width: 16px;
		height: 16px;
	}

	.hint {
		font-size: 0.75rem;
		color: var(--color-text-dim, #666);
	}

	.separator {
		border-top: 1px solid var(--border-input, #333);
		margin: 4px 0;
	}

	.advanced-toggle {
		background: none;
		border: none;
		color: var(--color-text-secondary, #aaa);
		cursor: pointer;
		font-size: 0.85rem;
		text-align: left;
		padding: 4px 0;
	}

	.advanced-toggle:hover {
		color: var(--color-text, #e0e0e0);
	}

	.advanced-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-left: 8px;
		border-left: 2px solid var(--border-input, #333);
	}
</style>
