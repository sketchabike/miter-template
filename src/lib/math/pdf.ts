/**
 * Tiled PDF export at exact 1:1 scale.
 *
 * Generates a multi-page PDF where the miter template is tiled across
 * pages with overlap zones and alignment marks. Each page prints at
 * exact physical dimensions so builders can tape pages together and
 * get a 1:1 template.
 */

import { jsPDF } from 'jspdf';
import type { CopeResult } from './cope.js';

export interface PaperSize {
	name: string;
	/** Width in mm */
	width: number;
	/** Height in mm */
	height: number;
}

export const PAPER_SIZES: PaperSize[] = [
	{ name: 'Letter', width: 215.9, height: 279.4 },
	{ name: 'A4', width: 210, height: 297 },
	{ name: 'A3', width: 297, height: 420 },
	{ name: 'Legal', width: 215.9, height: 355.6 },
	{ name: 'Tabloid', width: 279.4, height: 431.8 }
];

/** Margin on each side in mm */
const MARGIN = 10;

/** Overlap between tiles in mm */
const OVERLAP = 12;

/** Headroom above the cope curve in mm */
const HEADROOM = 20;

/** Scale bar length in mm */
const SCALE_BAR = 50;

interface TileBounds {
	/** Template x start for this tile */
	srcX: number;
	/** Template y start for this tile */
	srcY: number;
	/** Width of template content in this tile */
	contentW: number;
	/** Height of template content in this tile */
	contentH: number;
	/** Column index */
	col: number;
	/** Row index */
	row: number;
}

/**
 * Generate a multi-page PDF of the miter template at exact 1:1 scale.
 */
export function generatePDF(result: CopeResult, paper: PaperSize): Uint8Array {
	const { points, circumference, height, params } = result;

	// Total template dimensions
	const templateW = circumference;
	const templateH = height + HEADROOM;

	// Printable area per page
	const printW = paper.width - MARGIN * 2;
	const printH = paper.height - MARGIN * 2;

	// Effective tile size (minus overlap on each edge except the first)
	const tileW = printW - OVERLAP;
	const tileH = printH - OVERLAP;

	// Number of tiles needed
	const cols = Math.max(1, Math.ceil(templateW / tileW));
	const rows = Math.max(1, Math.ceil(templateH / tileH));

	// Build tile grid
	const tiles: TileBounds[] = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const srcX = col * tileW;
			const srcY = row * tileH;
			const contentW = Math.min(printW, templateW - srcX + (col > 0 ? OVERLAP : 0));
			const contentH = Math.min(printH, templateH - srcY + (row > 0 ? OVERLAP : 0));
			tiles.push({ srcX: col > 0 ? srcX - OVERLAP : 0, srcY: row > 0 ? srcY - OVERLAP : 0, contentW, contentH, col, row });
		}
	}

	const totalPages = tiles.length;
	const doc = new jsPDF({
		orientation: paper.width > paper.height ? 'landscape' : 'portrait',
		unit: 'mm',
		format: [paper.width, paper.height]
	});

	for (let pageIdx = 0; pageIdx < tiles.length; pageIdx++) {
		if (pageIdx > 0) doc.addPage();

		const tile = tiles[pageIdx];
		const offsetX = MARGIN;
		const offsetY = MARGIN;

		// --- Draw the cope curve clipped to this tile ---
		drawCopeCurve(doc, result, tile, offsetX, offsetY, templateH);

		// --- Draw quarter guidelines ---
		drawGuidelines(doc, result, tile, offsetX, offsetY, templateH);

		// --- Alignment marks at overlap zones ---
		if (tile.col > 0) {
			drawOverlapMark(doc, offsetX + OVERLAP, offsetY, offsetY + tile.contentH, 'left');
		}
		if (tile.col < cols - 1) {
			drawOverlapMark(doc, offsetX + tile.contentW - OVERLAP, offsetY, offsetY + tile.contentH, 'right');
		}
		if (tile.row > 0) {
			drawOverlapMark(doc, offsetX, offsetY + OVERLAP, offsetX + tile.contentW, 'top');
		}

		// --- Scale verification bar ---
		drawScaleBar(doc, offsetX + 2, offsetY + tile.contentH - 6);

		// --- Page info ---
		doc.setFontSize(7);
		doc.setTextColor(120);
		const pageLabel = `Page ${pageIdx + 1}/${totalPages} (col ${tile.col + 1}, row ${tile.row + 1})`;
		doc.text(pageLabel, offsetX + 2, offsetY + tile.contentH - 2);

		// --- Legend (first page only) ---
		if (pageIdx === 0) {
			drawLegend(doc, params, offsetX + 2, offsetY + 5);
		}

		// --- Crop marks at corners ---
		drawCropMarks(doc, offsetX, offsetY, tile.contentW, tile.contentH);
	}

	const buffer = doc.output('arraybuffer');
	return new Uint8Array(buffer);
}

function drawCopeCurve(
	doc: jsPDF,
	result: CopeResult,
	tile: TileBounds,
	offsetX: number,
	offsetY: number,
	templateH: number
) {
	const { points, circumference } = result;

	doc.setDrawColor(0, 0, 0);
	doc.setLineWidth(0.3);

	let prevScreenX = -Infinity;
	let prevScreenY = 0;
	let started = false;

	for (const p of points) {
		// Template coordinates
		const tx = p.x;
		const ty = templateH - p.y; // Flip Y: curve at bottom of template

		// Shift to tile coordinates
		const tileX = tx - tile.srcX;
		const tileY = ty - tile.srcY;

		// Clip to tile bounds
		if (tileX < -1 || tileX > tile.contentW + 1 || tileY < -1 || tileY > tile.contentH + 1) {
			started = false;
			continue;
		}

		const screenX = offsetX + tileX;
		const screenY = offsetY + tileY;

		if (started && screenX >= prevScreenX - 0.5) {
			doc.line(prevScreenX, prevScreenY, screenX, screenY);
		}

		prevScreenX = screenX;
		prevScreenY = screenY;
		started = true;
	}

	// Close: connect last point back to first (at x + circumference)
	const first = points[0];
	const lastTx = first.x + circumference;
	const lastTy = templateH - first.y;
	const lastTileX = lastTx - tile.srcX;
	const lastTileY = lastTy - tile.srcY;

	if (lastTileX >= -1 && lastTileX <= tile.contentW + 1 &&
		lastTileY >= -1 && lastTileY <= tile.contentH + 1 && started) {
		doc.line(prevScreenX, prevScreenY, offsetX + lastTileX, offsetY + lastTileY);
	}
}

function drawGuidelines(
	doc: jsPDF,
	result: CopeResult,
	tile: TileBounds,
	offsetX: number,
	offsetY: number,
	templateH: number
) {
	doc.setDrawColor(200, 0, 0);
	doc.setLineWidth(0.15);

	const step = result.circumference / 4;
	for (let i = 0; i <= 4; i++) {
		const tx = i * step;
		const tileX = tx - tile.srcX;

		if (tileX >= 0 && tileX <= tile.contentW) {
			const screenX = offsetX + tileX;
			// Dashed line
			const dashLen = 2;
			const gapLen = 1;
			let y = offsetY;
			while (y < offsetY + tile.contentH) {
				const end = Math.min(y + dashLen, offsetY + tile.contentH);
				doc.line(screenX, y, screenX, end);
				y = end + gapLen;
			}

			// Label at top
			doc.setFontSize(6);
			doc.setTextColor(200, 0, 0);
			doc.text(`${i * 90}°`, screenX, offsetY - 1, { align: 'center' });
		}
	}
}

function drawOverlapMark(
	doc: jsPDF,
	x: number,
	y1: number,
	y2: number,
	side: 'left' | 'right' | 'top'
) {
	doc.setDrawColor(150, 150, 150);
	doc.setLineWidth(0.1);

	if (side === 'top') {
		// Horizontal overlap line
		doc.setLineDashPattern([1, 1], 0);
		doc.line(x, y1, y2, y1); // y2 is actually xEnd for 'top'
		doc.setLineDashPattern([], 0);

		doc.setFontSize(5);
		doc.setTextColor(150);
		doc.text('▲ align here', x + 2, y1 - 0.5);
	} else {
		// Vertical overlap line
		doc.setLineDashPattern([1, 1], 0);
		doc.line(x, y1, x, y2);
		doc.setLineDashPattern([], 0);

		doc.setFontSize(5);
		doc.setTextColor(150);
		const label = side === 'left' ? '◀ align' : 'align ▶';
		doc.text(label, x + (side === 'left' ? 0.5 : -8), y1 + 3);
	}
}

function drawScaleBar(doc: jsPDF, x: number, y: number) {
	const len = Math.min(SCALE_BAR, 50);

	doc.setDrawColor(0);
	doc.setFillColor(0);
	doc.setLineWidth(0.3);

	// Alternating black/white 10mm segments
	for (let i = 0; i < len; i += 10) {
		const segLen = Math.min(10, len - i);
		if ((i / 10) % 2 === 0) {
			doc.rect(x + i, y, segLen, 2, 'F');
		} else {
			doc.rect(x + i, y, segLen, 2, 'S');
		}
	}

	// Labels
	doc.setFontSize(5);
	doc.setTextColor(0);
	doc.text('0', x, y + 4);
	doc.text(`${len}mm`, x + len, y + 4, { align: 'right' });
	doc.text('VERIFY SCALE — this bar should measure exactly ' + len + 'mm', x, y - 1);
}

function drawLegend(
	doc: jsPDF,
	params: CopeResult['params'],
	x: number,
	y: number
) {
	doc.setFontSize(8);
	doc.setTextColor(80);

	const isEllip = Array.isArray(params.cutDiameter);
	const cutStr = isEllip
		? `${(params.cutDiameter as [number, number])[0]}×${(params.cutDiameter as [number, number])[1]}mm`
		: `${params.cutDiameter}mm`;

	const lines = [
		`Cut: ${cutStr}  |  Wall: ${params.wallThickness}mm`,
		`${params.flat ? 'Flat cut' : `Parent: ${params.parentDiameter}mm`}  |  Angle: ${params.angle.toFixed(1)}°`
	];

	if (params.offset) lines.push(`Offset: ${params.offset}mm`);
	if (params.taper) lines.push(`Taper: ${params.taper}`);
	if (params.twist) lines.push(`Twist: ${params.twist}°`);

	for (let i = 0; i < lines.length; i++) {
		doc.text(lines[i], x, y + i * 3.5);
	}
}

function drawCropMarks(
	doc: jsPDF,
	x: number,
	y: number,
	w: number,
	h: number
) {
	doc.setDrawColor(150);
	doc.setLineWidth(0.1);

	const len = 4;
	const gap = 1;

	// Top-left
	doc.line(x - gap, y, x - gap - len, y);
	doc.line(x, y - gap, x, y - gap - len);

	// Top-right
	doc.line(x + w + gap, y, x + w + gap + len, y);
	doc.line(x + w, y - gap, x + w, y - gap - len);

	// Bottom-left
	doc.line(x - gap, y + h, x - gap - len, y + h);
	doc.line(x, y + h + gap, x, y + h + gap + len);

	// Bottom-right
	doc.line(x + w + gap, y + h, x + w + gap + len, y + h);
	doc.line(x + w, y + h + gap, x + w, y + h + gap + len);
}
