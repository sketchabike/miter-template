<script lang="ts">
	import {
		PRESETS,
		FLAT_PLATE_PRESETS,
		BRIDGE_PRESETS,
		COMPOUND_PRESETS,
		COLLECTOR_PRESETS,
		SQUARE_PRESETS,
		SLOT_PRESETS,
		type JointPreset,
		type CopeParams,
		type BridgeParams,
		type CompoundAngleParams,
		type CollectorParams,
		type CollectorTube,
		type SquareParams,
		type SlotParams,
		type BridgePreset,
		type CompoundPreset,
		type CollectorPreset,
		type SquarePreset,
		type SlotPreset,
		type JointType
	} from '$lib/math/cope.js';

	interface Props {
		jointType: JointType;
		onjointtypechange: (type: JointType) => void;
		params: CopeParams;
		onchange: (params: CopeParams) => void;
		bridgeParams: BridgeParams;
		onbridgechange: (params: BridgeParams) => void;
		compoundParams: CompoundAngleParams;
		oncompoundchange: (params: CompoundAngleParams) => void;
		collectorParams: CollectorParams;
		oncollectorchange: (params: CollectorParams) => void;
		squareParams: SquareParams;
		onsquarechange: (params: SquareParams) => void;
		slotParams: SlotParams;
		onslotchange: (params: SlotParams) => void;
		units: 'mm' | 'in';
		onunitschange: (units: 'mm' | 'in') => void;
	}

	let {
		jointType,
		onjointtypechange,
		params: initialParams,
		onchange,
		bridgeParams: initialBridgeParams,
		onbridgechange,
		compoundParams: initialCompoundParams,
		oncompoundchange,
		collectorParams: initialCollectorParams,
		oncollectorchange,
		squareParams: initialSquareParams,
		onsquarechange,
		slotParams: initialSlotParams,
		onslotchange,
		units,
		onunitschange
	}: Props = $props();

	// --- Standard / flat plate state ---
	let selectedPreset = $state('Custom');
	let isElliptical = $state(Array.isArray(initialParams.cutDiameter));
	let showAdvancedStandard = $state(false);
	let showAdvancedSquare = $state(false);

	let cutMajor = $state(
		Array.isArray(initialParams.cutDiameter)
			? initialParams.cutDiameter[0]
			: (initialParams.cutDiameter as number)
	);
	let cutMinor = $state(
		Array.isArray(initialParams.cutDiameter)
			? initialParams.cutDiameter[1]
			: (initialParams.cutDiameter as number)
	);
	let parentDia = $state(initialParams.parentDiameter);
	let wall = $state(initialParams.wallThickness);
	let angle = $state(initialParams.angle);
	let offset = $state(initialParams.offset ?? 0);
	let taper = $state(initialParams.taper ?? 0);
	let twist = $state(initialParams.twist ?? 0);

	// --- Bridge state ---
	let bridgeTubeDia = $state(initialBridgeParams.tubeDiameter);
	let bridgeWall = $state(initialBridgeParams.wallThickness);
	let bridgeParentA = $state(initialBridgeParams.parentDiameterA);
	let bridgeParentB = $state(initialBridgeParams.parentDiameterB);
	let bridgeAngleA = $state(initialBridgeParams.angleA);
	let bridgeAngleB = $state(initialBridgeParams.angleB);
	let bridgeLength = $state(initialBridgeParams.bridgeLength);
	let selectedBridgePreset = $state('Custom Bridge');

	// --- Compound state ---
	let compStayDia = $state(initialCompoundParams.stayDiameter);
	let compSeatTubeDia = $state(initialCompoundParams.seatTubeDiameter);
	let compWall = $state(initialCompoundParams.wallThickness);
	let compElevation = $state(initialCompoundParams.elevation);
	let compSplay = $state(initialCompoundParams.splay);
	let compStaySpacing = $state(initialCompoundParams.staySpacing);
	let selectedCompoundPreset = $state('Custom Compound');

	// --- Collector state ---
	let collCutDia = $state(initialCollectorParams.cutDiameter);
	let collWall = $state(initialCollectorParams.wallThickness);
	let collParents = $state<CollectorTube[]>(
		initialCollectorParams.parents.map((p) => ({ ...p }))
	);
	let selectedCollectorPreset = $state('Custom Collector');

	// --- Square state ---
	let sqCutDia = $state(initialSquareParams.cutDiameter);
	let sqParentSide = $state(initialSquareParams.parentSide);
	let sqWall = $state(initialSquareParams.wallThickness);
	let sqCornerRadius = $state(initialSquareParams.cornerRadius);
	let sqAngle = $state(initialSquareParams.angle);
	let sqOffset = $state(initialSquareParams.offset ?? 0);
	let sqTwist = $state(initialSquareParams.twist ?? 0);
	let selectedSquarePreset = $state('Custom Square');

	// --- Slot state ---
	let slotTubeDia = $state(initialSlotParams.tubeDiameter);
	let slotWall = $state(initialSlotParams.wallThickness);
	let slotPlateThickness = $state(initialSlotParams.plateThickness);
	let slotDepth = $state(initialSlotParams.slotDepth);
	let selectedSlotPreset = $state('Custom Slot');

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

	// --- Emitters ---

	function emitParams() {
		const p: CopeParams = {
			cutDiameter: isElliptical ? [cutMajor, cutMinor] : cutMajor,
			parentDiameter: parentDia,
			wallThickness: wall,
			angle,
			offset: offset || undefined,
			taper: taper || undefined,
			twist: twist || undefined,
			flat: jointType === 'flat-plate' || undefined
		};
		onchange(p);
	}

	function emitBridgeParams() {
		onbridgechange({
			tubeDiameter: bridgeTubeDia,
			wallThickness: bridgeWall,
			parentDiameterA: bridgeParentA,
			parentDiameterB: bridgeParentB,
			angleA: bridgeAngleA,
			angleB: bridgeAngleB,
			bridgeLength
		});
	}

	function emitCompoundParams() {
		oncompoundchange({
			stayDiameter: compStayDia,
			seatTubeDiameter: compSeatTubeDia,
			wallThickness: compWall,
			elevation: compElevation,
			splay: compSplay,
			staySpacing: compStaySpacing
		});
	}

	function emitCollectorParams() {
		oncollectorchange({
			cutDiameter: collCutDia,
			wallThickness: collWall,
			parents: collParents.map((p) => ({ ...p }))
		});
	}

	function emitSquareParams() {
		onsquarechange({
			cutDiameter: sqCutDia,
			parentSide: sqParentSide,
			wallThickness: sqWall,
			cornerRadius: sqCornerRadius,
			angle: sqAngle,
			offset: sqOffset || undefined,
			twist: sqTwist || undefined
		});
	}

	function emitSlotParams() {
		onslotchange({
			tubeDiameter: slotTubeDia,
			wallThickness: slotWall,
			plateThickness: slotPlateThickness,
			slotDepth
		});
	}

	function addCollectorParent() {
		collParents = [
			...collParents,
			{ parentDiameter: 25.4, angle: 60, clockPosition: 0, offset: 0 }
		];
		emitCollectorParams();
	}

	function removeCollectorParent(index: number) {
		if (collParents.length <= 1) return;
		collParents = collParents.filter((_, i) => i !== index);
		emitCollectorParams();
	}

	// --- Preset handlers ---

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
		emitParams();
	}

	function applyBridgePreset(preset: BridgePreset) {
		bridgeTubeDia = preset.tubeDiameter;
		bridgeWall = preset.wallThickness;
		bridgeParentA = preset.parentDiameterA;
		bridgeParentB = preset.parentDiameterB;
		bridgeAngleA = preset.angleA;
		bridgeAngleB = preset.angleB;
		bridgeLength = preset.bridgeLength;
		emitBridgeParams();
	}

	function applyCompoundPreset(preset: CompoundPreset) {
		compStayDia = preset.stayDiameter;
		compSeatTubeDia = preset.seatTubeDiameter;
		compWall = preset.wallThickness;
		compElevation = preset.elevation;
		compSplay = preset.splay;
		compStaySpacing = preset.staySpacing;
		emitCompoundParams();
	}

	function handlePresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedPreset = name;
		const list = jointType === 'flat-plate' ? FLAT_PLATE_PRESETS : PRESETS;
		const preset = list.find((p) => p.name === name);
		if (preset) applyPreset(preset);
	}

	function handleBridgePresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedBridgePreset = name;
		const preset = BRIDGE_PRESETS.find((p) => p.name === name);
		if (preset) applyBridgePreset(preset);
	}

	function handleCompoundPresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedCompoundPreset = name;
		const preset = COMPOUND_PRESETS.find((p) => p.name === name);
		if (preset) applyCompoundPreset(preset);
	}

	function applyCollectorPreset(preset: CollectorPreset) {
		collCutDia = preset.cutDiameter;
		collWall = preset.wallThickness;
		collParents = preset.parents.map((p) => ({ ...p }));
		emitCollectorParams();
	}

	function handleCollectorPresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedCollectorPreset = name;
		const preset = COLLECTOR_PRESETS.find((p) => p.name === name);
		if (preset) applyCollectorPreset(preset);
	}

	function applySquarePreset(preset: SquarePreset) {
		sqCutDia = preset.cutDiameter;
		sqParentSide = preset.parentSide;
		sqWall = preset.wallThickness;
		sqCornerRadius = preset.cornerRadius;
		sqAngle = preset.angle;
		sqOffset = preset.offset ?? 0;
		sqTwist = preset.twist ?? 0;
		emitSquareParams();
	}

	function handleSquarePresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedSquarePreset = name;
		const preset = SQUARE_PRESETS.find((p) => p.name === name);
		if (preset) applySquarePreset(preset);
	}

	function applySlotPreset(preset: SlotPreset) {
		slotTubeDia = preset.tubeDiameter;
		slotWall = preset.wallThickness;
		slotPlateThickness = preset.plateThickness;
		slotDepth = preset.slotDepth;
		emitSlotParams();
	}

	function handleSlotPresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedSlotPreset = name;
		const preset = SLOT_PRESETS.find((p) => p.name === name);
		if (preset) applySlotPreset(preset);
	}

	function handleInput() {
		if (!isElliptical) cutMinor = cutMajor;
		emitParams();
	}

	const JOINT_TYPES: { value: JointType; label: string }[] = [
		{ value: 'standard', label: 'Tube → Tube' },
		{ value: 'flat-plate', label: 'Tube → Flat' },
		{ value: 'square', label: 'Tube → Square' },
		{ value: 'bridge', label: 'Bridge / Brace' },
		{ value: 'compound-ss', label: 'Compound Angle' },
		{ value: 'collector', label: 'Collector' },
		{ value: 'slot', label: 'Tube Slot' }
	];
</script>

<div class="controls">
	<!-- Joint type selector -->
	<div class="control-group">
		<span class="group-label">Joint Type</span>
		<div class="joint-type-tabs">
			{#each JOINT_TYPES as jt}
				<button
					class:active={jointType === jt.value}
					onclick={() => onjointtypechange(jt.value)}
				>
					{jt.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="separator"></div>

	<div class="control-row">
		<span class="group-label">Units</span>
		<div class="toggle-group">
			<button class:active={units === 'mm'} onclick={() => onunitschange('mm')}>mm</button>
			<button class:active={units === 'in'} onclick={() => onunitschange('in')}>inches</button>
		</div>
	</div>

	<div class="separator"></div>

	<!-- ========== Standard / Flat Plate ========== -->
	{#if jointType === 'standard' || jointType === 'flat-plate'}
		<div class="control-group">
			<label class="group-label" for="preset-select">Preset</label>
			<select id="preset-select" value={selectedPreset} onchange={handlePresetChange}>
				{#each jointType === 'flat-plate' ? FLAT_PLATE_PRESETS : PRESETS as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>

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

		{#if jointType === 'standard'}
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
								cutMinor = fromDisplay(
									parseFloat((e.target as HTMLInputElement).value) || 0
								);
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
							parentDia = fromDisplay(
								parseFloat((e.target as HTMLInputElement).value) || 0
							);
							handleInput();
						}}
					/>
				</label>
			</div>
		{/if}

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

		{#if jointType === 'standard'}
			<div class="separator"></div>

			<button class="advanced-toggle" onclick={() => (showAdvancedStandard = !showAdvancedStandard)}>
				{showAdvancedStandard ? '▾' : '▸'} Advanced Options
			</button>

			{#if showAdvancedStandard}
				<div class="advanced-panel">
					<div class="control-group">
						<label>
							{dimLabel('Offset')}
							<input
								type="number"
								value={toDisplay(offset).toFixed(units === 'in' ? 3 : 1)}
								step={dimStep()}
								onchange={(e) => {
									offset = fromDisplay(
										parseFloat((e.target as HTMLInputElement).value) || 0
									);
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
				</div>
			{/if}
		{/if}

	<!-- ========== Bridge / Brace ========== -->
	{:else if jointType === 'bridge'}
		<div class="control-group">
			<label class="group-label" for="bridge-preset-select">Preset</label>
			<select
				id="bridge-preset-select"
				value={selectedBridgePreset}
				onchange={handleBridgePresetChange}
			>
				{#each BRIDGE_PRESETS as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Bridge Tube OD')}
				<input
					type="number"
					value={toDisplay(bridgeTubeDia).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						bridgeTubeDia = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitBridgeParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Wall Thickness')}
				<input
					type="number"
					value={toDisplay(bridgeWall).toFixed(units === 'in' ? 4 : 2)}
					step={units === 'in' ? 0.001 : 0.05}
					min={0.01}
					onchange={(e) => {
						bridgeWall = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitBridgeParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Bridge Length')}
				<input
					type="number"
					value={toDisplay(bridgeLength).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={1}
					onchange={(e) => {
						bridgeLength = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitBridgeParams();
					}}
				/>
			</label>
			<span class="hint">Center-to-center distance between parent tubes</span>
		</div>

		<div class="separator"></div>

		<span class="group-label section-label">End A</span>
		<div class="control-group">
			<label>
				{dimLabel('Parent Tube OD')}
				<input
					type="number"
					value={toDisplay(bridgeParentA).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						bridgeParentA = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitBridgeParams();
					}}
				/>
			</label>
		</div>
		<div class="control-group">
			<label>
				Angle A (°)
				<input
					type="number"
					bind:value={bridgeAngleA}
					step={0.5}
					min={1}
					max={179}
					oninput={() => emitBridgeParams()}
				/>
			</label>
		</div>

		<div class="separator"></div>

		<span class="group-label section-label">End B</span>
		<div class="control-group">
			<label>
				{dimLabel('Parent Tube OD')}
				<input
					type="number"
					value={toDisplay(bridgeParentB).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						bridgeParentB = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitBridgeParams();
					}}
				/>
			</label>
		</div>
		<div class="control-group">
			<label>
				Angle B (°)
				<input
					type="number"
					bind:value={bridgeAngleB}
					step={0.5}
					min={1}
					max={179}
					oninput={() => emitBridgeParams()}
				/>
			</label>
		</div>

	<!-- ========== Compound Angle (SS → ST) ========== -->
	{:else if jointType === 'compound-ss'}
		<div class="control-group">
			<label class="group-label" for="compound-preset-select">Preset</label>
			<select
				id="compound-preset-select"
				value={selectedCompoundPreset}
				onchange={handleCompoundPresetChange}
			>
				{#each COMPOUND_PRESETS as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Stay OD')}
				<input
					type="number"
					value={toDisplay(compStayDia).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						compStayDia = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitCompoundParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Seat Tube OD')}
				<input
					type="number"
					value={toDisplay(compSeatTubeDia).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						compSeatTubeDia = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitCompoundParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Wall Thickness')}
				<input
					type="number"
					value={toDisplay(compWall).toFixed(units === 'in' ? 4 : 2)}
					step={units === 'in' ? 0.001 : 0.05}
					min={0.01}
					onchange={(e) => {
						compWall = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitCompoundParams();
					}}
				/>
			</label>
		</div>

		<div class="separator"></div>

		<div class="control-group">
			<label>
				Elevation (°)
				<input
					type="number"
					bind:value={compElevation}
					step={0.5}
					min={1}
					max={179}
					oninput={() => emitCompoundParams()}
				/>
			</label>
			<span class="hint">Angle between stay and seat tube (side view)</span>
		</div>

		<div class="control-group">
			<label>
				Splay (°)
				<input
					type="number"
					bind:value={compSplay}
					step={0.5}
					min={0}
					max={45}
					oninput={() => emitCompoundParams()}
				/>
			</label>
			<span class="hint">Lateral angle out from center plane</span>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Stay Spacing')}
				<input
					type="number"
					value={toDisplay(compStaySpacing).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0}
					onchange={(e) => {
						compStaySpacing = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitCompoundParams();
					}}
				/>
			</label>
			<span class="hint">Center-to-center between left and right stays</span>
		</div>

	<!-- ========== Collector ========== -->
	{:else if jointType === 'collector'}
		<div class="control-group">
			<label class="group-label" for="collector-preset-select">Preset</label>
			<select
				id="collector-preset-select"
				value={selectedCollectorPreset}
				onchange={handleCollectorPresetChange}
			>
				{#each COLLECTOR_PRESETS as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Cut Tube OD')}
				<input
					type="number"
					value={toDisplay(collCutDia).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						collCutDia = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitCollectorParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Wall Thickness')}
				<input
					type="number"
					value={toDisplay(collWall).toFixed(units === 'in' ? 4 : 2)}
					step={units === 'in' ? 0.001 : 0.05}
					min={0.01}
					onchange={(e) => {
						collWall = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitCollectorParams();
					}}
				/>
			</label>
		</div>

		<div class="separator"></div>

		{#each collParents as parent, idx}
			<div class="parent-section">
				<div class="parent-header">
					<span class="group-label section-label">Tube {idx + 1}</span>
					{#if collParents.length > 1}
						<button
							class="remove-btn"
							onclick={() => removeCollectorParent(idx)}
							title="Remove this tube"
						>&times;</button>
					{/if}
				</div>

				<div class="control-group">
					<label>
						{dimLabel('Parent OD')}
						<input
							type="number"
							value={toDisplay(parent.parentDiameter).toFixed(units === 'in' ? 3 : 1)}
							step={dimStep()}
							min={0.1}
							onchange={(e) => {
								collParents[idx].parentDiameter = fromDisplay(
									parseFloat((e.target as HTMLInputElement).value) || 0
								);
								emitCollectorParams();
							}}
						/>
					</label>
				</div>

				<div class="control-group">
					<label>
						Angle (°)
						<input
							type="number"
							value={parent.angle}
							step={0.5}
							min={1}
							max={179}
							oninput={(e) => {
								collParents[idx].angle =
									parseFloat((e.target as HTMLInputElement).value) || 60;
								emitCollectorParams();
							}}
						/>
					</label>
				</div>

				<div class="control-group">
					<label>
						Clock Position (°)
						<input
							type="number"
							value={parent.clockPosition}
							step={5}
							oninput={(e) => {
								collParents[idx].clockPosition =
									parseFloat((e.target as HTMLInputElement).value) || 0;
								emitCollectorParams();
							}}
						/>
					</label>
					<span class="hint">Angular position around the cut tube</span>
				</div>

				{#if idx < collParents.length - 1}
					<div class="separator"></div>
				{/if}
			</div>
		{/each}

		<button class="add-btn" onclick={addCollectorParent}>+ Add Tube</button>

	<!-- ========== Round-to-Square ========== -->
	{:else if jointType === 'square'}
		<div class="control-group">
			<label class="group-label" for="square-preset-select">Preset</label>
			<select
				id="square-preset-select"
				value={selectedSquarePreset}
				onchange={handleSquarePresetChange}
			>
				{#each SQUARE_PRESETS as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Cut Tube OD')}
				<input
					type="number"
					value={toDisplay(sqCutDia).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						sqCutDia = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
						emitSquareParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Parent Side Length')}
				<input
					type="number"
					value={toDisplay(sqParentSide).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						sqParentSide = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitSquareParams();
					}}
				/>
			</label>
			<span class="hint">Side length of the square tube</span>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Wall Thickness')}
				<input
					type="number"
					value={toDisplay(sqWall).toFixed(units === 'in' ? 4 : 2)}
					step={units === 'in' ? 0.001 : 0.05}
					min={0.01}
					onchange={(e) => {
						sqWall = fromDisplay(parseFloat((e.target as HTMLInputElement).value) || 0);
						emitSquareParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Corner Radius')}
				<input
					type="number"
					value={toDisplay(sqCornerRadius).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0}
					onchange={(e) => {
						sqCornerRadius = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitSquareParams();
					}}
				/>
			</label>
			<span class="hint">0 = sharp corners, max = {toDisplay(sqParentSide / 2).toFixed(units === 'in' ? 3 : 1)} (fully round)</span>
		</div>

		<div class="control-group">
			<label>
				Angle (°)
				<input
					type="number"
					bind:value={sqAngle}
					step={0.5}
					min={1}
					max={179}
					oninput={() => emitSquareParams()}
				/>
			</label>
			<span class="hint">Angle between tube centerlines</span>
		</div>

		<div class="separator"></div>

		<button class="advanced-toggle" onclick={() => (showAdvancedSquare = !showAdvancedSquare)}>
			{showAdvancedSquare ? '▾' : '▸'} Advanced Options
		</button>

		{#if showAdvancedSquare}
			<div class="advanced-panel">
				<div class="control-group">
					<label>
						{dimLabel('Offset')}
						<input
							type="number"
							value={toDisplay(sqOffset).toFixed(units === 'in' ? 3 : 1)}
							step={dimStep()}
							onchange={(e) => {
								sqOffset = fromDisplay(
									parseFloat((e.target as HTMLInputElement).value) || 0
								);
								emitSquareParams();
							}}
						/>
					</label>
					<span class="hint">Distance from parent center</span>
				</div>

				<div class="control-group">
					<label>
						Twist (°)
						<input
							type="number"
							bind:value={sqTwist}
							step={1}
							oninput={() => emitSquareParams()}
						/>
					</label>
					<span class="hint">Clock rotation of the cut</span>
				</div>
			</div>
		{/if}

	<!-- ========== Tube Slot ========== -->
	{:else if jointType === 'slot'}
		<div class="control-group">
			<label class="group-label" for="slot-preset-select">Preset</label>
			<select
				id="slot-preset-select"
				value={selectedSlotPreset}
				onchange={handleSlotPresetChange}
			>
				{#each SLOT_PRESETS as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Tube OD')}
				<input
					type="number"
					value={toDisplay(slotTubeDia).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						slotTubeDia = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitSlotParams();
					}}
				/>
			</label>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Wall Thickness')}
				<input
					type="number"
					value={toDisplay(slotWall).toFixed(units === 'in' ? 4 : 2)}
					step={units === 'in' ? 0.001 : 0.05}
					min={0.01}
					onchange={(e) => {
						slotWall = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitSlotParams();
					}}
				/>
			</label>
		</div>

		<div class="separator"></div>

		<div class="control-group">
			<label>
				{dimLabel('Plate Thickness')}
				<input
					type="number"
					value={toDisplay(slotPlateThickness).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						slotPlateThickness = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitSlotParams();
					}}
				/>
			</label>
			<span class="hint">Thickness of the dropout/plate being inserted</span>
		</div>

		<div class="control-group">
			<label>
				{dimLabel('Slot Depth')}
				<input
					type="number"
					value={toDisplay(slotDepth).toFixed(units === 'in' ? 3 : 1)}
					step={dimStep()}
					min={0.1}
					onchange={(e) => {
						slotDepth = fromDisplay(
							parseFloat((e.target as HTMLInputElement).value) || 0
						);
						emitSlotParams();
					}}
				/>
			</label>
			<span class="hint">How deep to cut the slot into the tube end</span>
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

	.section-label {
		font-weight: 600;
		color: var(--color-text, #e0e0e0);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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

	.joint-type-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
	}

	.joint-type-tabs button {
		background: var(--bg-input, #16213e);
		border: 1px solid var(--border-input, #333);
		padding: 6px 8px;
		color: var(--color-text-secondary, #aaa);
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.15s;
		border-radius: 4px;
	}

	.joint-type-tabs button.active {
		background: var(--color-accent, #00d4ff);
		color: var(--bg-page, #0a0a1a);
		border-color: var(--color-accent, #00d4ff);
		font-weight: 600;
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

	.parent-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.parent-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.remove-btn {
		background: none;
		border: 1px solid var(--border-input, #333);
		color: var(--color-text-dim, #666);
		width: 22px;
		height: 22px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.remove-btn:hover {
		border-color: #e74c3c;
		color: #e74c3c;
	}

	.add-btn {
		background: var(--bg-input, #16213e);
		border: 1px dashed var(--border-input, #333);
		color: var(--color-text-secondary, #aaa);
		padding: 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		text-align: center;
	}

	.add-btn:hover {
		border-color: var(--color-accent, #00d4ff);
		color: var(--color-accent, #00d4ff);
	}
</style>
