<script lang="ts">
	import type { CopeResult, BridgeResult } from '$lib/math/cope.js';

	interface Props {
		result: CopeResult;
		/** For bridge templates: the complete bridge result */
		bridge?: BridgeResult;
		showGuidelines?: boolean;
		showLegend?: boolean;
	}

	let { result, bridge, showGuidelines = true, showLegend = true }: Props = $props();

	// Padding around the template in mm
	const PADDING = 8;
	// Headroom above the curve (extra paper for wrapping) — standard mode only
	const HEADROOM = 20;
	// Small padding above/below bridge cope curves
	const BRIDGE_PAD = 4;

	let isBridge = $derived(!!bridge);

	let totalHeight = $derived(
		isBridge
			? bridge!.bridgeLength + BRIDGE_PAD * 2
			: result.height + HEADROOM
	);
	let viewWidth = $derived(
		(isBridge ? bridge!.circumference : result.circumference) + PADDING * 2
	);
	let viewHeight = $derived(totalHeight + PADDING * 2);

	let circumference = $derived(isBridge ? bridge!.circumference : result.circumference);

	// Build the SVG path from the cope points (standard / flat / compound)
	let pathData = $derived.by(() => {
		if (isBridge) return ''; // handled separately
		if (result.points.length === 0) return '';
		return buildPathData(result.points, result.circumference, totalHeight);
	});

	// Build SVG paths for bridge template (two curves)
	let bridgePathA = $derived.by(() => {
		if (!isBridge) return '';
		return buildBridgePath(bridge!.endA.points, bridge!.circumference, totalHeight, 'bottom');
	});

	let bridgePathB = $derived.by(() => {
		if (!isBridge) return '';
		return buildBridgePath(bridge!.endB.points, bridge!.circumference, totalHeight, 'top');
	});

	function buildPathData(points: CopeResult['points'], circ: number, tHeight: number): string {
		const parts: string[] = [];
		let prevX = -1;

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const x = p.x + PADDING;
			const y = PADDING + tHeight - p.y;

			if (i === 0 || x < prevX - 1) {
				parts.push(`M ${x.toFixed(3)} ${y.toFixed(3)}`);
			} else {
				parts.push(`L ${x.toFixed(3)} ${y.toFixed(3)}`);
			}
			prevX = x;
		}

		// Close back to the first point
		const first = points[0];
		const fx = first.x + PADDING + circ;
		const fy = PADDING + tHeight - first.y;
		parts.push(`L ${fx.toFixed(3)} ${fy.toFixed(3)}`);

		return parts.join(' ');
	}

	function buildBridgePath(
		points: CopeResult['points'],
		circ: number,
		tHeight: number,
		end: 'bottom' | 'top'
	): string {
		const parts: string[] = [];
		let prevX = -1;

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const x = p.x + PADDING;
			let y: number;

			if (end === 'bottom') {
				// Curve at bottom: y=0 is the bottom edge, cope goes upward
				y = PADDING + tHeight - p.y;
			} else {
				// Curve at top: y=0 of the cope maps to the top edge, cope goes downward
				y = PADDING + p.y;
			}

			if (i === 0 || x < prevX - 1) {
				parts.push(`M ${x.toFixed(3)} ${y.toFixed(3)}`);
			} else {
				parts.push(`L ${x.toFixed(3)} ${y.toFixed(3)}`);
			}
			prevX = x;
		}

		// Close back to the first point
		const first = points[0];
		const fx = first.x + PADDING + circ;
		let fy: number;
		if (end === 'bottom') {
			fy = PADDING + tHeight - first.y;
		} else {
			fy = PADDING + first.y;
		}
		parts.push(`L ${fx.toFixed(3)} ${fy.toFixed(3)}`);

		return parts.join(' ');
	}

	// Quarter guidelines (0°, 90°, 180°, 270°, 360°)
	let guidelines = $derived.by(() => {
		const lines: { x: number; label: string }[] = [];
		const step = circumference / 4;
		for (let i = 0; i <= 4; i++) {
			lines.push({
				x: PADDING + i * step,
				label: `${i * 90}°`
			});
		}
		return lines;
	});

	// Scale marks for print verification (10mm intervals)
	let scaleMarks = $derived.by(() => {
		const marks: number[] = [];
		for (let d = 10; d < circumference; d += 10) {
			marks.push(PADDING + d);
		}
		return marks;
	});
</script>

<svg
	class="template-svg"
	viewBox="0 0 {viewWidth} {viewHeight}"
	xmlns="http://www.w3.org/2000/svg"
	style="width: {viewWidth}mm;"
>
	<!-- Background -->
	<rect x="0" y="0" width={viewWidth} height={viewHeight} fill="var(--bg-template, #1a1a2e)" />

	<!-- Scale marks along the bottom (10mm tick marks) -->
	{#each scaleMarks as x}
		<line
			x1={x}
			y1={viewHeight - PADDING}
			x2={x}
			y2={viewHeight - PADDING + 3}
			stroke="var(--color-scale, #555)"
			stroke-width="0.2"
		/>
	{/each}

	<!-- Scale verification: 10mm reference bar -->
	<rect
		x={PADDING}
		y={viewHeight - PADDING + 4}
		width={10}
		height={1.5}
		fill="var(--color-scale-bar, #666)"
	/>
	<text
		x={PADDING + 12}
		y={viewHeight - PADDING + 5.5}
		fill="var(--color-text-dim, #888)"
		font-size="2.5"
		font-family="monospace"
	>10mm</text>

	<!-- Quarter guidelines -->
	{#if showGuidelines}
		{#each guidelines as line}
			<line
				x1={line.x}
				y1={PADDING}
				x2={line.x}
				y2={PADDING + totalHeight}
				stroke="var(--color-guideline, #e74c3c)"
				stroke-width="0.3"
				stroke-dasharray="2 1"
			/>
			<text
				x={line.x}
				y={PADDING - 1.5}
				fill="var(--color-guideline, #e74c3c)"
				font-size="2.5"
				font-family="monospace"
				text-anchor="middle"
			>{line.label}</text>
		{/each}
	{/if}

	<!-- The cope curve(s) -->
	{#if isBridge}
		<!-- Bridge: two curves -->
		<path
			d={bridgePathA}
			fill="none"
			stroke="var(--color-curve, #00d4ff)"
			stroke-width="0.4"
			stroke-linejoin="round"
		/>
		<path
			d={bridgePathB}
			fill="none"
			stroke="#ff6b6b"
			stroke-width="0.4"
			stroke-linejoin="round"
		/>
		<!-- End labels -->
		<text
			x={PADDING + 2}
			y={PADDING + totalHeight - 2}
			fill="var(--color-curve, #00d4ff)"
			font-size="2.5"
			font-family="monospace"
		>End A</text>
		<text
			x={PADDING + 2}
			y={PADDING + 4}
			fill="#ff6b6b"
			font-size="2.5"
			font-family="monospace"
		>End B</text>
	{:else}
		<!-- Standard single curve -->
		<path
			d={pathData}
			fill="none"
			stroke="var(--color-curve, #00d4ff)"
			stroke-width="0.4"
			stroke-linejoin="round"
		/>
	{/if}

	<!-- Legend -->
	{#if showLegend && !isBridge}
		{@const params = result.params}
		{@const isEllip = Array.isArray(params.cutDiameter)}
		<text
			x={PADDING + 2}
			y={PADDING + 4}
			fill="var(--color-text-dim, #888)"
			font-size="2.8"
			font-family="monospace"
		>
			<tspan x={PADDING + 2} dy="0">
				Cut: {isEllip
					? `${(params.cutDiameter as [number, number])[0]}×${(params.cutDiameter as [number, number])[1]}mm`
					: `${params.cutDiameter}mm`}
				| Wall: {params.wallThickness}mm
			</tspan>
			<tspan x={PADDING + 2} dy="3.5">
				{params.flat ? 'Flat' : `Parent: ${params.parentDiameter}mm`}
				| Angle: {params.angle.toFixed(1)}°
			</tspan>
			{#if params.offset}
				<tspan x={PADDING + 2} dy="3.5">Offset: {params.offset.toFixed(1)}mm</tspan>
			{/if}
			{#if params.taper}
				<tspan x={PADDING + 2} dy="3.5">Taper: {params.taper}</tspan>
			{/if}
			{#if params.twist}
				<tspan x={PADDING + 2} dy="3.5">Twist: {params.twist.toFixed(1)}°</tspan>
			{/if}
		</text>
	{/if}

	{#if showLegend && isBridge}
		<text
			x={PADDING + circumference - 2}
			y={PADDING + 4}
			fill="var(--color-text-dim, #888)"
			font-size="2.8"
			font-family="monospace"
			text-anchor="end"
		>
			<tspan x={PADDING + circumference - 2} dy="0">
				Bridge: {bridge!.endA.params.cutDiameter}mm | Wall: {bridge!.endA.params.wallThickness}mm
			</tspan>
			<tspan x={PADDING + circumference - 2} dy="3.5">
				A: {bridge!.endA.params.parentDiameter}mm @ {bridge!.endA.params.angle.toFixed(1)}°
				| B: {bridge!.endB.params.parentDiameter}mm @ {bridge!.endB.params.angle.toFixed(1)}°
			</tspan>
			<tspan x={PADDING + circumference - 2} dy="3.5">
				Length: {bridge!.bridgeLength}mm
			</tspan>
		</text>
	{/if}
</svg>

<style>
	.template-svg {
		display: block;
		max-width: 100%;
		max-height: 70vh;
		border-radius: 4px;
	}

	@media print {
		.template-svg {
			/* Print at exact 1:1 scale */
			width: auto !important;
			height: auto !important;
			max-width: none;
		}
	}
</style>
