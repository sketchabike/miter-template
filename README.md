# Tube Miter Template Generator

Free, open-source tube miter (cope) template generator for bicycle framebuilders.

**Live at [miter.sketchabike.com](https://miter.sketchabike.com)**

## Features

**7 joint types:**
- **Tube → Tube** — round, elliptical, tapered, with offset and twist
- **Tube → Flat** — gussets, mounting tabs, flat plate connections
- **Tube → Square** — round tube to square/rectangular section with adjustable corner radius
- **Bridge / Brace** — double-ended template for stay bridges
- **Compound Angle** — seatstay with elevation + lateral splay (computes true 3D angle and twist)
- **Collector** — multiple parent tubes meeting one cut tube (Y-junctions, multi-tube nodes)
- **Tube Slot** — rectangular slot cutout for hooded dropouts and plate insertions

**Output:**
- 1:1 scale PDF export — tiles across multiple pages with alignment marks
- SVG export
- Scale verification bar on every page

**Other:**
- 25+ bicycle-specific presets across all joint types
- Metric and imperial units
- Input validation with clear error messages
- 128 tests
- Works entirely in the browser — no server, no account

## Development

```bash
npm install
npm run dev        # dev server on :5175
npm test           # run tests
npm run build      # static build
```

## How it works

The core algorithm walks the cut tube inner circumference at 1440 angular steps, projecting each point onto the parent surface to determine cut height, then maps back to the outside circumference. The resulting template wraps around the tube to mark the cut line.

The projection function varies by joint type: cylindrical surface for round tubes, flat plane for plates, `squareSurfaceDepth()` for square sections (flat face + corner radius arc transition), and minimum envelope across multiple surfaces for collectors.

For elliptical tubes, a precomputed circumference lookup table (100K points) with binary search maps angle→arc-length distance.

## License

MIT — free forever.

Part of [SketchABike](https://sketchabike.com), tools for framebuilders.
