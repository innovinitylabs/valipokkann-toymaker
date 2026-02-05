// Scene setup - bright and clean for toy display
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // Pure white background for maximum brightness

// Camera setup - slight downward angle
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);

// Renderer setup - optimized for bright, vibrant toy display
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: true,
    alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Enhanced shadow mapping
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Tone mapping for vibrant colors and proper exposure
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; // Slightly brightened

// Color space for accurate colors
renderer.outputEncoding = THREE.sRGBEncoding;

// Professional lighting setup for toy display
// Ambient light for overall brightness
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Key light - main directional light from top-left
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 50;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);

// Fill light - softer light from bottom-right to reduce harsh shadows
const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4);
fillLight.position.set(-3, 2, -3);
scene.add(fillLight);

// Rim light - subtle highlight from behind for definition
const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
rimLight.position.set(0, 5, -8);
scene.add(rimLight);

// Optional: Point light for extra sparkle on metallic parts
const pointLight = new THREE.PointLight(0xffffff, 0.5, 20);
pointLight.position.set(0, 10, 0);
scene.add(pointLight);

// GLTF Loader for r128
const loader = new THREE.GLTFLoader();

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy (used for spinning)
let leftArmRef, rightArmRef; // Arm objects for jumping jack motion
let leftLegRef, rightLegRef; // Leg objects for jumping jack motion

// Limb states for spring-damper dynamics
const limbs = {
  leftArm:  { angle: 0, velocity: 0, mass: 1.0 },
  rightArm: { angle: 0, velocity: 0, mass: 1.15 },
  leftLeg:  { angle: 0, velocity: 0, mass: 1.3 },
  rightLeg: { angle: 0, velocity: 0, mass: 1.1 }
};

// Spin energy tracking
let spinEnergy = 0;

// Load the GLTF model
loader.load(
    'ToyMaker_anim1.glb',
    (gltf) => {
        toyGroupRef = gltf.scene;

        // DO NOT recenter, reposition, or rescale the GLTF scene
        // Keep the GLTF EXACTLY as authored

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

        // DO NOT DETACH LIMBS - hierarchy is correct
        // Limbs must remain children of body_main

        // Set up limb states for spring-damper dynamics
        setupLimbStates();

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

// STEP 1: Analyze GLTF hierarchy and identify physics parts
function findToyParts(object) {
    console.log('=== GLTF ANALYSIS START ===');
    console.log('🔍 Looking for these actual GLTF names: "body_main", "Constraint_left_hand", "Constraint_right_hand", "Constraint_left_leg", "Constraint_right_leg"');

    let objectCount = 0;
    const meshObjects = [];
    const foundParts = {
        body: false,
        leftArm: false,
        rightArm: false,
        leftLeg: false,
        rightLeg: false
    };

    // First pass: list ALL objects
    console.log('📋 ALL OBJECTS IN GLTF:');
    object.traverse((child) => {
        objectCount++;
        const displayName = child.name || 'unnamed';
        console.log(`   ${objectCount}. "${displayName}" (${child.type})`);

        // Collect all mesh objects for fallback assignment
        if (child.isMesh) {
            meshObjects.push(child);
        }
    });

    console.log(`\n📊 SUMMARY: ${objectCount} total objects, ${meshObjects.length} meshes`);
    console.log('🔍 Starting detailed matching...\n');

    // Second pass: detailed matching
    object.traverse((child) => {
        const originalName = child.name || '';

        // STEP 2: Check for EXACT matches with expected names
        if (originalName === 'body_main') {
            foundParts.body = true;
            console.log('✅ FOUND: body_main (body)');
            console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);

        } else if (originalName === 'left_arm') {
            leftArmRef = child;
            foundParts.leftArm = true;
            console.log('✅ FOUND: left_arm → leftArmRef (ACTUAL MESH GROUP)');
            console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);

        } else if (originalName === 'right_arm') {
            rightArmRef = child;
            foundParts.rightArm = true;
            console.log('✅ FOUND: right_arm → rightArmRef (ACTUAL MESH GROUP)');
            console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);

        } else if (originalName === 'left_leg') {
            leftLegRef = child;
            foundParts.leftLeg = true;
            console.log('✅ FOUND: left_leg → leftLegRef (ACTUAL MESH GROUP)');
            console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);

        } else if (originalName === 'right_leg') {
            rightLegRef = child;
            foundParts.rightLeg = true;
            console.log('✅ FOUND: right_leg → rightLegRef (ACTUAL MESH GROUP)');
            console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);

        } else if (originalName === 'Constraint_left_hand' || originalName === 'Constraint_right_hand' ||
                   originalName === 'Constraint_left_leg' || originalName === 'Constraint_right_leg') {
            console.log(`⚠️  FOUND CONSTRAINT OBJECT: "${originalName}" - ignoring for physics`);
            console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);

        } else {
            // Log objects that don't match our expected names but might be relevant
            if (originalName && (originalName.includes('hand') || originalName.includes('arm') ||
                originalName.includes('leg') || originalName.includes('body'))) {
                console.log(`⚠️  POTENTIAL MATCH: "${originalName}" (${child.type}) - not in expected list`);
                console.log(`   Position: ${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)}`);
            }

            // Also log all mesh objects to understand the visual structure
            if (child.isMesh && originalName) {
                console.log(`🎨 MESH: "${originalName}" at (${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)})`);
            }
        }
    });

    // STEP 3: Final validation and summary
    console.log('\n📋 FINAL DETECTION RESULTS:');
    console.log(`   Body: ${foundParts.body ? '✅ FOUND' : '❌ MISSING'} (body_main)`);
    console.log(`   Left Arm: ${foundParts.leftArm ? '✅ FOUND' : '❌ MISSING'} (Constraint_left_hand)`);
    console.log(`   Right Arm: ${foundParts.rightArm ? '✅ FOUND' : '❌ MISSING'} (Constraint_right_hand)`);
    console.log(`   Left Leg: ${foundParts.leftLeg ? '✅ FOUND' : '❌ MISSING'} (Constraint_left_leg)`);
    console.log(`   Right Leg: ${foundParts.rightLeg ? '✅ FOUND' : '❌ MISSING'} (Constraint_right_leg)`);

    // STEP 4: Determine if we have enough parts for physics
    const requiredParts = [foundParts.leftArm, foundParts.rightArm, foundParts.leftLeg, foundParts.rightLeg];
    const foundCount = requiredParts.filter(Boolean).length;

    if (foundCount >= 2) { // At least arms or legs for some physics
        console.log(`\n🎯 PHYSICS READY: Found ${foundCount}/4 parts - proceeding with physics setup`);
    } else {
        console.log(`\n⚠️  PHYSICS LIMITED: Only found ${foundCount}/4 parts - some features disabled`);
    }

}

// Setup limb state initialization
function setupLimbStates() {
    try {
        console.log('🔧 Setting up spring-damper limb states...');

        // Reset all limb states to neutral positions
        for (const limbName in limbs) {
            limbs[limbName].angle = 0;
            limbs[limbName].velocity = 0;
        }

        // Initialize spin energy
        spinEnergy = 0;

        console.log('✅ Spring-damper limb states initialized');
        console.log('🎮 Hybrid jumping jack ready - move mouse to tilt, click to spin!');

    } catch (error) {
        console.error('❌ Error setting up limb states:', error);
        console.error('Limb state setup failed');
    }
}

// Mouse interaction variables
const mouse = new THREE.Vector2();
let mousePressed = false;

// Toy tilt variables - mouse controls tilt
const maxToyTiltX = Math.PI / 6; // ±30 degrees X tilt (front/back)
const maxToyTiltY = Math.PI / 8; // ±22.5 degrees Y tilt (left/right)

// Animation timing for spring-damper dynamics
let lastTime = 0;

// Zoom constants
const ZOOM_SPEED = 0.1; // How fast to zoom
const MIN_ZOOM_DISTANCE = 5; // Closest zoom distance
const MAX_ZOOM_DISTANCE = 25; // Farthest zoom distance
let currentZoomDistance = 12; // Current distance from camera to target (matches initial position)

// Toy references are initialized when GLTF loads
console.log('Three.js hybrid jumping jack toy initialized');

// Mouse event handlers
function onMouseMove(event) {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    updateToyInteraction();
}

function onMouseDown(event) {
    try {
        mousePressed = true;

        // CLICK BEHAVIOR: Add energy to spin system
        spinEnergy += (Math.random() - 0.5) * 2.5;

        console.log('🎪 Spin energy added to jumping jack!');
    } catch (error) {
        console.error('❌ Mouse down error:', error);
    }
}

function onMouseUp(event) {
    mousePressed = false;
}

function onMouseWheel(event) {
    event.preventDefault();

    // Determine zoom direction (negative deltaY = zoom in, positive = zoom out)
    const zoomDelta = event.deltaY > 0 ? 1 : -1;

    // Update zoom distance with limits
    currentZoomDistance += zoomDelta * ZOOM_SPEED;
    currentZoomDistance = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, currentZoomDistance));

    // Update camera position while maintaining look-at target
    // Camera is positioned relative to (0,0,0) target
    const cameraHeight = 8; // Keep the same height for good viewing angle
    camera.position.set(0, cameraHeight, currentZoomDistance);
    camera.lookAt(0, 0, 0);
}

// Update toy interaction based on mouse position
function updateToyInteraction() {
    try {
        // MOUSE TILT: Respect Blender local space axes
        if (toyGroupRef) {
            // Mouse X: left/right tilt → rotate around Blender Y axis (0, 1, 0)
            const leftRightAngle = mouse.x * maxToyTiltY;

            // Mouse Y: front/back tilt → rotate around Blender X axis (1, 0, 0)
            const frontBackAngle = mouse.y * maxToyTiltX;

            // Create tilt quaternions
            const yRotation = new THREE.Quaternion(); // Left/right tilt around Y-axis
            yRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), leftRightAngle);

            const xRotation = new THREE.Quaternion(); // Front/back tilt around X-axis
            xRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), frontBackAngle);

            // Combine tilt rotations: tiltQuaternion = yRotation × xRotation
            const tiltQuaternion = yRotation.multiply(xRotation);

            // Apply tilt directly to toy group
            toyGroupRef.quaternion.copy(tiltQuaternion);
        }
    } catch (error) {
        console.error('❌ Toy interaction error:', error);
    }
}

// Mouse interaction drives kinematic body directly - no animation timers needed

// Animation loop with spring-damper dynamics
function animate(currentTime = 0) {
    try {
        requestAnimationFrame(animate);

        // Calculate delta time for smooth physics
        const delta = Math.min((currentTime - lastTime) / 1000, 1/30); // Cap at 30 FPS minimum
        lastTime = currentTime;

        // Update spin energy decay
        spinEnergy *= 0.96;

        // SPRING-DAMPER DYNAMICS PER LIMB
        for (const [limbName, limb] of Object.entries(limbs)) {
            // Target is clamped spin energy (0 to 1)
            const target = THREE.MathUtils.clamp(Math.abs(spinEnergy), 0, 1);

            // Spring force: (target - current) * stiffness / mass
            const stiffness = 14 / limb.mass;
            const damping = 4.5 * limb.mass;

            const force = (target - limb.angle) * stiffness;
            limb.velocity += force * delta;
            limb.velocity *= Math.exp(-damping * delta);

            limb.angle += limb.velocity * delta;
        }

        // MICRO-NOISE: Add subtle randomness every second
        if (Math.floor(currentTime / 1000) !== Math.floor(lastTime / 1000)) {
            limbs.leftArm.velocity  += (Math.random() - 0.5) * 0.02;
            limbs.rightLeg.velocity += (Math.random() - 0.5) * 0.02;
        }

        // APPLY ROTATIONS TO MESHES
        const MAX_ARM_ANGLE = Math.PI / 3; // ±60 degrees
        const MAX_LEG_ANGLE = Math.PI / 4; // ±45 degrees

        if (leftArmRef) {
            leftArmRef.rotation.z = limbs.leftArm.angle * MAX_ARM_ANGLE;
        }
        if (rightArmRef) {
            rightArmRef.rotation.z = -limbs.rightArm.angle * MAX_ARM_ANGLE;
        }
        if (leftLegRef) {
            leftLegRef.rotation.z = -limbs.leftLeg.angle * MAX_LEG_ANGLE;
        }
        if (rightLegRef) {
            rightLegRef.rotation.z = limbs.rightLeg.angle * MAX_LEG_ANGLE;
        }

        renderer.render(scene, camera);
    } catch (error) {
        console.error('❌ Animation loop error:', error.message || error);
        console.error('Stack:', error.stack);
        // Continue the animation loop despite errors
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
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
window.addEventListener('wheel', onMouseWheel, { passive: false });

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