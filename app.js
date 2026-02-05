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

// Physics bodies and constraints
let bodyBody, leftArmBody, rightArmBody, leftLegBody, rightLegBody;
let leftArmConstraint, rightArmConstraint, leftLegConstraint, rightLegConstraint;
let physicsWarmupFrames;

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

        // Set up physics bodies and constraints
        setupPhysicsBodies();

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

// Setup physics bodies and constraints for jumping jack motion
function setupPhysicsBodies() {
    try {
        console.log('🔧 Setting up physics bodies...');

        // PHYSICAL MODEL: Stick + torso act as ONE KINEMATIC BODY
        // Arms and legs are DYNAMIC bodies affected by gravity
        // Connected using HINGE CONSTRAINTS with angular limits

        // STEP 1: DEFINE SINGLE PHYSICS ROOT FRAME
        // SPLIT BODY INTO TWO PHYSICS BODIES FOR PROPER JUMPING JACK MECHANICS

        // Position reference for both bodies
        const bodyWorldPos = new THREE.Vector3();
        const bodyWorldQuat = new THREE.Quaternion();
        toyGroupRef.getWorldPosition(bodyWorldPos);
        toyGroupRef.getWorldQuaternion(bodyWorldQuat);

        // STEP 1: CREATE STICK DRIVER BODY (KINEMATIC)
        stickBody = new CANNON.Body({
            type: CANNON.Body.KINEMATIC, // Directly controlled by mouse
            mass: 0
        });

        const stickShape = new CANNON.Box(new CANNON.Vec3(0.05, 1.4, 0.05));
        stickBody.addShape(stickShape);

        stickBody.position.set(bodyWorldPos.x, bodyWorldPos.y, bodyWorldPos.z);
        stickBody.quaternion.set(
            bodyWorldQuat.x,
            bodyWorldQuat.y,
            bodyWorldQuat.z,
            bodyWorldQuat.w
        );

        world.addBody(stickBody);
        console.log('✅ Created kinematic stick driver body');

        // STEP 2: CREATE TORSO BODY (DYNAMIC)
        torsoBody = new CANNON.Body({
            mass: 3.0 // HEAVY compared to limbs for inertia
        });

        // Central torso plank
        const torsoShape = new CANNON.Box(new CANNON.Vec3(0.35, 1.0, 0.2));
        torsoBody.addShape(torsoShape, new CANNON.Vec3(0, 0.3, 0));

        // Head / face block
        const headShape = new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.2));
        torsoBody.addShape(headShape, new CANNON.Vec3(0, 1.4, 0));

        // Shoulder collision blocker (prevents arms clipping through torso)
        const shoulderBlocker = new CANNON.Box(new CANNON.Vec3(0.5, 0.3, 0.3));
        torsoBody.addShape(shoulderBlocker, new CANNON.Vec3(0, 0.9, 0));

        torsoBody.position.set(bodyWorldPos.x, bodyWorldPos.y, bodyWorldPos.z);
        torsoBody.quaternion.set(
            bodyWorldQuat.x,
            bodyWorldQuat.y,
            bodyWorldQuat.z,
            bodyWorldQuat.w
        );

        torsoBody.angularDamping = 0.2; // Mechanical damping
        world.addBody(torsoBody);
        console.log('✅ Created dynamic torso body with inertia');

        // STEP 3: CONNECT STICK → TORSO
        const stickTorsoLock = new CANNON.LockConstraint(stickBody, torsoBody);
        stickTorsoLock.collideConnected = true; // TEMPORARILY ENABLE collision
        world.addConstraint(stickTorsoLock);
        console.log('✅ Connected stick driver to torso body');

        // For backwards compatibility, set bodyBody to torsoBody
        bodyBody = torsoBody;

        // STEP 2: CREATE LIMB BODIES AT CONSTRAINT MARKER POSITIONS
        // Use existing bodyWorldPos from kinematic body setup

        // Create dynamic bodies for arms at constraint marker positions
        const limbWorldPos = new THREE.Vector3();
        const limbWorldQuat = new THREE.Quaternion();

        if (leftArmRef) {
            leftArmRef.getWorldPosition(limbWorldPos);
            leftArmRef.getWorldQuaternion(limbWorldQuat);

            leftArmBody = new CANNON.Body({ mass: 0.8 }); // Meaningful mass for physics
            leftArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
            leftArmBody.position.set(limbWorldPos.x, limbWorldPos.y, limbWorldPos.z);
            leftArmBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            leftArmBody.angularDamping = 0.4;

            world.addBody(leftArmBody);
            console.log('✅ Created left arm body at constraint marker position');
        }

        if (rightArmRef) {
            rightArmRef.getWorldPosition(limbWorldPos);
            rightArmRef.getWorldQuaternion(limbWorldQuat);

            rightArmBody = new CANNON.Body({ mass: 0.8 }); // Meaningful mass for physics
            rightArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
            rightArmBody.position.set(limbWorldPos.x, limbWorldPos.y, limbWorldPos.z);
            rightArmBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            rightArmBody.angularDamping = 0.4;

            world.addBody(rightArmBody);
            console.log('✅ Created right arm body at constraint marker position');
        }

        // Create dynamic bodies for legs at constraint marker positions
        if (leftLegRef) {
            leftLegRef.getWorldPosition(limbWorldPos);
            leftLegRef.getWorldQuaternion(limbWorldQuat);

            leftLegBody = new CANNON.Body({ mass: 1.2 }); // Meaningful mass for physics
            leftLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
            leftLegBody.position.set(limbWorldPos.x, limbWorldPos.y, limbWorldPos.z);
            leftLegBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            leftLegBody.angularDamping = 0.4;

            world.addBody(leftLegBody);
            console.log('✅ Created left leg body at constraint marker position');
        }

        if (rightLegRef) {
            rightLegRef.getWorldPosition(limbWorldPos);
            rightLegRef.getWorldQuaternion(limbWorldQuat);

            rightLegBody = new CANNON.Body({ mass: 1.2 }); // Meaningful mass for physics
            rightLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
            rightLegBody.position.set(limbWorldPos.x, limbWorldPos.y, limbWorldPos.z);
            rightLegBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            rightLegBody.angularDamping = 0.4;

            world.addBody(rightLegBody);
            console.log('✅ Created right leg body at constraint marker position');
        }

        // STEP 3: COMPUTE HINGE PIVOTS FROM CONSTRAINT MARKERS
        console.log('🔗 Computing hinge pivots from constraint markers...');

        // Arms: hinge around X-axis for forward/backward swing
        if (leftArmBody) {
            // Use the constraint marker as the hinge location
            const jointWorld = new THREE.Vector3();
            leftArmRef.getWorldPosition(jointWorld);

            // Convert to TORSO BODY LOCAL coordinates (pivotA)
            const torsoWorldPos = torsoBody.position;
            const pivotA = new CANNON.Vec3(
                jointWorld.x - torsoWorldPos.x,
                jointWorld.y - torsoWorldPos.y,
                jointWorld.z - torsoWorldPos.z
            );

            // Limb local pivot is its origin (pivotB)
            const pivotB = new CANNON.Vec3(0, 0, 0);

            leftArmConstraint = new CANNON.HingeConstraint(torsoBody, leftArmBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(1, 0, 0),         // X-axis hinge (left/right axis)
                axisB: new CANNON.Vec3(1, 0, 0)
            });
            leftArmConstraint.collideConnected = true; // ENABLE collision with torso
            // Note: Cannon.js HingeConstraint angular limits not available via setLimits
            // Collision shapes prevent rotation into torso instead
            world.addConstraint(leftArmConstraint);
            console.log('✅ Created left arm hinge constraint with collision enabled');
        }

        if (rightArmBody) {
            // Use the constraint marker as the hinge location
            const jointWorld = new THREE.Vector3();
            rightArmRef.getWorldPosition(jointWorld);

            // Convert to TORSO BODY LOCAL coordinates (pivotA)
            const torsoWorldPos = torsoBody.position;
            const pivotA = new CANNON.Vec3(
                jointWorld.x - torsoWorldPos.x,
                jointWorld.y - torsoWorldPos.y,
                jointWorld.z - torsoWorldPos.z
            );

            // Limb local pivot is its origin (pivotB)
            const pivotB = new CANNON.Vec3(0, 0, 0);

            rightArmConstraint = new CANNON.HingeConstraint(torsoBody, rightArmBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(1, 0, 0),         // X-axis hinge (left/right axis)
                axisB: new CANNON.Vec3(1, 0, 0)
            });
            rightArmConstraint.collideConnected = true; // ENABLE collision with torso
            // Note: Cannon.js HingeConstraint angular limits not available via setLimits
            // Collision shapes prevent rotation into torso instead
            world.addConstraint(rightArmConstraint);
            console.log('✅ Created right arm hinge constraint with collision enabled');
        }

        // Legs: hinge around Z-axis for left/right swing
        if (leftLegBody) {
            // Use the constraint marker as the hinge location
            const jointWorld = new THREE.Vector3();
            leftLegRef.getWorldPosition(jointWorld);

            // Convert to TORSO BODY LOCAL coordinates (pivotA)
            const torsoWorldPos = torsoBody.position;
            const pivotA = new CANNON.Vec3(
                jointWorld.x - torsoWorldPos.x,
                jointWorld.y - torsoWorldPos.y,
                jointWorld.z - torsoWorldPos.z
            );

            // Limb local pivot is its origin (pivotB)
            const pivotB = new CANNON.Vec3(0, 0, 0);

            leftLegConstraint = new CANNON.HingeConstraint(torsoBody, leftLegBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(0, 0, 1),         // Z-axis hinge (forward/back axis)
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            leftLegConstraint.collideConnected = true; // ENABLE collision with torso
            world.addConstraint(leftLegConstraint);
            console.log('✅ Created left leg hinge constraint with collision enabled');
        }

        if (rightLegBody) {
            // Use the constraint marker as the hinge location
            const jointWorld = new THREE.Vector3();
            rightLegRef.getWorldPosition(jointWorld);

            // Convert to TORSO BODY LOCAL coordinates (pivotA)
            const torsoWorldPos = torsoBody.position;
            const pivotA = new CANNON.Vec3(
                jointWorld.x - torsoWorldPos.x,
                jointWorld.y - torsoWorldPos.y,
                jointWorld.z - torsoWorldPos.z
            );

            // Limb local pivot is its origin (pivotB)
            const pivotB = new CANNON.Vec3(0, 0, 0);

            rightLegConstraint = new CANNON.HingeConstraint(torsoBody, rightLegBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(0, 0, 1),         // Z-axis hinge (forward/back axis)
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            rightLegConstraint.collideConnected = true; // ENABLE collision with torso
            world.addConstraint(rightLegConstraint);
            console.log('✅ Created right leg hinge constraint with collision enabled');
        }

        // Hinges alone are now sufficient with proper hierarchy

        // FIX 2: FREEZE PHYSICS FOR 1 FRAME AFTER SETUP
        physicsWarmupFrames = 2;

        console.log('✅ Physics setup complete - jumping jack with mechanical linkages');
        console.log('🎮 Physics jumping jack ready - move mouse to tilt, click to spin!');

    } catch (error) {
        console.error('❌ Error setting up physics:', error);
        console.error('Physics setup failed - no fallback mode available');
    }
}

// Mouse interaction variables
const mouse = new THREE.Vector2();
let mousePressed = false;

// glTF runtime is Y-up. This is the ONLY vertical axis.
const VERTICAL_AXIS = new CANNON.Vec3(0, 1, 0);

// Toy tilt variables - mouse controls kinematic body tilting
const maxToyTiltX = Math.PI / 6; // ±30 degrees X tilt (front/back)
const maxToyTiltY = Math.PI / 8; // ±22.5 degrees Y tilt (left/right)

// Persistent rotation quaternions (glTF Y-up space)
let spinQuaternion = new CANNON.Quaternion(0, 0, 0, 1); // Identity quaternion for accumulated spin around vertical axis
let tiltQuaternion = new CANNON.Quaternion(0, 0, 0, 1); // Identity quaternion for tilt

// Physics world setup
const world = new CANNON.World();
world.gravity.set(0, -4.0, 0); // Reduced gravity for mechanical toy physics
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.3;

// Strengthen solver for rigid mechanical joints
world.solver.iterations = 40;
world.solver.tolerance = 0.001;

// Zoom constants
const ZOOM_SPEED = 0.1; // How fast to zoom
const MIN_ZOOM_DISTANCE = 5; // Closest zoom distance
const MAX_ZOOM_DISTANCE = 25; // Farthest zoom distance
let currentZoomDistance = 12; // Current distance from camera to target (matches initial position)

// Toy references are initialized when GLTF loads
console.log('Three.js jumping jack toy initialized');

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

        // CLICK BEHAVIOR: Spin the STICK DRIVER around its local vertical axis
        if (stickBody) {
            const randomAngle = (Math.random() - 0.5) * Math.PI * 4; // Random angle between -2π and +2π

            // Step 1: get stick's current orientation
            const q = stickBody.quaternion;

            // Step 2: compute local vertical axis in world space
            const worldSpinAxis = q.vmult(VERTICAL_AXIS);

            // Step 3: create spin quaternion around THAT axis
            const spinQuat = new CANNON.Quaternion();
            spinQuat.setFromAxisAngle(worldSpinAxis, randomAngle);

            // Step 4: apply spin WITHOUT destroying tilt
            spinQuaternion = spinQuat.mult(spinQuaternion);

            // Step 5: final orientation = spin × tilt (applied to stick)
            stickBody.quaternion = spinQuaternion.mult(tiltQuaternion);

            console.log('🎪 Spin applied to stick driver!');
        }
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
        if (bodyBody) {
            // Mouse X: left/right tilt → rotate around Blender Y axis (0, 1, 0)
            const leftRightAngle = mouse.x * maxToyTiltY;

            // Mouse Y: front/back tilt → rotate around Blender X axis (1, 0, 0)
            const frontBackAngle = mouse.y * maxToyTiltX;

            // Create tilt quaternions
            const yRotation = new CANNON.Quaternion(); // Left/right tilt around Y-axis
            yRotation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), leftRightAngle);

            const xRotation = new CANNON.Quaternion(); // Front/back tilt around X-axis
            xRotation.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), frontBackAngle);

            // Combine tilt rotations: tiltQuaternion = yRotation × xRotation
            tiltQuaternion = yRotation.mult(xRotation);

            // DRIVE STICK BODY WITH SMOOTH INTERPOLATION (torso follows via constraint)
            const targetQuat = spinQuaternion.mult(tiltQuaternion);

            // Linear quaternion interpolation for Cannon.js (no built-in slerp)
            const slerpFactor = 0.15;
            stickBody.quaternion.x = stickBody.quaternion.x * (1 - slerpFactor) + targetQuat.x * slerpFactor;
            stickBody.quaternion.y = stickBody.quaternion.y * (1 - slerpFactor) + targetQuat.y * slerpFactor;
            stickBody.quaternion.z = stickBody.quaternion.z * (1 - slerpFactor) + targetQuat.z * slerpFactor;
            stickBody.quaternion.w = stickBody.quaternion.w * (1 - slerpFactor) + targetQuat.w * slerpFactor;

            // Normalize to prevent drift
            const len = Math.sqrt(stickBody.quaternion.x**2 + stickBody.quaternion.y**2 + stickBody.quaternion.z**2 + stickBody.quaternion.w**2);
            if (len > 0) {
                stickBody.quaternion.x /= len;
                stickBody.quaternion.y /= len;
                stickBody.quaternion.z /= len;
                stickBody.quaternion.w /= len;
            }
        }
    } catch (error) {
        console.error('❌ Toy interaction error:', error);
    }
}

// Mouse interaction drives kinematic body directly - no animation timers needed

// Animation loop
function animate() {
    try {
        requestAnimationFrame(animate);

        // Update physics simulation - kinematic driver controls dynamic limbs
        if (world && bodyBody) {
            // FIX 2: FREEZE PHYSICS FOR WARMUP FRAMES
            if (physicsWarmupFrames > 0) {
                physicsWarmupFrames--;
                world.step(1/60, 0, 0); // no forces, no catch-up - let constraints settle
            } else {
                world.step(1/60); // 60 FPS physics
            }

            // SYNC RULE: Each animation frame copy Cannon body position + quaternion → matching Three.js object
            // Do NOT modify Three.js transforms directly - physics bodies drive everything

            // Sync visual body_main to follow the TORSO (with inertia)
            if (toyGroupRef && torsoBody) {
                toyGroupRef.position.copy(torsoBody.position);
                toyGroupRef.quaternion.copy(torsoBody.quaternion);
            }

            // Sync dynamic limbs (arms and legs follow physics)
            // CORRECT: Convert PHYSICS WORLD → VISUAL LOCAL space (position + rotation)
            if (leftArmRef && leftArmBody) {
                try {
                    // --- POSITION ---
                    const parentWorldMatrix = new THREE.Matrix4();
                    toyGroupRef.updateMatrixWorld(true);
                    parentWorldMatrix.copy(toyGroupRef.matrixWorld).invert();

                    const worldPos = new THREE.Vector3(
                        leftArmBody.position.x,
                        leftArmBody.position.y,
                        leftArmBody.position.z
                    );

                    leftArmRef.position.copy(
                        worldPos.applyMatrix4(parentWorldMatrix)
                    );

                    // --- ROTATION ---
                    const parentWorldQuat = new THREE.Quaternion();
                    toyGroupRef.getWorldQuaternion(parentWorldQuat);

                    const physicsQuat = new THREE.Quaternion(
                        leftArmBody.quaternion.x,
                        leftArmBody.quaternion.y,
                        leftArmBody.quaternion.z,
                        leftArmBody.quaternion.w
                    );

                    // localRotation = inverse(parent) × worldRotation
                    leftArmRef.quaternion.copy(
                        parentWorldQuat.invert().multiply(physicsQuat)
                    );
                } catch (e) {
                    console.warn('Failed to sync left arm:', e.message);
                }
            }

            if (rightArmRef && rightArmBody) {
                try {
                    // --- POSITION ---
                    const parentWorldMatrix = new THREE.Matrix4();
                    toyGroupRef.updateMatrixWorld(true);
                    parentWorldMatrix.copy(toyGroupRef.matrixWorld).invert();

                    const worldPos = new THREE.Vector3(
                        rightArmBody.position.x,
                        rightArmBody.position.y,
                        rightArmBody.position.z
                    );

                    rightArmRef.position.copy(
                        worldPos.applyMatrix4(parentWorldMatrix)
                    );

                    // --- ROTATION ---
                    const parentWorldQuat = new THREE.Quaternion();
                    toyGroupRef.getWorldQuaternion(parentWorldQuat);

                    const physicsQuat = new THREE.Quaternion(
                        rightArmBody.quaternion.x,
                        rightArmBody.quaternion.y,
                        rightArmBody.quaternion.z,
                        rightArmBody.quaternion.w
                    );

                    // localRotation = inverse(parent) × worldRotation
                    rightArmRef.quaternion.copy(
                        parentWorldQuat.invert().multiply(physicsQuat)
                    );
                } catch (e) {
                    console.warn('Failed to sync right arm:', e.message);
                }
            }

            if (leftLegRef && leftLegBody) {
                try {
                    // --- POSITION ---
                    const parentWorldMatrix = new THREE.Matrix4();
                    toyGroupRef.updateMatrixWorld(true);
                    parentWorldMatrix.copy(toyGroupRef.matrixWorld).invert();

                    const worldPos = new THREE.Vector3(
                        leftLegBody.position.x,
                        leftLegBody.position.y,
                        leftLegBody.position.z
                    );

                    leftLegRef.position.copy(
                        worldPos.applyMatrix4(parentWorldMatrix)
                    );

                    // --- ROTATION ---
                    const parentWorldQuat = new THREE.Quaternion();
                    toyGroupRef.getWorldQuaternion(parentWorldQuat);

                    const physicsQuat = new THREE.Quaternion(
                        leftLegBody.quaternion.x,
                        leftLegBody.quaternion.y,
                        leftLegBody.quaternion.z,
                        leftLegBody.quaternion.w
                    );

                    // localRotation = inverse(parent) × worldRotation
                    leftLegRef.quaternion.copy(
                        parentWorldQuat.invert().multiply(physicsQuat)
                    );
                } catch (e) {
                    console.warn('Failed to sync left leg:', e.message);
                }
            }

            if (rightLegRef && rightLegBody) {
                try {
                    // --- POSITION ---
                    const parentWorldMatrix = new THREE.Matrix4();
                    toyGroupRef.updateMatrixWorld(true);
                    parentWorldMatrix.copy(toyGroupRef.matrixWorld).invert();

                    const worldPos = new THREE.Vector3(
                        rightLegBody.position.x,
                        rightLegBody.position.y,
                        rightLegBody.position.z
                    );

                    rightLegRef.position.copy(
                        worldPos.applyMatrix4(parentWorldMatrix)
                    );

                    // --- ROTATION ---
                    const parentWorldQuat = new THREE.Quaternion();
                    toyGroupRef.getWorldQuaternion(parentWorldQuat);

                    const physicsQuat = new THREE.Quaternion(
                        rightLegBody.quaternion.x,
                        rightLegBody.quaternion.y,
                        rightLegBody.quaternion.z,
                        rightLegBody.quaternion.w
                    );

                    // localRotation = inverse(parent) × worldRotation
                    rightLegRef.quaternion.copy(
                        parentWorldQuat.invert().multiply(physicsQuat)
                    );
                } catch (e) {
                    console.warn('Failed to sync right leg:', e.message);
                }
            }
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