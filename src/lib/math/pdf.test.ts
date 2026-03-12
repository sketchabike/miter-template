import { describe, it, expect } from 'vitest';
import { generatePDF, PAPER_SIZES } from './pdf.js';
import { generateCope } from './cope.js';

describe('generatePDF', () => {
	const result = generateCope({
		cutDiameter: 25.4,
		parentDiameter: 31.8,
		wallThickness: 0.9,
		angle: 73
	});

	it('generates a PDF as Uint8Array', () => {
		const pdf = generatePDF(result, PAPER_SIZES[0]);
		expect(pdf).toBeInstanceOf(Uint8Array);
		expect(pdf.length).toBeGreaterThan(100);
	});

	it('PDF starts with %PDF header', () => {
		const pdf = generatePDF(result, PAPER_SIZES[0]);
		const header = new TextDecoder().decode(pdf.slice(0, 5));
		expect(header).toBe('%PDF-');
	});

	it('works with all paper sizes', () => {
		for (const paper of PAPER_SIZES) {
			const pdf = generatePDF(result, paper);
			expect(pdf.length).toBeGreaterThan(100);
		}
	});

	it('generates a valid PDF for small template', () => {
		// 25.4mm tube has ~80mm circumference, fits easily on letter/A4
		const pdf = generatePDF(result, PAPER_SIZES[0]);
		expect(pdf.length).toBeGreaterThan(100);
		// Verify it's a valid PDF
		const header = new TextDecoder().decode(pdf.slice(0, 5));
		expect(header).toBe('%PDF-');
	});

	it('generates multiple pages for large template', () => {
		// Very acute angle = very tall template
		const bigResult = generateCope({
			cutDiameter: 44,
			parentDiameter: 44,
			wallThickness: 0.9,
			angle: 10 // very acute = very tall
		});
		const pdf = generatePDF(bigResult, PAPER_SIZES[0]);
		// Multi-page PDF should be larger
		expect(pdf.length).toBeGreaterThan(5000);
	});

	it('works with elliptical tube result', () => {
		const ellipResult = generateCope({
			cutDiameter: [22.2, 16],
			parentDiameter: 40,
			wallThickness: 0.8,
			angle: 90
		});
		const pdf = generatePDF(ellipResult, PAPER_SIZES[1]); // A4
		expect(pdf.length).toBeGreaterThan(100);
	});

	it('works with offset result', () => {
		const offsetResult = generateCope({
			cutDiameter: 14,
			parentDiameter: 28.6,
			wallThickness: 0.8,
			angle: 65,
			offset: 14
		});
		const pdf = generatePDF(offsetResult, PAPER_SIZES[0]);
		expect(pdf.length).toBeGreaterThan(100);
	});
});

describe('PAPER_SIZES', () => {
	it('has standard paper sizes', () => {
		const names = PAPER_SIZES.map((p) => p.name);
		expect(names).toContain('Letter');
		expect(names).toContain('A4');
		expect(names).toContain('A3');
	});

	it('all sizes have positive dimensions', () => {
		for (const size of PAPER_SIZES) {
			expect(size.width).toBeGreaterThan(0);
			expect(size.height).toBeGreaterThan(0);
		}
	});
});
