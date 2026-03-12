<script lang="ts">
	import { generateCope, PRESETS, type CopeParams, type CopeResult } from '$lib/math/cope.js';
	import { generatePDF, PAPER_SIZES, type PaperSize } from '$lib/math/pdf.js';
	import TemplateView from '$lib/components/TemplateView.svelte';
	import Controls from '$lib/components/Controls.svelte';

	let units = $state<'mm' | 'in'>('mm');
	let paperSize = $state<PaperSize>(PAPER_SIZES[0]); // Letter default

	let params = $state<CopeParams>({
		cutDiameter: 25.4,
		parentDiameter: 31.8,
		wallThickness: 0.9,
		angle: 73
	});

	let result = $derived<CopeResult>(generateCope(params));

	function handleParamsChange(newParams: CopeParams) {
		params = newParams;
	}

	function handlePrintPDF() {
		const pdfBytes = generatePDF(result, paperSize);
		const blob = new Blob([pdfBytes], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);

		// Open in new tab for printing
		window.open(url, '_blank');

		// Clean up after a delay
		setTimeout(() => URL.revokeObjectURL(url), 30000);
	}

	function handleDownloadPDF() {
		const pdfBytes = generatePDF(result, paperSize);
		const blob = new Blob([pdfBytes], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = 'miter-template.pdf';
		a.click();

		URL.revokeObjectURL(url);
	}

	function handleExportSvg() {
		const svgEl = document.querySelector('.template-svg');
		if (!svgEl) return;

		const clone = svgEl.cloneNode(true) as SVGElement;

		// Set print-friendly styles
		clone.style.setProperty('--bg-template', '#ffffff');
		clone.style.setProperty('--color-curve', '#000000');
		clone.style.setProperty('--color-guideline', '#cc0000');
		clone.style.setProperty('--color-text-dim', '#444444');
		clone.style.setProperty('--color-scale', '#888888');
		clone.style.setProperty('--color-scale-bar', '#666666');

		const svgData = new XMLSerializer().serializeToString(clone);
		const blob = new Blob([svgData], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = 'miter-template.svg';
		a.click();

		URL.revokeObjectURL(url);
	}

	// Format dimensions for the info panel
	function fmtDim(mm: number): string {
		if (units === 'in') {
			return `${(mm / 25.4).toFixed(3)}"`;
		}
		return `${mm.toFixed(1)}mm`;
	}
</script>

<svelte:head>
	<title>Tube Miter Template Generator — Free tool for framebuilders</title>
	<meta name="description" content="Free tube miter template generator. Create printable cope templates for bicycle frame tube joints. Supports round, elliptical, and tapered tubes." />
</svelte:head>

<div class="app">
	<header>
		<div class="header-content">
			<h1>Tube Miter Templates</h1>
			<p class="subtitle">Free cope template generator for framebuilders</p>
		</div>
		<div class="header-brand">
			by <a href="https://sketchabike.com" target="_blank" rel="noopener">SketchABike</a>
		</div>
	</header>

	<main>
		<aside class="sidebar">
			<Controls
				{params}
				onchange={handleParamsChange}
				{units}
				onunitschange={(u) => (units = u)}
			/>
		</aside>

		<section class="preview">
			<div class="template-container" id="template-print-area">
				<TemplateView {result} />
			</div>

			<div class="info-bar">
				<div class="info-item">
					<span class="info-label">Circumference</span>
					<span class="info-value">{fmtDim(result.circumference)}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Template Height</span>
					<span class="info-value">{fmtDim(result.height)}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Angle</span>
					<span class="info-value">{params.angle.toFixed(1)}°</span>
				</div>
			</div>

			<div class="actions">
				<div class="paper-select">
					<label for="paper-size">Paper:</label>
					<select id="paper-size" bind:value={paperSize}>
						{#each PAPER_SIZES as size}
							<option value={size}>{size.name} ({size.width}x{size.height}mm)</option>
						{/each}
					</select>
				</div>
				<button class="btn btn-primary" onclick={handlePrintPDF}>
					Print PDF (1:1 scale)
				</button>
				<button class="btn btn-secondary" onclick={handleDownloadPDF}>
					Download PDF
				</button>
				<button class="btn btn-secondary" onclick={handleExportSvg}>
					Export SVG
				</button>
			</div>

			<div class="instructions">
				<h3>How to use</h3>
				<ol>
					<li>Select a joint preset or enter custom dimensions</li>
					<li>Choose your paper size and click <strong>Print PDF</strong></li>
					<li>The PDF is at exact 1:1 scale — if the template is larger than one page, it tiles across multiple pages with alignment marks</li>
					<li>Verify scale: measure the bar at the bottom of each page with a ruler</li>
					<li>If multi-page: tape pages together at the dashed alignment marks</li>
					<li>Cut out the template along the black curve</li>
					<li>Wrap around your tube, aligning the red quarter guidelines</li>
					<li>Trace the curve edge onto the tube with a marker</li>
					<li>Cut along the line with a hacksaw, then file to fit</li>
				</ol>
				<p class="tip">
					<strong>Tip:</strong> Use the scale verification bar on each page to confirm your printer isn't scaling. The alternating black/white segments should each measure exactly 10mm.
				</p>
			</div>
		</section>
	</main>

	<footer>
		<p>
			Free and open source. Made for framebuilders by
			<a href="https://sketchabike.com" target="_blank" rel="noopener">SketchABike</a>.
		</p>
	</footer>
</div>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		background: var(--bg-page, #0a0a1a);
		color: var(--color-text, #e0e0e0);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		line-height: 1.5;
	}

	:global(:root) {
		--bg-page: #0a0a1a;
		--bg-surface: #111128;
		--bg-input: #16213e;
		--bg-template: #1a1a2e;
		--border-input: #2a2a4a;
		--color-text: #e0e0e0;
		--color-text-secondary: #aaa;
		--color-text-dim: #666;
		--color-accent: #00d4ff;
		--color-accent-hover: #00b8e0;
		--color-curve: #00d4ff;
		--color-guideline: #e74c3c;
		--color-scale: #555;
		--color-scale-bar: #666;
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-input);
		background: var(--bg-surface);
	}

	h1 {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.subtitle {
		font-size: 0.85rem;
		color: var(--color-text-secondary);
	}

	.header-brand {
		font-size: 0.8rem;
		color: var(--color-text-dim);
	}

	.header-brand a {
		color: var(--color-accent);
		text-decoration: none;
	}

	.header-brand a:hover {
		text-decoration: underline;
	}

	main {
		display: flex;
		flex: 1;
		gap: 0;
	}

	.sidebar {
		width: 300px;
		min-width: 300px;
		padding: 20px;
		background: var(--bg-surface);
		border-right: 1px solid var(--border-input);
		overflow-y: auto;
		max-height: calc(100vh - 60px);
	}

	.preview {
		flex: 1;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-x: auto;
	}

	.template-container {
		background: var(--bg-surface);
		border-radius: 8px;
		padding: 16px;
		border: 1px solid var(--border-input);
		overflow-x: auto;
	}

	.info-bar {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-size: 0.75rem;
		color: var(--color-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.info-value {
		font-size: 1.1rem;
		font-weight: 600;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: var(--color-text);
	}

	.actions {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
	}

	.paper-select {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
	}

	.paper-select select {
		background: var(--bg-input);
		border: 1px solid var(--border-input);
		border-radius: 4px;
		padding: 8px 10px;
		color: var(--color-text);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.paper-select select:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.btn {
		padding: 10px 20px;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-primary {
		background: var(--color-accent);
		color: var(--bg-page);
	}

	.btn-primary:hover {
		background: var(--color-accent-hover);
	}

	.btn-secondary {
		background: var(--bg-input);
		color: var(--color-text);
		border: 1px solid var(--border-input);
	}

	.btn-secondary:hover {
		border-color: var(--color-accent);
	}

	.instructions {
		background: var(--bg-surface);
		border-radius: 8px;
		padding: 20px;
		border: 1px solid var(--border-input);
	}

	.instructions h3 {
		font-size: 1rem;
		margin-bottom: 12px;
		color: var(--color-text-secondary);
	}

	.instructions ol {
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}

	.instructions strong {
		color: var(--color-text);
	}

	.tip {
		margin-top: 12px;
		padding: 10px 14px;
		background: var(--bg-input);
		border-radius: 4px;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		border-left: 3px solid var(--color-accent);
	}

	footer {
		padding: 16px 24px;
		text-align: center;
		font-size: 0.8rem;
		color: var(--color-text-dim);
		border-top: 1px solid var(--border-input);
	}

	footer a {
		color: var(--color-accent);
		text-decoration: none;
	}

	/* Print styles */
	@media print {
		header,
		.sidebar,
		.info-bar,
		.actions,
		.instructions,
		footer {
			display: none !important;
		}

		:global(body) {
			background: white !important;
			color: black !important;
		}

		.app {
			min-height: auto;
		}

		main {
			display: block;
		}

		.preview {
			padding: 0;
		}

		.template-container {
			background: white !important;
			border: none !important;
			padding: 0 !important;
			border-radius: 0 !important;
		}

		:global(.template-svg) {
			--bg-template: #ffffff !important;
			--color-curve: #000000 !important;
			--color-guideline: #cc0000 !important;
			--color-text-dim: #444444 !important;
			--color-scale: #888888 !important;
			--color-scale-bar: #666666 !important;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		main {
			flex-direction: column;
		}

		.sidebar {
			width: 100%;
			min-width: auto;
			max-height: none;
			border-right: none;
			border-bottom: 1px solid var(--border-input);
		}
	}
</style>
