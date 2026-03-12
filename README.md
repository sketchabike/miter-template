# Tube Miter Template Generator

Free, open-source tube miter (cope) template generator for bicycle framebuilders.

**Live at [miter.sketchabike.com](https://miter.sketchabike.com)**

## Features

- Round, elliptical, and tapered tube joints
- Offset joints (seatstays) and twist (fork blades)
- 12 bicycle-specific presets (DT→HT, TT→ST, SS→ST, etc.)
- 1:1 scale PDF export — tiles across multiple pages with alignment marks
- SVG export
- Scale verification bar on every page
- Metric and imperial units
- Works entirely in the browser — no server, no account

## Development

```bash
npm install
npm run dev        # dev server on :5175
npm test           # run tests
npm run build      # static build
```

## How it works

The core algorithm walks the cut tube circumference at 1440 angular steps, projecting each point onto the parent tube surface to generate the cope curve. The resulting template wraps around the tube to mark the cut line.

For elliptical tubes, a precomputed circumference lookup table (100K points) with binary search maps angle→arc-length distance.

## License

MIT — free forever.

Part of [SketchABike](https://sketchabike.com), tools for framebuilders.
