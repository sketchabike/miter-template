/**
 * Tube Miter / Cope Template Generator
 *
 * Generates wrap-around paper templates for cutting tube joints.
 * Print → cut out → wrap around tube → trace the curve → cut/file to line.
 *
 * Algorithm:
 * 1. Walk around the cut tube circumference in angular steps
 * 2. At each angle, compute the point on the INSIDE circumference
 * 3. Project that point onto the parent tube surface
 * 4. Map angular position back to OUTSIDE circumference (what you actually mark)
 * 5. The resulting curve, when wrapped around the tube, gives the cut line
 *
 * Supports: round-to-round, elliptical-to-round, tapered parent, offset joints,
 * twist (clock rotation), and flat cuts.
 */

const TWO_PI = 2 * Math.PI;

/** Parameters for generating a cope/miter template */
export interface CopeParams {
	/** Cut tube outer diameter in mm (or [major, minor] for elliptical) */
	cutDiameter: number | [number, number];
	/** Parent tube outer diameter in mm */
	parentDiameter: number;
	/** Wall thickness of the cut tube in mm */
	wallThickness: number;
	/** Angle between tube centerlines in degrees (90 = perpendicular) */
	angle: number;
	/** Offset from parent tube center in mm (e.g., seatstay offset) */
	offset?: number;
	/** Taper ratio of parent tube: diameter change per unit length */
	taper?: number;
	/** Twist/clock rotation in degrees */
	twist?: number;
	/** If true, treat as flat cut (parent diameter → infinity) */
	flat?: boolean;
	/** Number of sample points around the circumference */
	resolution?: number;
}

/** A single point on the template curve */
export interface TemplatePoint {
	/** Distance around the outside circumference in mm */
	x: number;
	/** Height on the template in mm (0 = lowest point of curve) */
	y: number;
}

/** Complete result from cope calculation */
export interface CopeResult {
	/** The template curve points */
	points: TemplatePoint[];
	/** Total outside circumference of the cut tube in mm */
	circumference: number;
	/** Height range of the template in mm */
	height: number;
	/** Minimum y value before normalization */
	minY: number;
	/** Maximum y value before normalization */
	maxY: number;
	/** Parameters used to generate this result */
	params: CopeParams;
}

/**
 * Precompute circumference distance lookup for an ellipse.
 * We walk 100,000 steps around the ellipse and record cumulative arc length
 * at each angular position, then binary-search to map angle → distance.
 */
class Ellipse {
	private perimTable: [number, number][];
	readonly totalPerimeter: number;

	constructor(
		readonly majorRadius: number,
		readonly minorRadius: number
	) {
		const n = 100_000;
		const step = TWO_PI / n;
		const table: [number, number][] = [];
		let totalDist = 0;
		let prevX = majorRadius;
		let prevY = 0;

		for (let i = 0; i <= n; i++) {
			const theta = i * step;
			const x = majorRadius * Math.cos(theta);
			const y = minorRadius * Math.sin(theta);
			if (i > 0) {
				const dx = x - prevX;
				const dy = y - prevY;
				totalDist += Math.sqrt(dx * dx + dy * dy);
			}
			table.push([theta, totalDist]);
			prevX = x;
			prevY = y;
		}

		this.perimTable = table;
		this.totalPerimeter = totalDist;
	}

	/** Get circumference distance at a given angle (0..2π) */
	circumDistance(theta: number): number {
		// Normalize to [0, 2π)
		theta = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
		return this.binarySearch(theta);
	}

	private binarySearch(theta: number): number {
		const table = this.perimTable;
		let lo = 0;
		let hi = table.length - 1;

		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (table[mid][0] <= theta) {
				lo = mid;
			} else {
				hi = mid;
			}
		}

		// Linear interpolation between lo and hi
		const [tLo, dLo] = table[lo];
		const [tHi, dHi] = table[hi];
		if (tHi === tLo) return dLo;
		const t = (theta - tLo) / (tHi - tLo);
		return dLo + t * (dHi - dLo);
	}
}

/**
 * Generate a cope/miter template.
 *
 * The algorithm works in a normalized coordinate system where the parent tube
 * diameter is 1.0. The cut tube's inner profile is walked at angular increments,
 * each point projected onto the parent tube surface to determine cut height.
 */
export function generateCope(params: CopeParams): CopeResult {
	const {
		cutDiameter,
		parentDiameter,
		wallThickness,
		angle,
		offset = 0,
		taper = 0,
		twist = 0,
		flat = false,
		resolution = 1440
	} = params;

	// Parse cut tube dimensions
	let cutMajor: number;
	let cutMinor: number;
	if (Array.isArray(cutDiameter)) {
		[cutMajor, cutMinor] = cutDiameter;
	} else {
		cutMajor = cutDiameter;
		cutMinor = cutDiameter;
	}

	// Inner diameters (subtract wall on each side)
	const innerMajor = cutMajor - wallThickness * 2;
	const innerMinor = cutMinor - wallThickness * 2;

	// Normalized inner radii (parent diameter = 1.0)
	const rMajor = innerMajor / parentDiameter;
	const rMinor = innerMinor / parentDiameter;

	// Normalized offset
	const normOffset = offset / parentDiameter;

	// The inter-tube angle. We want the orientation of the parent tube
	// relative to the cut tube cross-section, so add 90°.
	const slopeAngle = angle + 90;
	const slope = Math.tan(slopeAngle * Math.PI / 180);

	const twistRad = twist * Math.PI / 180;
	const parentRadius = parentDiameter / 2;
	const taperHalf = taper / 2;

	// Set up the outside circumference mapping
	const isElliptical = Math.abs(cutMajor - cutMinor) > 0.001;
	const ellipse = isElliptical
		? new Ellipse(cutMajor / 2, cutMinor / 2)
		: null;

	const circumference = ellipse
		? ellipse.totalPerimeter
		: Math.PI * cutMajor;

	// Walk around the cut tube
	const step = TWO_PI / resolution;
	const rawPoints: { circumDist: number; rawY: number }[] = [];
	let minY = Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < resolution; i++) {
		const theta = i * step;

		// Point on the INSIDE circumference of the cut tube (normalized)
		const a = rMajor * Math.cos(theta + twistRad) + normOffset;
		const b = rMinor * Math.sin(theta + twistRad);

		let y: number;

		if (Math.abs(a) > 1) {
			// Miss the parent tube entirely — maximum height
			y = 1;
		} else if (flat) {
			// Flat cut: as if parent diameter were infinite
			const r = 1.0 + b * taperHalf;
			y = 1 - r - b * slope;
		} else {
			// Standard projection onto cylindrical parent tube
			const phi = Math.asin(a);
			const r = 1.0 + b * taperHalf;
			y = 1 - r * Math.cos(phi) - b * slope;
		}

		// Map angle to outside circumference distance
		const circumDist = ellipse
			? ellipse.circumDistance(theta)
			: (theta / TWO_PI) * circumference;

		// Scale y from normalized to actual mm
		const yMm = parentRadius * y;

		rawPoints.push({ circumDist, rawY: yMm });
		if (yMm < minY) minY = yMm;
		if (yMm > maxY) maxY = yMm;
	}

	// Shift so minimum y = 0 (the template starts at the bottom of the cut)
	const points: TemplatePoint[] = rawPoints.map((p) => ({
		x: p.circumDist,
		y: p.rawY - minY
	}));

	const height = maxY - minY;

	return {
		points,
		circumference,
		height,
		minY,
		maxY,
		params
	};
}

/**
 * Convert mm to inches (for display).
 */
export function mmToInches(mm: number): number {
	return mm / 25.4;
}

/**
 * Convert inches to mm.
 */
export function inchesToMm(inches: number): number {
	return inches * 25.4;
}

/**
 * Format a dimension in mm and inches.
 */
export function formatDual(mm: number, precision = 1): string {
	const inches = mmToInches(mm);
	return `${mm.toFixed(precision)}mm (${inches.toFixed(precision + 1)}")`;
}

/** Standard bicycle tube presets */
export interface JointPreset {
	name: string;
	description: string;
	cutDiameter: number | [number, number];
	parentDiameter: number;
	wallThickness: number;
	angle: number;
	offset?: number;
	twist?: number;
}

export const PRESETS: JointPreset[] = [
	{
		name: 'Down Tube → Head Tube',
		description: 'Standard road/gravel DT to HT joint',
		cutDiameter: 28.6,
		parentDiameter: 31.8,
		wallThickness: 0.9,
		angle: 62
	},
	{
		name: 'Down Tube → Head Tube (OS)',
		description: 'Oversize DT to 44mm HT',
		cutDiameter: 35,
		parentDiameter: 44,
		wallThickness: 0.9,
		angle: 62
	},
	{
		name: 'Top Tube → Head Tube',
		description: 'Standard TT to HT joint',
		cutDiameter: 25.4,
		parentDiameter: 31.8,
		wallThickness: 0.9,
		angle: 73
	},
	{
		name: 'Top Tube → Seat Tube',
		description: 'Standard TT to ST joint',
		cutDiameter: 25.4,
		parentDiameter: 28.6,
		wallThickness: 0.9,
		angle: 55
	},
	{
		name: 'Down Tube → Seat Tube',
		description: 'DT to ST junction at BB area',
		cutDiameter: 28.6,
		parentDiameter: 28.6,
		wallThickness: 0.9,
		angle: 58
	},
	{
		name: 'Seat Tube → BB Shell',
		description: 'ST perpendicular to BB shell',
		cutDiameter: 28.6,
		parentDiameter: 40,
		wallThickness: 0.8,
		angle: 90
	},
	{
		name: 'Down Tube → BB Shell',
		description: 'DT perpendicular to BB shell',
		cutDiameter: 28.6,
		parentDiameter: 40,
		wallThickness: 0.9,
		angle: 90
	},
	{
		name: 'Chainstay → BB Shell',
		description: 'CS to BB shell (round CS)',
		cutDiameter: 22.2,
		parentDiameter: 40,
		wallThickness: 0.8,
		angle: 90
	},
	{
		name: 'Chainstay → BB Shell (oval)',
		description: 'Oval CS to BB shell',
		cutDiameter: [22.2, 16],
		parentDiameter: 40,
		wallThickness: 0.8,
		angle: 90
	},
	{
		name: 'Seat Stay → Seat Tube (L)',
		description: 'Left seatstay, offset by SS diameter',
		cutDiameter: 14,
		parentDiameter: 28.6,
		wallThickness: 0.8,
		angle: 65,
		offset: 14
	},
	{
		name: 'Seat Stay → Seat Tube (R)',
		description: 'Right seatstay, offset by SS diameter',
		cutDiameter: 14,
		parentDiameter: 28.6,
		wallThickness: 0.8,
		angle: 65,
		offset: -14
	},
	{
		name: 'Custom',
		description: 'Enter your own dimensions',
		cutDiameter: 25.4,
		parentDiameter: 31.8,
		wallThickness: 0.9,
		angle: 90
	}
];
