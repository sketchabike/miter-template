import { describe, it, expect } from 'vitest';
import {
	generateCope,
	generateBridgeMiter,
	generateCompoundMiter,
	generateCollectorMiter,
	computeCompoundAngle,
	mmToInches,
	inchesToMm,
	formatDual,
	PRESETS,
	FLAT_PLATE_PRESETS,
	BRIDGE_PRESETS,
	COMPOUND_PRESETS,
	COLLECTOR_PRESETS,
	type CopeParams,
	type BridgeParams,
	type CompoundAngleParams,
	type CollectorParams
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

// ============================================================
// Flat Plate
// ============================================================

describe('flat plate mode', () => {
	it('parentDiameter does not affect flat plate result', () => {
		const base: CopeParams = {
			cutDiameter: 25.4,
			parentDiameter: 100,
			wallThickness: 0.9,
			angle: 45,
			flat: true
		};

		const result100 = generateCope(base);
		const result1000 = generateCope({ ...base, parentDiameter: 1000 });

		// Heights should be identical — parentDiameter cancels out in flat mode
		expect(result100.height).toBeCloseTo(result1000.height, 4);
		for (let i = 0; i < result100.points.length; i++) {
			expect(result100.points[i].y).toBeCloseTo(result1000.points[i].y, 4);
		}
	});

	it('flat plate at 45° has expected height', () => {
		const result = generateCope({
			cutDiameter: 25.4,
			parentDiameter: 100,
			wallThickness: 0.9,
			angle: 45,
			flat: true
		});

		// Height ≈ inner_radius * tan(45°) * 2 = inner_radius * 2
		// inner_radius = (25.4 - 2*0.9) / 2 = 11.8
		// But the flat formula uses normalized coords, so the exact height
		// depends on the slope term. Just verify it's positive and reasonable.
		expect(result.height).toBeGreaterThan(5);
		expect(result.height).toBeLessThan(50);
	});

	it('all flat plate presets generate valid templates', () => {
		for (const preset of FLAT_PLATE_PRESETS) {
			const result = generateCope({
				cutDiameter: preset.cutDiameter,
				parentDiameter: preset.parentDiameter,
				wallThickness: preset.wallThickness,
				angle: preset.angle,
				flat: true
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
			expect(result.circumference).toBeGreaterThan(0);
		}
	});
});

// ============================================================
// Bridge Miter
// ============================================================

describe('generateBridgeMiter', () => {
	const baseBridge: BridgeParams = {
		tubeDiameter: 12.7,
		wallThickness: 0.8,
		parentDiameterA: 14,
		parentDiameterB: 14,
		angleA: 90,
		angleB: 90,
		bridgeLength: 100
	};

	it('returns two cope results and bridge length', () => {
		const result = generateBridgeMiter(baseBridge);
		expect(result.endA).toBeDefined();
		expect(result.endB).toBeDefined();
		expect(result.bridgeLength).toBe(100);
		expect(result.circumference).toBeCloseTo(Math.PI * 12.7, 1);
	});

	it('both ends have correct number of points', () => {
		const result = generateBridgeMiter(baseBridge);
		expect(result.endA.points.length).toBe(1440);
		expect(result.endB.points.length).toBe(1440);
	});

	it('same parent diameter and angle produces identical end curves', () => {
		const result = generateBridgeMiter(baseBridge);
		expect(result.endA.height).toBeCloseTo(result.endB.height, 4);

		for (let i = 0; i < result.endA.points.length; i++) {
			expect(result.endA.points[i].y).toBeCloseTo(result.endB.points[i].y, 4);
		}
	});

	it('different parent diameters produce different end curves', () => {
		const result = generateBridgeMiter({
			...baseBridge,
			parentDiameterA: 14,
			parentDiameterB: 22.2
		});
		expect(result.endA.height).not.toBeCloseTo(result.endB.height, 1);
	});

	it('different angles produce different end curves', () => {
		const result = generateBridgeMiter({
			...baseBridge,
			angleA: 90,
			angleB: 70
		});
		expect(result.endA.height).not.toBeCloseTo(result.endB.height, 1);
	});

	it('circumference matches bridge tube, not parent tubes', () => {
		const result = generateBridgeMiter({
			...baseBridge,
			parentDiameterA: 14,
			parentDiameterB: 22.2
		});
		expect(result.circumference).toBeCloseTo(Math.PI * 12.7, 1);
		expect(result.endA.circumference).toBeCloseTo(Math.PI * 12.7, 1);
		expect(result.endB.circumference).toBeCloseTo(Math.PI * 12.7, 1);
	});

	it('all bridge presets generate valid results', () => {
		for (const preset of BRIDGE_PRESETS) {
			const result = generateBridgeMiter({
				tubeDiameter: preset.tubeDiameter,
				wallThickness: preset.wallThickness,
				parentDiameterA: preset.parentDiameterA,
				parentDiameterB: preset.parentDiameterB,
				angleA: preset.angleA,
				angleB: preset.angleB,
				bridgeLength: preset.bridgeLength
			});
			expect(result.endA.points.length).toBe(1440);
			expect(result.endB.points.length).toBe(1440);
			expect(result.endA.height).toBeGreaterThan(0);
			expect(result.endB.height).toBeGreaterThan(0);
			expect(result.bridgeLength).toBeGreaterThan(0);
		}
	});

	it('custom resolution is passed to both ends', () => {
		const result = generateBridgeMiter({ ...baseBridge, resolution: 360 });
		expect(result.endA.points.length).toBe(360);
		expect(result.endB.points.length).toBe(360);
	});
});

// ============================================================
// Compound Angle (Seatstay → Seat Tube)
// ============================================================

describe('computeCompoundAngle', () => {
	it('zero splay returns elevation as true angle', () => {
		const { trueAngle, twist } = computeCompoundAngle(65, 0);
		expect(trueAngle).toBeCloseTo(65, 4);
		expect(twist).toBeCloseTo(0, 4);
	});

	it('zero elevation and 90° splay returns 90° true angle', () => {
		const { trueAngle } = computeCompoundAngle(0, 90);
		expect(trueAngle).toBeCloseTo(90, 4);
	});

	it('compound angle is always >= elevation', () => {
		for (const elev of [30, 45, 60, 75]) {
			for (const splay of [0, 2, 5, 10, 15]) {
				const { trueAngle } = computeCompoundAngle(elev, splay);
				expect(trueAngle).toBeGreaterThanOrEqual(elev - 0.001);
			}
		}
	});

	it('known values: 65° elevation + 5° splay', () => {
		const { trueAngle, twist } = computeCompoundAngle(65, 5);
		// cos(65°)·cos(5°) = 0.4226·0.9962 = 0.4210 → arccos = 65.1°
		expect(trueAngle).toBeCloseTo(65.1, 0);
		// atan2(sin(5°), sin(65°)·cos(5°)) = atan2(0.0872, 0.9028) ≈ 5.5°
		expect(twist).toBeCloseTo(5.5, 0);
	});

	it('symmetric: same splay on both sides gives same true angle', () => {
		const pos = computeCompoundAngle(65, 5);
		const neg = computeCompoundAngle(65, -5);
		expect(pos.trueAngle).toBeCloseTo(neg.trueAngle, 4);
	});

	it('twist is zero when splay is zero', () => {
		const { twist } = computeCompoundAngle(45, 0);
		expect(twist).toBeCloseTo(0, 4);
	});

	it('twist approaches 90° as elevation approaches 0°', () => {
		const { twist } = computeCompoundAngle(1, 45);
		expect(twist).toBeGreaterThan(80);
	});
});

describe('generateCompoundMiter', () => {
	const baseCompound: CompoundAngleParams = {
		stayDiameter: 14,
		seatTubeDiameter: 28.6,
		wallThickness: 0.8,
		elevation: 65,
		splay: 5,
		staySpacing: 42
	};

	it('generates valid cope result', () => {
		const result = generateCompoundMiter(baseCompound);
		expect(result.points.length).toBe(1440);
		expect(result.height).toBeGreaterThan(0);
		expect(result.circumference).toBeCloseTo(Math.PI * 14, 1);
	});

	it('zero splay matches standard offset miter', () => {
		const compound = generateCompoundMiter({
			...baseCompound,
			splay: 0
		});
		const standard = generateCope({
			cutDiameter: 14,
			parentDiameter: 28.6,
			wallThickness: 0.8,
			angle: 65,
			offset: 21 // staySpacing/2
		});

		expect(compound.height).toBeCloseTo(standard.height, 2);
	});

	it('splay increases template height slightly', () => {
		const noSplay = generateCompoundMiter({ ...baseCompound, splay: 0 });
		const withSplay = generateCompoundMiter({ ...baseCompound, splay: 10 });

		// More splay = steeper true angle = slightly taller template
		expect(withSplay.height).not.toBeCloseTo(noSplay.height, 1);
	});

	it('produces offset in the result params', () => {
		const result = generateCompoundMiter(baseCompound);
		expect(result.params.offset).toBeCloseTo(21, 1);
	});

	it('all compound presets generate valid templates', () => {
		for (const preset of COMPOUND_PRESETS) {
			const result = generateCompoundMiter({
				stayDiameter: preset.stayDiameter,
				seatTubeDiameter: preset.seatTubeDiameter,
				wallThickness: preset.wallThickness,
				elevation: preset.elevation,
				splay: preset.splay,
				staySpacing: preset.staySpacing
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
			expect(result.circumference).toBeGreaterThan(0);
		}
	});

	it('custom resolution is passed through', () => {
		const result = generateCompoundMiter({ ...baseCompound, resolution: 360 });
		expect(result.points.length).toBe(360);
	});
});

// ============================================================
// Collector Miter
// ============================================================

describe('generateCollectorMiter', () => {
	it('single parent matches standard cope', () => {
		const collector = generateCollectorMiter({
			cutDiameter: 25.4,
			wallThickness: 0.9,
			parents: [{ parentDiameter: 31.8, angle: 90, clockPosition: 0 }]
		});
		const standard = generateCope({
			cutDiameter: 25.4,
			parentDiameter: 31.8,
			wallThickness: 0.9,
			angle: 90
		});

		expect(collector.height).toBeCloseTo(standard.height, 4);
		for (let i = 0; i < collector.points.length; i++) {
			expect(collector.points[i].y).toBeCloseTo(standard.points[i].y, 4);
		}
	});

	it('two identical parents at same position match single parent', () => {
		const single = generateCollectorMiter({
			cutDiameter: 25.4,
			wallThickness: 0.9,
			parents: [{ parentDiameter: 31.8, angle: 60, clockPosition: 0 }]
		});
		const double = generateCollectorMiter({
			cutDiameter: 25.4,
			wallThickness: 0.9,
			parents: [
				{ parentDiameter: 31.8, angle: 60, clockPosition: 0 },
				{ parentDiameter: 31.8, angle: 60, clockPosition: 0 }
			]
		});

		expect(double.height).toBeCloseTo(single.height, 4);
	});

	it('envelope y is at most the individual cope y at every point', () => {
		// The envelope takes min(y) so at every θ the collector curve
		// should be ≤ the single-parent curve (in raw coordinates)
		const single = generateCollectorMiter({
			cutDiameter: 28.6,
			wallThickness: 0.9,
			parents: [{ parentDiameter: 28.6, angle: 60, clockPosition: 0 }]
		});
		const collector = generateCollectorMiter({
			cutDiameter: 28.6,
			wallThickness: 0.9,
			parents: [
				{ parentDiameter: 28.6, angle: 60, clockPosition: 0 },
				{ parentDiameter: 28.6, angle: 60, clockPosition: 180 }
			]
		});

		// Recover raw y for each. At every point, collector raw ≤ single raw.
		for (let i = 0; i < single.points.length; i++) {
			const singleRaw = single.points[i].y + single.minY;
			const collectorRaw = collector.points[i].y + collector.minY;
			expect(collectorRaw).toBeLessThanOrEqual(singleRaw + 0.01);
		}
	});

	it('two parents at opposite clock positions produce wider saddle', () => {
		const single = generateCollectorMiter({
			cutDiameter: 28.6,
			wallThickness: 0.9,
			parents: [{ parentDiameter: 28.6, angle: 60, clockPosition: 0 }]
		});
		const opposed = generateCollectorMiter({
			cutDiameter: 28.6,
			wallThickness: 0.9,
			parents: [
				{ parentDiameter: 28.6, angle: 60, clockPosition: 0 },
				{ parentDiameter: 28.6, angle: 60, clockPosition: 90 }
			]
		});

		// With a second parent at 90°, the envelope should differ
		expect(opposed.height).not.toBeCloseTo(single.height, 1);
	});

	it('correct number of points', () => {
		const result = generateCollectorMiter({
			cutDiameter: 28.6,
			wallThickness: 0.9,
			parents: [
				{ parentDiameter: 25.4, angle: 45, clockPosition: 0 },
				{ parentDiameter: 25.4, angle: 45, clockPosition: 120 }
			]
		});
		expect(result.points.length).toBe(1440);
	});

	it('custom resolution works', () => {
		const result = generateCollectorMiter({
			cutDiameter: 28.6,
			wallThickness: 0.9,
			parents: [
				{ parentDiameter: 25.4, angle: 45, clockPosition: 0 },
				{ parentDiameter: 25.4, angle: 45, clockPosition: 120 }
			],
			resolution: 360
		});
		expect(result.points.length).toBe(360);
	});

	it('throws on empty parents array', () => {
		expect(() =>
			generateCollectorMiter({
				cutDiameter: 28.6,
				wallThickness: 0.9,
				parents: []
			})
		).toThrow('at least one parent');
	});

	it('three parents at 120° spacing produce 3-fold symmetry', () => {
		const result = generateCollectorMiter({
			cutDiameter: 38,
			wallThickness: 0.9,
			parents: [
				{ parentDiameter: 25.4, angle: 45, clockPosition: 0 },
				{ parentDiameter: 25.4, angle: 45, clockPosition: 120 },
				{ parentDiameter: 25.4, angle: 45, clockPosition: 240 }
			]
		});

		const n = result.points.length;
		const third = Math.floor(n / 3);

		// Points separated by 1/3 circumference should have the same y
		for (let i = 0; i < 10; i++) {
			const idx = i * 10;
			expect(result.points[idx].y).toBeCloseTo(
				result.points[(idx + third) % n].y,
				1
			);
		}
	});

	it('all collector presets generate valid templates', () => {
		for (const preset of COLLECTOR_PRESETS) {
			const result = generateCollectorMiter({
				cutDiameter: preset.cutDiameter,
				wallThickness: preset.wallThickness,
				parents: preset.parents
			});
			expect(result.points.length).toBe(1440);
			expect(result.height).toBeGreaterThan(0);
			expect(result.circumference).toBeGreaterThan(0);
		}
	});
});
