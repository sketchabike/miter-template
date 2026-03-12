import { describe, it, expect } from 'vitest';
import {
	generateCope,
	mmToInches,
	inchesToMm,
	formatDual,
	PRESETS,
	type CopeParams
} from './cope.js';

describe('generateCope', () => {
	const baseParams: CopeParams = {
		cutDiameter: 25.4,
		parentDiameter: 31.8,
		wallThickness: 0.9,
		angle: 90
	};

	describe('basic properties', () => {
		it('returns correct number of points at default resolution', () => {
			const result = generateCope(baseParams);
			expect(result.points.length).toBe(1440);
		});

		it('returns correct number of points at custom resolution', () => {
			const result = generateCope({ ...baseParams, resolution: 360 });
			expect(result.points.length).toBe(360);
		});

		it('calculates correct circumference for round tube', () => {
			const result = generateCope(baseParams);
			const expected = Math.PI * 25.4;
			expect(result.circumference).toBeCloseTo(expected, 1);
		});

		it('all x values are within [0, circumference)', () => {
			const result = generateCope(baseParams);
			for (const p of result.points) {
				expect(p.x).toBeGreaterThanOrEqual(0);
				expect(p.x).toBeLessThan(result.circumference + 0.01);
			}
		});

		it('all y values are non-negative (shifted to 0 baseline)', () => {
			const result = generateCope(baseParams);
			for (const p of result.points) {
				expect(p.y).toBeGreaterThanOrEqual(-0.001);
			}
		});

		it('minimum y is approximately 0', () => {
			const result = generateCope(baseParams);
			const minY = Math.min(...result.points.map((p) => p.y));
			expect(minY).toBeCloseTo(0, 2);
		});

		it('height is positive', () => {
			const result = generateCope(baseParams);
			expect(result.height).toBeGreaterThan(0);
		});
	});

	describe('90-degree joint (perpendicular)', () => {
		it('produces a saddle shape (two peaks, two valleys)', () => {
			const result = generateCope({
				cutDiameter: 25.4,
				parentDiameter: 31.8,
				wallThickness: 0.9,
				angle: 90
			});

			// At 90°, the template should be symmetric: two high points
			// (at 0° and 180° around the tube) and two low points (at 90° and 270°)
			const n = result.points.length;
			const quarter = Math.floor(n / 4);

			// Points near 0 and n/2 should be high (peaks)
			// Points near n/4 and 3n/4 should be low (valleys)
			const y0 = result.points[0].y;
			const yQ = result.points[quarter].y;
			const yH = result.points[Math.floor(n / 2)].y;
			const y3Q = result.points[Math.floor((3 * n) / 4)].y;

			// Peaks should be higher than valleys
			expect(y0).toBeGreaterThan(yQ);
			expect(yH).toBeGreaterThan(y3Q);

			// The two peaks should be similar
			expect(y0).toBeCloseTo(yH, 1);
			// The two valleys should be similar
			expect(yQ).toBeCloseTo(y3Q, 1);
		});

		it('equal tube diameters produce symmetric template', () => {
			const result = generateCope({
				cutDiameter: 25.4,
				parentDiameter: 25.4,
				wallThickness: 0.9,
				angle: 90
			});

			const n = result.points.length;
			// Check symmetry: point at i should match point at n-i (mirrored)
			for (let i = 1; i < Math.floor(n / 4); i++) {
				const a = result.points[i].y;
				const b = result.points[n - i].y;
				expect(a).toBeCloseTo(b, 1);
			}
		});
	});

	describe('angle effects', () => {
		it('steeper angle produces taller template', () => {
			const shallow = generateCope({ ...baseParams, angle: 80 });
			const steep = generateCope({ ...baseParams, angle: 45 });
			expect(steep.height).toBeGreaterThan(shallow.height);
		});

		it('90-degree produces shorter template than 45-degree', () => {
			const perp = generateCope({ ...baseParams, angle: 90 });
			const angled = generateCope({ ...baseParams, angle: 45 });
			expect(angled.height).toBeGreaterThan(perp.height);
		});

		it('very acute angle produces tall asymmetric template', () => {
			const result = generateCope({ ...baseParams, angle: 30 });
			expect(result.height).toBeGreaterThan(10);
		});
	});

	describe('tube diameter effects', () => {
		it('larger cut tube on smaller parent needs more material removed', () => {
			const small = generateCope({
				cutDiameter: 20,
				parentDiameter: 40,
				wallThickness: 0.9,
				angle: 90
			});
			const large = generateCope({
				cutDiameter: 35,
				parentDiameter: 40,
				wallThickness: 0.9,
				angle: 90
			});
			// Larger cut tube wraps further around the parent, deeper saddle
			expect(large.height).toBeGreaterThan(small.height);
		});
	});

	describe('elliptical cut tube', () => {
		it('accepts [major, minor] diameter tuple', () => {
			const result = generateCope({
				cutDiameter: [22.2, 16],
				parentDiameter: 40,
				wallThickness: 0.8,
				angle: 90
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
		});

		it('elliptical circumference differs from round', () => {
			const round = generateCope({
				cutDiameter: 22.2,
				parentDiameter: 40,
				wallThickness: 0.8,
				angle: 90
			});
			const ellip = generateCope({
				cutDiameter: [22.2, 16],
				parentDiameter: 40,
				wallThickness: 0.8,
				angle: 90
			});
			// Elliptical circumference should be less than round
			expect(ellip.circumference).toBeLessThan(round.circumference);
			expect(ellip.circumference).toBeGreaterThan(0);
		});

		it('equal major/minor matches round tube result', () => {
			const round = generateCope({
				cutDiameter: 25.4,
				parentDiameter: 31.8,
				wallThickness: 0.9,
				angle: 90
			});
			const fakeEllip = generateCope({
				cutDiameter: [25.4, 25.4],
				parentDiameter: 31.8,
				wallThickness: 0.9,
				angle: 90
			});
			// Heights should be very similar
			expect(fakeEllip.height).toBeCloseTo(round.height, 0);
		});
	});

	describe('offset', () => {
		it('offset shifts the template asymmetrically', () => {
			const centered = generateCope({ ...baseParams, angle: 65 });
			const offset = generateCope({ ...baseParams, angle: 65, offset: 14 });

			// Template heights should differ with offset
			expect(offset.height).not.toBeCloseTo(centered.height, 0);
		});

		it('positive and negative offsets are mirror images', () => {
			const pos = generateCope({ ...baseParams, angle: 65, offset: 14 });
			const neg = generateCope({ ...baseParams, angle: 65, offset: -14 });

			// Heights should be the same
			expect(pos.height).toBeCloseTo(neg.height, 2);
		});
	});

	describe('taper', () => {
		it('taper modifies the template height', () => {
			const noTaper = generateCope({ ...baseParams, angle: 60 });
			const tapered = generateCope({ ...baseParams, angle: 60, taper: 0.05 });

			// Height should differ with taper
			expect(tapered.height).not.toBeCloseTo(noTaper.height, 1);
		});
	});

	describe('twist', () => {
		it('twist rotates the template pattern', () => {
			const noTwist = generateCope({ ...baseParams, angle: 60 });
			const twisted = generateCope({ ...baseParams, angle: 60, twist: 45 });

			// The heights should be the same (just shifted around the tube)
			expect(twisted.height).toBeCloseTo(noTwist.height, 2);

			// But individual point values should differ
			const diff = Math.abs(noTwist.points[0].y - twisted.points[0].y);
			expect(diff).toBeGreaterThan(0.01);
		});
	});

	describe('flat cut', () => {
		it('flat cut produces a sinusoidal template', () => {
			const result = generateCope({
				...baseParams,
				angle: 45,
				flat: true
			});

			expect(result.height).toBeGreaterThan(0);

			// For flat cut, the height variation comes from the slope term (b * slope)
			// where b = r * sin(theta). Max/min are at theta=π/2 and theta=3π/2
			const n = result.points.length;
			const quarter = Math.floor(n / 4);
			const threeQuarter = Math.floor((3 * n) / 4);

			const yQ = result.points[quarter].y;
			const y3Q = result.points[threeQuarter].y;

			// Quarter and three-quarter positions should have different heights
			expect(Math.abs(yQ - y3Q)).toBeGreaterThan(1);
		});

		it('flat cut at 90 degrees produces flat template', () => {
			const result = generateCope({
				...baseParams,
				angle: 90,
				flat: true
			});

			// At 90°, flat cut means straight cut — minimal height variation
			expect(result.height).toBeLessThan(1);
		});
	});

	describe('wall thickness', () => {
		it('thicker wall slightly affects the template', () => {
			const thin = generateCope({ ...baseParams, wallThickness: 0.5 });
			const thick = generateCope({ ...baseParams, wallThickness: 2.0 });

			// The template is based on INNER diameter, so thicker wall = smaller
			// inner profile = slightly different cut
			expect(thin.height).not.toBe(thick.height);
		});
	});

	describe('edge cases', () => {
		it('handles very small tube (14mm seatstay)', () => {
			const result = generateCope({
				cutDiameter: 14,
				parentDiameter: 28.6,
				wallThickness: 0.8,
				angle: 65,
				offset: 14
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
			expect(result.circumference).toBeCloseTo(Math.PI * 14, 1);
		});

		it('handles large tube (44mm HT)', () => {
			const result = generateCope({
				cutDiameter: 35,
				parentDiameter: 44,
				wallThickness: 0.9,
				angle: 62
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
		});

		it('handles angle of 90 (perpendicular)', () => {
			const result = generateCope({ ...baseParams, angle: 90 });
			expect(result.height).toBeGreaterThan(0);
		});

		it('handles angle near 0 (nearly parallel) — should have very tall template', () => {
			const result = generateCope({ ...baseParams, angle: 10 });
			expect(result.height).toBeGreaterThan(30);
		});
	});
});

describe('unit conversions', () => {
	it('mmToInches converts correctly', () => {
		expect(mmToInches(25.4)).toBeCloseTo(1, 5);
		expect(mmToInches(0)).toBe(0);
	});

	it('inchesToMm converts correctly', () => {
		expect(inchesToMm(1)).toBeCloseTo(25.4, 5);
		expect(inchesToMm(0)).toBe(0);
	});

	it('roundtrip conversion', () => {
		expect(inchesToMm(mmToInches(28.6))).toBeCloseTo(28.6, 5);
	});

	it('formatDual produces readable output', () => {
		const result = formatDual(25.4);
		expect(result).toContain('25.4');
		expect(result).toContain('1.0');
		expect(result).toContain('"');
	});
});

describe('presets', () => {
	it('all presets generate valid templates', () => {
		for (const preset of PRESETS) {
			const result = generateCope({
				cutDiameter: preset.cutDiameter,
				parentDiameter: preset.parentDiameter,
				wallThickness: preset.wallThickness,
				angle: preset.angle,
				offset: preset.offset,
				twist: preset.twist
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
			expect(result.circumference).toBeGreaterThan(0);
		}
	});

	it('has required preset types', () => {
		const names = PRESETS.map((p) => p.name);
		expect(names).toContain('Down Tube → Head Tube');
		expect(names).toContain('Top Tube → Head Tube');
		expect(names).toContain('Seat Stay → Seat Tube (L)');
		expect(names).toContain('Chainstay → BB Shell (oval)');
		expect(names).toContain('Custom');
	});
});
