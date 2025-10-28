# Adjustment Tracking System

## Overview

The adjustment tracking system logs every manual alignment change you make to the Gaussian splat, allowing you to:
1. See exactly what adjustments were made during a session
2. Export those adjustments as code to update the default spawn parameters
3. Fine-tune the splat position iteratively

## How It Works

When you load the splat, an `AdjustmentTracker` is automatically initialized with the starting parameters. Every time you use keyboard controls to adjust the splat, the tracker logs:
- What changed (scale, rotation, position, etc.)
- Before and after values
- Delta (amount of change)
- Total change from initial values

## Keyboard Controls (All Tracked)

### Scale
- `+` or `=` - Increase scale by 1.1x
- `-` - Decrease scale by 0.9x

### Rotation
- `[` - Rotate left (yaw -5°)
- `]` - Rotate right (yaw +5°)
- `Q` - Tilt up (pitch +5°)
- `A` - Tilt down (pitch -5°)
- `W` - Roll right (+5°)
- `S` - Roll left (-5°)

### Position
- `Arrow Up` - Move north (+1m)
- `Arrow Down` - Move south (-1m)
- `Arrow Left` - Move west (-1m)
- `Arrow Right` - Move east (+1m)
- `Page Up` - Move up (+10m)
- `Page Down` - Move down (-10m)

### Tracking Controls
- `P` - Print adjustment summary to console
- `X` - Export code snippet to apply adjustments as defaults

## Workflow

### Step 1: Adjust the Splat Manually
Use the keyboard controls above to align your splat to the correct position. The tracker logs every adjustment automatically.

Example console output:
```
📊 Scale: 1.000 → 1.100 (factor: 1.100, total from initial: 1.100x)
📊 Yaw: 0.0° → 5.0° (Δ: 5.0°, total: 5.0°)
📊 Position: [E:0.000, N:0.000, U:0.000] → [E:0.000, N:1.000, U:0.000]
   Total from initial: E:0.000, N:1.000, U:0.000
```

### Step 2: Review Your Adjustments
Press `P` to print a summary:
```
═══════════════════════════════════════════════════
📊 ADJUSTMENT SUMMARY
═══════════════════════════════════════════════════

📍 INITIAL PARAMETERS:
  Scale:    1.000
  Yaw:      0.00°
  Pitch:    0.00°
  Roll:     0.00°
  Position: E:0.000, N:0.000, U:0.000

📍 CURRENT PARAMETERS:
  Scale:    2.500
  Yaw:      15.00°
  Pitch:    0.00°
  Roll:     0.00°
  Position: E:5.230, N:-12.400, U:25.00

🔄 TOTAL CHANGES FROM INITIAL:
  Scale:    2.500x
  Yaw:      15.00°
  Pitch:    0.00°
  Roll:     0.00°
  Position: E:5.230, N:-12.400, U:25.00

📝 Total adjustments made: 23
═══════════════════════════════════════════════════
```

### Step 3: Export Code Snippet
Press `X` to generate code you can paste into `main.ts`:
```typescript
// Updated default parameters for Burbank splat (from manual adjustments):
burbankLayer = new GaussianSplatLayer(
  "./splats/myscene/Burbank1Clean.ply",
  {
    lon: -118.28507075,
    lat: 34.18991967,
    height: 327 + 25.00 // Adjusted height
  },
  {
    x: 0.0000, // pitch
    y: 0.2618,   // yaw (15°)
    z: 0.0000   // roll
  },
  2.500 // scale
);

// Or apply directly to alignment controller:
alignmentController.setEnuParams({
  scale: 2.500,
  yawRad: 0.2618,
  pitchRad: 0.0000,
  rollRad: 0.0000,
  tEast: 5.230,
  tNorth: -12.400,
  tUp: 25.000
});
```

### Step 4: Update main.ts
1. Copy the generated code from the console (open with F12)
2. Update the `loadBurbankScene()` function in `src/main.ts`
3. Replace the old GaussianSplatLayer initialization with the new values
4. Save and reload - your splat will now spawn in the correct position!

## Tips

- **Make small adjustments**: The tracker helps you understand cumulative changes
- **Use P frequently**: Check your progress as you align
- **Test before applying**: Make sure the splat looks correct before updating defaults
- **Keep notes**: Save the console output with your adjustments for reference

## ENU Coordinate System

The tracker uses East-North-Up (ENU) coordinates:
- **East (tEast)**: Positive = eastward movement
- **North (tNorth)**: Positive = northward movement
- **Up (tUp)**: Positive = upward (away from Earth center)

Rotations are applied in order: Yaw → Pitch → Roll

## Advanced: Programmatic Access

You can access the tracker programmatically:

```typescript
// Get current parameters
const params = alignmentController.tracker.getCurrentParams();

// Get summary as string
const summary = alignmentController.tracker.getSummary();

// Export as JSON
const json = alignmentController.tracker.exportJSON();

// Reset tracker with new baseline
alignmentController.tracker.reset(newParams);
```
