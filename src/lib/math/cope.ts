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

// ============================================================
// Joint Types
// ============================================================

export type JointType = 'standard' | 'flat-plate' | 'bridge' | 'compound-ss' | 'collector' | 'square' | 'slot';

// ============================================================
// Bridge Miter — double-ended template for braces/bridges
// ============================================================

export interface BridgeParams {
	/** Bridge/brace tube OD in mm */
	tubeDiameter: number;
	/** Wall thickness of the bridge tube in mm */
	wallThickness: number;
	/** Parent tube OD at end A in mm */
	parentDiameterA: number;
	/** Parent tube OD at end B in mm */
	parentDiameterB: number;
	/** Angle at end A in degrees */
	angleA: number;
	/** Angle at end B in degrees */
	angleB: number;
	/** Distance between parent tube centers along bridge centerline in mm */
	bridgeLength: number;
	/** Number of sample points */
	resolution?: number;
}

export interface BridgeResult {
	/** Cope for end A (near end / bottom of template) */
	endA: CopeResult;
	/** Cope for end B (far end / top of template) */
	endB: CopeResult;
	/** Distance between parent tube centers along bridge centerline */
	bridgeLength: number;
	/** Bridge tube circumference */
	circumference: number;
}

/**
 * Generate a double-ended bridge/brace miter template.
 * Produces two cope curves (one for each end) that share the same circumference.
 */
export function generateBridgeMiter(params: BridgeParams): BridgeResult {
	const {
		tubeDiameter,
		wallThickness,
		parentDiameterA,
		parentDiameterB,
		angleA,
		angleB,
		bridgeLength,
		resolution = 1440
	} = params;

	const endA = generateCope({
		cutDiameter: tubeDiameter,
		parentDiameter: parentDiameterA,
		wallThickness,
		angle: angleA,
		resolution
	});

	const endB = generateCope({
		cutDiameter: tubeDiameter,
		parentDiameter: parentDiameterB,
		wallThickness,
		angle: angleB,
		resolution
	});

	return {
		endA,
		endB,
		bridgeLength,
		circumference: Math.PI * tubeDiameter
	};
}

// ============================================================
// Compound Angle — seatstay-to-seat-tube with lateral splay
// ============================================================

export interface CompoundAngleParams {
	/** Seatstay tube OD in mm */
	stayDiameter: number;
	/** Seat tube OD in mm */
	seatTubeDiameter: number;
	/** Wall thickness of the stay in mm */
	wallThickness: number;
	/** Elevation angle in degrees (angle between stay and seat tube in side view) */
	elevation: number;
	/** Lateral splay angle in degrees (angle out of center plane) */
	splay: number;
	/** Stay spacing at seat tube in mm (center-to-center between left and right stays) */
	staySpacing: number;
	/** Number of sample points */
	resolution?: number;
}

/**
 * Compute the true 3D inter-tube angle and twist from elevation + splay.
 *
 * The seatstay direction vector in the seat tube's coordinate frame:
 *   d = (sin(elev)·cos(splay), sin(splay), cos(elev)·cos(splay))
 *
 * True angle = arccos(d · ẑ) = arccos(cos(elev)·cos(splay))
 * Twist = rotation of the cope pattern to match the 3D approach angle
 */
export function computeCompoundAngle(
	elevationDeg: number,
	splayDeg: number
): { trueAngle: number; twist: number } {
	const a = (elevationDeg * Math.PI) / 180;
	const b = (splayDeg * Math.PI) / 180;
	const trueAngle = (Math.acos(Math.cos(a) * Math.cos(b)) * 180) / Math.PI;
	const twist = (Math.atan2(Math.sin(b), Math.sin(a) * Math.cos(b)) * 180) / Math.PI;
	return { trueAngle, twist };
}

/**
 * Generate a compound-angle seatstay miter.
 * Converts elevation + splay to true 3D angle, twist, and offset,
 * then delegates to the standard generateCope().
 */
export function generateCompoundMiter(params: CompoundAngleParams): CopeResult {
	const {
		stayDiameter,
		seatTubeDiameter,
		wallThickness,
		elevation,
		splay,
		staySpacing,
		resolution = 1440
	} = params;

	const { trueAngle, twist } = computeCompoundAngle(elevation, splay);
	const lateralOffset = staySpacing / 2;

	return generateCope({
		cutDiameter: stayDiameter,
		parentDiameter: seatTubeDiameter,
		wallThickness,
		angle: trueAngle,
		offset: lateralOffset,
		twist,
		resolution
	});
}

// ============================================================
// Collector — multiple parent tubes meeting one cut tube
// ============================================================

/** One parent tube in a collector junction */
export interface CollectorTube {
	/** Parent tube OD in mm */
	parentDiameter: number;
	/** Angle between this parent and the cut tube in degrees */
	angle: number;
	/** Clock position in degrees — where on the cut tube this parent approaches */
	clockPosition: number;
	/** Offset from cut tube center in mm */
	offset?: number;
}

export interface CollectorParams {
	/** Cut tube OD in mm */
	cutDiameter: number;
	/** Wall thickness of the cut tube in mm */
	wallThickness: number;
	/** Parent tubes meeting this cut tube */
	parents: CollectorTube[];
	/** Number of sample points */
	resolution?: number;
}

/**
 * Generate a collector miter template.
 *
 * For each parent tube, computes a standard cope with the parent's clock position
 * as the twist. The final template is the minimum envelope — at each angular position
 * around the cut tube, the cut follows whichever parent surface requires the deepest cut.
 */
export function generateCollectorMiter(params: CollectorParams): CopeResult {
	const { cutDiameter, wallThickness, parents, resolution = 1440 } = params;

	if (parents.length === 0) {
		throw new Error('Collector requires at least one parent tube');
	}

	// Generate individual cope for each parent
	const copes = parents.map((parent) =>
		generateCope({
			cutDiameter,
			parentDiameter: parent.parentDiameter,
			wallThickness,
			angle: parent.angle,
			offset: parent.offset,
			twist: parent.clockPosition,
			resolution
		})
	);

	const circumference = copes[0].circumference;

	// Build envelope: at each sample point, take the minimum raw y
	const envelopeRaw: { circumDist: number; rawY: number }[] = [];
	let minY = Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < resolution; i++) {
		const circumDist = copes[0].points[i].x;
		let envY = Infinity;

		for (const cope of copes) {
			// Recover raw y (before normalization) from the shifted point
			const rawY = cope.points[i].y + cope.minY;
			if (rawY < envY) envY = rawY;
		}

		envelopeRaw.push({ circumDist, rawY: envY });
		if (envY < minY) minY = envY;
		if (envY > maxY) maxY = envY;
	}

	// Normalize so min y = 0
	const points: TemplatePoint[] = envelopeRaw.map((p) => ({
		x: p.circumDist,
		y: p.rawY - minY
	}));

	const height = maxY - minY;

	// Synthetic params using first parent as reference
	const resultParams: CopeParams = {
		cutDiameter,
		parentDiameter: parents[0].parentDiameter,
		wallThickness,
		angle: parents[0].angle
	};

	return {
		points,
		circumference,
		height,
		minY,
		maxY,
		params: resultParams
	};
}

// ============================================================
// Round-to-Square — tube meeting a square/rectangular section
// ============================================================

export interface SquareParams {
	/** Cut tube OD in mm */
	cutDiameter: number;
	/** Parent square section side length in mm */
	parentSide: number;
	/** Wall thickness of the cut tube in mm */
	wallThickness: number;
	/** Corner radius of the parent square section in mm (0 = sharp corners) */
	cornerRadius: number;
	/** Angle between tube centerline and parent axis in degrees */
	angle: number;
	/** Offset from parent center in mm */
	offset?: number;
	/** Twist/clock rotation in degrees */
	twist?: number;
	/** Number of sample points */
	resolution?: number;
}

/**
 * Compute the surface depth of a square cross-section at normalized lateral position a.
 *
 * The square has half-side = 1 (normalized). Corner radius is rNorm (0..1).
 * Returns the "depth" analogous to cos(asin(a)) for a cylinder.
 *
 * - Flat face (|a| <= 1 - rNorm): depth = 1.0
 * - Corner (1 - rNorm < |a| <= 1): arc transition
 * - Miss (|a| > 1): returns null
 */
export function squareSurfaceDepth(a: number, rNorm: number): number | null {
	const absA = Math.abs(a);

	if (absA > 1) {
		return null; // misses the parent entirely
	}

	if (absA <= 1 - rNorm) {
		// On the flat face
		return 1.0;
	}

	// In the corner radius region
	// Corner center is at (1 - rNorm) from center, radius rNorm
	const da = absA - (1 - rNorm);
	const depthFromCorner = Math.sqrt(rNorm * rNorm - da * da);
	return (1 - rNorm) + depthFromCorner;
}

/**
 * Generate a miter template for a round tube meeting a square section.
 *
 * Uses the same algorithm as generateCope() but replaces the cylindrical
 * projection (cos(asin(a))) with squareSurfaceDepth().
 *
 * When cornerRadius = parentSide/2, the square degenerates to a cylinder
 * and the result matches a standard round-to-round cope.
 */
export function generateSquareMiter(params: SquareParams): CopeResult {
	const {
		cutDiameter,
		parentSide,
		wallThickness,
		cornerRadius,
		angle,
		offset = 0,
		twist = 0,
		resolution = 1440
	} = params;

	const parentRadius = parentSide / 2;
	const rNorm = Math.min(cornerRadius / parentRadius, 1.0);

	// Inner diameter of cut tube
	const innerDiameter = cutDiameter - wallThickness * 2;
	// Normalized inner radius (parent "radius" = parentSide/2)
	const rMajor = (innerDiameter / 2) / parentRadius;

	const normOffset = offset / parentRadius;

	const slopeAngle = angle + 90;
	const slope = Math.tan(slopeAngle * Math.PI / 180);

	const twistRad = twist * Math.PI / 180;
	const circumference = Math.PI * cutDiameter;

	const step = TWO_PI / resolution;
	const rawPoints: { circumDist: number; rawY: number }[] = [];
	let minY = Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < resolution; i++) {
		const theta = i * step;

		const a = rMajor * Math.cos(theta + twistRad) + normOffset;
		const b = rMajor * Math.sin(theta + twistRad);

		let y: number;
		const depth = squareSurfaceDepth(a, rNorm);

		if (depth === null) {
			// Misses the parent
			y = 1;
		} else {
			// depth replaces cos(asin(a)) from the cylindrical case
			y = 1 - depth - b * slope;
		}

		const circumDist = (theta / TWO_PI) * circumference;
		const yMm = parentRadius * y;

		rawPoints.push({ circumDist, rawY: yMm });
		if (yMm < minY) minY = yMm;
		if (yMm > maxY) maxY = yMm;
	}

	const points: TemplatePoint[] = rawPoints.map((p) => ({
		x: p.circumDist,
		y: p.rawY - minY
	}));

	const height = maxY - minY;

	// Store as CopeParams for compatibility (parentDiameter = parentSide)
	const resultParams: CopeParams = {
		cutDiameter,
		parentDiameter: parentSide,
		wallThickness,
		angle
	};

	return {
		points,
		circumference,
		height,
		minY,
		maxY,
		params: resultParams
	};
}

// ============================================================
// Tube Slot — slot cut for hooded dropouts / plate insertions
// ============================================================

export interface SlotParams {
	/** Tube OD in mm */
	tubeDiameter: number;
	/** Wall thickness of the tube in mm */
	wallThickness: number;
	/** Thickness of the plate/dropout being inserted in mm */
	plateThickness: number;
	/** Depth of the slot cut in mm */
	slotDepth: number;
	/** Number of sample points */
	resolution?: number;
}

/**
 * Generate a tube slot template.
 *
 * Produces a template that marks where to cut a slot in a tube to receive
 * a flat plate (e.g., hooded dropout). The slot is a rectangular opening:
 * slotDepth tall, plateThickness wide (on the tube surface).
 *
 * The template is a CopeResult where y = slotDepth within the slot angular
 * range and y = 0 outside. This creates a simple rectangular cutout template
 * that wraps around the tube.
 */
export function generateSlotTemplate(params: SlotParams): CopeResult {
	const {
		tubeDiameter,
		wallThickness,
		plateThickness,
		slotDepth,
		resolution = 1440
	} = params;

	const innerRadius = (tubeDiameter - wallThickness * 2) / 2;
	const circumference = Math.PI * tubeDiameter;

	// Half-angle subtended by the plate thickness on the inner surface
	// plateThickness is a chord; half-chord / radius gives sin of half-angle
	const halfChord = plateThickness / 2;
	if (halfChord >= innerRadius) {
		throw new Error('Plate thickness must be less than tube inner diameter');
	}
	const slotHalfAngle = Math.asin(halfChord / innerRadius);

	const step = TWO_PI / resolution;
	const rawPoints: { circumDist: number; rawY: number }[] = [];
	let minY = Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < resolution; i++) {
		const theta = i * step;
		const circumDist = (theta / TWO_PI) * circumference;

		// Normalize theta to [-π, π] to check if we're in the slot region
		let normalizedTheta = theta;
		if (normalizedTheta > Math.PI) normalizedTheta -= TWO_PI;

		let rawY: number;
		if (Math.abs(normalizedTheta) <= slotHalfAngle) {
			rawY = slotDepth;
		} else {
			rawY = 0;
		}

		rawPoints.push({ circumDist, rawY });
		if (rawY < minY) minY = rawY;
		if (rawY > maxY) maxY = rawY;
	}

	const points: TemplatePoint[] = rawPoints.map((p) => ({
		x: p.circumDist,
		y: p.rawY - minY
	}));

	const height = maxY - minY;

	const resultParams: CopeParams = {
		cutDiameter: tubeDiameter,
		parentDiameter: tubeDiameter,
		wallThickness,
		angle: 90
	};

	return {
		points,
		circumference,
		height,
		minY,
		maxY,
		params: resultParams
	};
}

// ============================================================
// Joint-type-specific presets
// ============================================================

export const FLAT_PLATE_PRESETS: JointPreset[] = [
	{
		name: 'Gusset at 45°',
		description: 'Round tube to flat gusset plate',
		cutDiameter: 25.4,
		parentDiameter: 100, // irrelevant for flat mode (cancels out)
		wallThickness: 0.9,
		angle: 45
	},
	{
		name: 'Mounting Tab at 90°',
		description: 'Perpendicular tube to flat plate (fish mouth)',
		cutDiameter: 25.4,
		parentDiameter: 100,
		wallThickness: 0.9,
		angle: 90
	},
	{
		name: 'Custom Flat',
		description: 'Enter your own dimensions',
		cutDiameter: 25.4,
		parentDiameter: 100,
		wallThickness: 0.9,
		angle: 45
	}
];

export interface BridgePreset {
	name: string;
	description: string;
	tubeDiameter: number;
	wallThickness: number;
	parentDiameterA: number;
	parentDiameterB: number;
	angleA: number;
	angleB: number;
	bridgeLength: number;
}

export const BRIDGE_PRESETS: BridgePreset[] = [
	{
		name: 'Seat Stay Bridge',
		description: 'Bridge between seatstays (perpendicular)',
		tubeDiameter: 12.7,
		wallThickness: 0.8,
		parentDiameterA: 14,
		parentDiameterB: 14,
		angleA: 90,
		angleB: 90,
		bridgeLength: 100
	},
	{
		name: 'Chain Stay Bridge',
		description: 'Bridge between chainstays',
		tubeDiameter: 12.7,
		wallThickness: 0.8,
		parentDiameterA: 22.2,
		parentDiameterB: 22.2,
		angleA: 90,
		angleB: 90,
		bridgeLength: 70
	},
	{
		name: 'Custom Bridge',
		description: 'Enter your own dimensions',
		tubeDiameter: 12.7,
		wallThickness: 0.8,
		parentDiameterA: 25.4,
		parentDiameterB: 25.4,
		angleA: 90,
		angleB: 90,
		bridgeLength: 80
	}
];

export interface CompoundPreset {
	name: string;
	description: string;
	stayDiameter: number;
	seatTubeDiameter: number;
	wallThickness: number;
	elevation: number;
	splay: number;
	staySpacing: number;
}

export const COMPOUND_PRESETS: CompoundPreset[] = [
	{
		name: 'Road Seatstay',
		description: 'Typical road SS → ST with light splay',
		stayDiameter: 14,
		seatTubeDiameter: 28.6,
		wallThickness: 0.8,
		elevation: 65,
		splay: 4,
		staySpacing: 42
	},
	{
		name: 'Touring Seatstay',
		description: 'Wider spacing for rack mounts',
		stayDiameter: 14,
		seatTubeDiameter: 28.6,
		wallThickness: 0.8,
		elevation: 63,
		splay: 6,
		staySpacing: 44
	},
	{
		name: 'Custom Compound',
		description: 'Enter your own dimensions',
		stayDiameter: 14,
		seatTubeDiameter: 28.6,
		wallThickness: 0.8,
		elevation: 65,
		splay: 5,
		staySpacing: 42
	}
];

export interface CollectorPreset {
	name: string;
	description: string;
	cutDiameter: number;
	wallThickness: number;
	parents: CollectorTube[];
}

export const COLLECTOR_PRESETS: CollectorPreset[] = [
	{
		name: 'Y-Junction (2 tubes)',
		description: 'Two equal tubes merging at a Y',
		cutDiameter: 28.6,
		wallThickness: 0.9,
		parents: [
			{ parentDiameter: 28.6, angle: 60, clockPosition: -30, offset: 0 },
			{ parentDiameter: 28.6, angle: 60, clockPosition: 30, offset: 0 }
		]
	},
	{
		name: '3-into-1 Collector',
		description: 'Three tubes at 120° spacing',
		cutDiameter: 38,
		wallThickness: 0.9,
		parents: [
			{ parentDiameter: 25.4, angle: 45, clockPosition: 0, offset: 0 },
			{ parentDiameter: 25.4, angle: 45, clockPosition: 120, offset: 0 },
			{ parentDiameter: 25.4, angle: 45, clockPosition: 240, offset: 0 }
		]
	},
	{
		name: 'Custom Collector',
		description: 'Enter your own dimensions',
		cutDiameter: 28.6,
		wallThickness: 0.9,
		parents: [
			{ parentDiameter: 25.4, angle: 60, clockPosition: 0, offset: 0 },
			{ parentDiameter: 25.4, angle: 60, clockPosition: 180, offset: 0 }
		]
	}
];

export interface SquarePreset {
	name: string;
	description: string;
	cutDiameter: number;
	parentSide: number;
	wallThickness: number;
	cornerRadius: number;
	angle: number;
	offset?: number;
	twist?: number;
}

export const SQUARE_PRESETS: SquarePreset[] = [
	{
		name: 'Tube → Square (sharp)',
		description: 'Round tube to sharp-cornered square tube',
		cutDiameter: 25.4,
		parentSide: 38,
		wallThickness: 0.9,
		cornerRadius: 0,
		angle: 90
	},
	{
		name: 'Tube → Square (radiused)',
		description: 'Round tube to square tube with rounded corners',
		cutDiameter: 25.4,
		parentSide: 38,
		wallThickness: 0.9,
		cornerRadius: 6,
		angle: 90
	},
	{
		name: 'Tube → Square (45°)',
		description: 'Angled round tube to square tube',
		cutDiameter: 25.4,
		parentSide: 38,
		wallThickness: 0.9,
		cornerRadius: 4,
		angle: 45
	},
	{
		name: 'Custom Square',
		description: 'Enter your own dimensions',
		cutDiameter: 25.4,
		parentSide: 38,
		wallThickness: 0.9,
		cornerRadius: 4,
		angle: 90
	}
];

export interface SlotPreset {
	name: string;
	description: string;
	tubeDiameter: number;
	wallThickness: number;
	plateThickness: number;
	slotDepth: number;
}

export const SLOT_PRESETS: SlotPreset[] = [
	{
		name: 'Chainstay Dropout Slot',
		description: 'Slot for dropout plate in chainstay',
		tubeDiameter: 22.2,
		wallThickness: 0.8,
		plateThickness: 3.0,
		slotDepth: 15
	},
	{
		name: 'Seatstay Dropout Slot',
		description: 'Slot for dropout plate in seatstay',
		tubeDiameter: 14,
		wallThickness: 0.8,
		plateThickness: 3.0,
		slotDepth: 12
	},
	{
		name: 'Custom Slot',
		description: 'Enter your own dimensions',
		tubeDiameter: 25.4,
		wallThickness: 0.9,
		plateThickness: 3.0,
		slotDepth: 15
	}
];
