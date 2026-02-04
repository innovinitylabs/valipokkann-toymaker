# Three.js Jumping Jack Toy

An interactive 3D jumping jack toy built with Three.js featuring mouse-controlled stick attachment and realistic wooden toy physics.

## Features

- **GLTF Model Loading**: Loads `ToyMaker_anim1.glb` with proper scaling and centering
- **Mouse Interaction**:
  - Move mouse to tilt the entire toy subtly (tactile feel)
  - Stick follows mouse cursor in screen space
  - Click to apply random rotation around stick's Z-axis
- **Jumping Jack Animation**: Mathematical sine-based animation driven by stick rotation
- **Hierarchy Preservation**: No mesh deformation - only Object3D transforms
- **Neutral Lighting**: Hemisphere + Directional lighting for realistic shadows

## File Structure

```
├── index.html          # Main HTML page with canvas and instructions
├── app.js             # Three.js application logic
├── package.json       # Project metadata
└── ToyMaker_anim1.glb # GLTF model (not included - add to root)
```

## Setup

1. Place your `ToyMaker_anim1.glb` file in the project root
2. Start a local web server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser

## Controls

- **Mouse Movement**: Tilts the entire toy for realistic physics feel
- **Mouse Click**: Applies random spin to the stick
- **Press 'H'**: Log toy hierarchy to console (debug)

## Technical Implementation

### Hierarchy-Based Animation
The animation system works entirely through Object3D rotations, preserving mesh geometry:

1. **Stick Rotation**: Drives the entire motion cycle around local Z-axis
2. **Arm Motion**: Sine wave rotation with ±30° limits, mirrored left/right
3. **Leg Motion**: Opposite phase to arms (±25° limits) for jumping jack effect
4. **No Deformation**: Only `Object3D.rotation` and `Object3D.position` used

### Mouse Interaction
- Mouse position maps to subtle toy X/Y rotations
- Stick visually follows cursor in screen space
- Click triggers smooth random Z-axis rotation

### Lighting
- HemisphereLight: Sky/ground ambient illumination
- DirectionalLight: Key light with shadows for depth

## Requirements Met

✅ GLTF loading with GLTFLoader
✅ Neutral lighting (Hemisphere + Directional)
✅ Model centering and scaling without mesh alteration
✅ Mouse-controlled stick attachment in screen space
✅ Subtle toy rotation based on mouse position
✅ Random stick Z-axis rotation on click
✅ Sine-based jumping jack limb motion
✅ No mesh deformation (only Object3D transforms)
✅ Perspective camera with downward angle
✅ Responsive canvas handling