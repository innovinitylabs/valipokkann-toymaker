// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Camera setup - slight downward angle
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting setup - neutral lighting
const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.6);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// GLTF Loader for r128
const loader = new THREE.GLTFLoader();

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy
let stickObjectRef; // The stick/pole object
let leftArmRef, rightArmRef; // Arm objects for jumping jack motion
let leftLegRef, rightLegRef; // Leg objects for jumping jack motion

// Load the GLTF model
loader.load(
    'ToyMaker_anim1.glb',
    (gltf) => {
        toyGroupRef = gltf.scene;

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(toyGroupRef);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Move to origin
        toyGroupRef.position.sub(center);

        // Scale to reasonable size (assuming original is 1 unit = 1 meter)
        const maxDimension = Math.max(size.x, size.y, size.z);
        const targetSize = 3; // Target size in scene units
        const scale = targetSize / maxDimension;
        toyGroupRef.scale.setScalar(scale);

        // Enable shadows
        toyGroupRef.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(toyGroupRef);

        // Find toy parts in the hierarchy - this will need to be adjusted based on actual GLTF structure
        findToyParts(toyGroupRef);

        console.log('GLTF loaded successfully');
        console.log('Toy hierarchy:', toyGroupRef);
    },
    (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
        console.error('Error loading GLTF:', error);
        console.error('Make sure ToyMaker_anim1.glb is in the same directory as index.html');
    }
);

// Find toy parts in the hierarchy
// The GLTF hierarchy is preserved - no deformation allowed
// Animation works by rotating Object3D nodes, not modifying mesh geometry
function findToyParts(object) {
    console.log('Analyzing GLTF hierarchy...');
    const allObjects = [];

    object.traverse((child) => {
        allObjects.push(child);
        console.log('Object found:', child.name, '- Type:', child.type, '- Position:', child.position);

        // Look for common naming patterns - adjust based on actual GLTF
        const name = child.name.toLowerCase();

        if (name.includes('stick') || name.includes('pole') || name.includes('handle')) {
            stickObjectRef = child;
            console.log('✅ Found stick:', child.name);
        } else if ((name.includes('arm_l') || name.includes('left_arm') || name.includes('arm_left') ||
                   name.includes('l_arm') || name.includes('arm.l')) && !name.includes('right')) {
            leftArmRef = child;
            console.log('✅ Found left arm:', child.name);
        } else if ((name.includes('arm_r') || name.includes('right_arm') || name.includes('arm_right') ||
                   name.includes('r_arm') || name.includes('arm.r')) && !name.includes('left')) {
            rightArmRef = child;
            console.log('✅ Found right arm:', child.name);
        } else if ((name.includes('leg_l') || name.includes('left_leg') || name.includes('leg_left') ||
                   name.includes('l_leg') || name.includes('leg.l')) && !name.includes('right')) {
            leftLegRef = child;
            console.log('✅ Found left leg:', child.name);
        } else if ((name.includes('leg_r') || name.includes('right_leg') || name.includes('leg_right') ||
                   name.includes('r_leg') || name.includes('leg.r')) && !name.includes('left')) {
            rightLegRef = child;
            console.log('✅ Found right leg:', child.name);
        }
    });

    // Fallback: try to identify by position/type if names don't match
    if (!stickObjectRef) {
        // Look for tall vertical objects (likely the stick)
        const verticalObjects = allObjects.filter(obj =>
            obj.type === 'Object3D' &&
            Math.abs(obj.position.y) > Math.abs(obj.position.x) &&
            Math.abs(obj.position.y) > Math.abs(obj.position.z)
        );
        if (verticalObjects.length > 0) {
            stickObjectRef = verticalObjects[0];
            console.log('🔍 Inferred stick by position:', stickObjectRef.name);
        }
    }

    console.log('🎯 Final toy parts found:', {
        stick: stickObjectRef?.name || 'NOT FOUND',
        leftArm: leftArmRef?.name || 'NOT FOUND',
        rightArm: rightArmRef?.name || 'NOT FOUND',
        leftLeg: leftLegRef?.name || 'NOT FOUND',
        rightLeg: rightLegRef?.name || 'NOT FOUND'
    });

    console.log('💡 Tip: Press H to see full hierarchy, then update findToyParts() with correct names');
}

// Animation variables
let stickRotationAngle = 0; // Current stick rotation angle around Z axis
let targetStickRotation = 0; // Target rotation for smooth transitions
let isAnimating = false; // Whether stick is currently animating
const animationSpeed = 0.08; // Speed of rotation animation (slightly faster)

// Mouse interaction variables
const mouse = new THREE.Vector2();
let mousePressed = false;

// Toy tilt variables (subtle rotations based on mouse position)
const maxToyTiltX = Math.PI / 6; // ±30 degrees X tilt
const maxToyTiltY = Math.PI / 8; // ±22.5 degrees Y tilt

// Jumping jack animation parameters
const ARM_ROTATION_LIMIT = Math.PI / 6; // ±30 degrees
const LEG_ROTATION_LIMIT = Math.PI / 7.2; // ±25 degrees
const ANIMATION_FREQUENCY = 0.03; // How fast the jumping jack motion cycles

// Toy references are already initialized above
console.log('Toy created successfully');
console.log('Toy hierarchy created with procedural jumping jack');

// Mouse event handlers
function onMouseMove(event) {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    updateToyInteraction();
}

function onMouseDown(event) {
    mousePressed = true;

    if (stickObjectRef) {
        // Apply random rotation around stick's local Z axis
        // This simulates the tactile feel of spinning a wooden jumping jack toy
        const randomAngle = (Math.random() - 0.5) * Math.PI * 4; // ±720° (2 full rotations)
        targetStickRotation += randomAngle;
        isAnimating = true;
    }
}

function onMouseUp(event) {
    mousePressed = false;
}

// Update toy interaction based on mouse position
function updateToyInteraction() {
    if (!toyGroupRef || !stickObjectRef) return;

    // Map mouse position to subtle toy rotations for tactile feel
    // Mouse X (-1 to 1) maps to toy Y rotation (side-to-side tilt)
    const toyRotationY = mouse.x * maxToyTiltY;

    // Mouse Y (-1 to 1) maps to toy X rotation (forward-backward tilt)
    // Top of screen (y = -1) = more tilted back, bottom (y = 1) = more upright
    const toyRotationX = mouse.y * maxToyTiltX;

    // Apply subtle rotations to entire toy for realistic physics feel
    toyGroupRef.rotation.y = toyRotationY;
    toyGroupRef.rotation.x = toyRotationX;

    // Move stick to follow mouse cursor in screen space
    // This creates the illusion that the bottom of the stick is attached to the cursor
    if (stickObjectRef) {
        // Get the stick's base position in world space (assuming it's the bottom)
        const stickBasePos = new THREE.Vector3(0, -1, 0); // Local position at bottom of stick
        stickObjectRef.localToWorld(stickBasePos);

        // Convert mouse position to world coordinates at the stick's base depth
        const mouseWorldPos = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        mouseWorldPos.unproject(camera);

        // Calculate the offset needed to move stick base to mouse position
        const offset = mouseWorldPos.clone().sub(stickBasePos);

        // Apply offset to stick position (smooth following)
        const lerpFactor = 0.15; // Smooth following factor
        stickObjectRef.position.lerp(stickObjectRef.position.clone().add(offset), lerpFactor);
    }
}

// Update jumping jack animation - driven by stick rotation
function updateJumpingJack() {
    if (!stickObjectRef) return;

    // Smooth rotation towards target (only when animating from click)
    if (isAnimating) {
        const rotationDiff = targetStickRotation - stickRotationAngle;
        stickRotationAngle += rotationDiff * animationSpeed;

        // Apply rotation to stick around its local Z axis
        stickObjectRef.rotation.z = stickRotationAngle;

        // Check if animation is complete (prevent floating point drift)
        if (Math.abs(rotationDiff) < 0.001) {
            stickRotationAngle = targetStickRotation; // Snap to exact value
            isAnimating = false;
        }
    }

    // HIERARCHY-BASED ANIMATION LOGIC:
    // ================================
    // The jumping jack motion is created entirely through Object3D.rotation
    // No mesh deformation, skinning, or morph targets are used
    //
    // Animation principle:
    // 1. Stick rotation (Z-axis) drives the entire motion cycle
    // 2. Sine waves create smooth in/out limb movement
    // 3. Arms and legs are mirrored for realistic toy motion
    // 4. Phase offset between arms and legs creates the "jumping jack" effect
    //
    // Visual result: As stick rotates, limbs move in coordinated patterns
    // that mimic a traditional wooden jumping jack toy

    const time = stickRotationAngle * ANIMATION_FREQUENCY;

    // Arms: Mirrored rotation around Z-axis (left/right symmetry)
    // When stick rotates clockwise, left arm extends outward, right arm folds inward
    const armAngle = Math.sin(time) * ARM_ROTATION_LIMIT;
    if (leftArmRef) {
        leftArmRef.rotation.z = Math.PI / 6 + armAngle; // Base pose + animation
    }
    if (rightArmRef) {
        rightArmRef.rotation.z = -Math.PI / 6 - armAngle; // Mirrored motion
    }

    // Legs: Opposite phase to arms (180° offset) for jumping jack motion
    // Creates the characteristic "spread legs, close arms" pattern
    const legAngle = Math.sin(time + Math.PI) * LEG_ROTATION_LIMIT;
    if (leftLegRef) {
        leftLegRef.rotation.z = -Math.PI / 8 + legAngle; // Opposite phase to arms
    }
    if (rightLegRef) {
        rightLegRef.rotation.z = Math.PI / 8 - legAngle; // Mirrored motion
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    updateJumpingJack();

    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Event listeners
window.addEventListener('resize', onWindowResize);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

// Start animation
animate();

// Debug helper - log hierarchy on key press
window.addEventListener('keydown', (event) => {
    if (event.key === 'h') {
        console.log('Toy hierarchy:');
        toyGroupRef.traverse((child) => {
            console.log(child.name || 'unnamed', child.type, child.position, child.rotation);
        });
    }
});