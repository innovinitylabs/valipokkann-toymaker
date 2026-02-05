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

        // STEP 1: DETACH LIMBS FROM GLTF HIERARCHY
        // Limbs must be world objects so physics can drive them without parent interference
        if (leftArmRef) scene.attach(leftArmRef);
        if (rightArmRef) scene.attach(rightArmRef);
        if (leftLegRef) scene.attach(leftLegRef);
        if (rightLegRef) scene.attach(rightLegRef);

        console.log('✅ Detached limbs from GLTF hierarchy for physics control');

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
        // Kinematic body represents the WHOLE TOY at origin
        bodyBody = new CANNON.Body({
            type: CANNON.Body.KINEMATIC, // Kinematic - directly controlled, not affected by forces
            mass: 0 // Mass doesn't matter for kinematic bodies
        });
        bodyBody.addShape(new CANNON.Box(new CANNON.Vec3(0.05, 1, 0.05)));

        // Body is ALWAYS at origin in physics space
        bodyBody.position.set(0, 0, 0);
        bodyBody.quaternion.set(0, 0, 0, 1);

        world.addBody(bodyBody);
        console.log('✅ Created kinematic body at physics origin');

        // STEP 2: CREATE LIMB BODIES RELATIVE TO BODY
        // All bodies share the same physics coordinate system

        // Get body world position (should be ~0,0,0 after centering)
        const bodyWorldPos = new THREE.Vector3();
        toyGroupRef.getWorldPosition(bodyWorldPos);

        // Create dynamic bodies for arms with meaningful masses
        if (leftArmRef) {
            const limbWorldPos = new THREE.Vector3();
            const limbWorldQuat = new THREE.Quaternion();

            leftArmRef.getWorldPosition(limbWorldPos);
            leftArmRef.getWorldQuaternion(limbWorldQuat);

            // Convert to body-local coordinates
            const localPos = limbWorldPos.clone().sub(bodyWorldPos);

            leftArmBody = new CANNON.Body({ mass: 0.8 }); // Meaningful mass for physics
            leftArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
            leftArmBody.position.set(localPos.x, localPos.y, localPos.z);
            leftArmBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            leftArmBody.angularDamping = 0.4;

            world.addBody(leftArmBody);
            console.log('✅ Created left arm body relative to physics root');
        }

        if (rightArmRef) {
            const limbWorldPos = new THREE.Vector3();
            const limbWorldQuat = new THREE.Quaternion();

            rightArmRef.getWorldPosition(limbWorldPos);
            rightArmRef.getWorldQuaternion(limbWorldQuat);

            // Convert to body-local coordinates
            const localPos = limbWorldPos.clone().sub(bodyWorldPos);

            rightArmBody = new CANNON.Body({ mass: 0.8 }); // Meaningful mass for physics
            rightArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
            rightArmBody.position.set(localPos.x, localPos.y, localPos.z);
            rightArmBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            rightArmBody.angularDamping = 0.4;

            world.addBody(rightArmBody);
            console.log('✅ Created right arm body relative to physics root');
        }

        // Create dynamic bodies for legs with meaningful masses
        if (leftLegRef) {
            const limbWorldPos = new THREE.Vector3();
            const limbWorldQuat = new THREE.Quaternion();

            leftLegRef.getWorldPosition(limbWorldPos);
            leftLegRef.getWorldQuaternion(limbWorldQuat);

            // Convert to body-local coordinates
            const localPos = limbWorldPos.clone().sub(bodyWorldPos);

            leftLegBody = new CANNON.Body({ mass: 1.2 }); // Meaningful mass for physics
            leftLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
            leftLegBody.position.set(localPos.x, localPos.y, localPos.z);
            leftLegBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            leftLegBody.angularDamping = 0.4;

            world.addBody(leftLegBody);
            console.log('✅ Created left leg body relative to physics root');
        }

        if (rightLegRef) {
            const limbWorldPos = new THREE.Vector3();
            const limbWorldQuat = new THREE.Quaternion();

            rightLegRef.getWorldPosition(limbWorldPos);
            rightLegRef.getWorldQuaternion(limbWorldQuat);

            // Convert to body-local coordinates
            const localPos = limbWorldPos.clone().sub(bodyWorldPos);

            rightLegBody = new CANNON.Body({ mass: 1.2 }); // Meaningful mass for physics
            rightLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
            rightLegBody.position.set(localPos.x, localPos.y, localPos.z);
            rightLegBody.quaternion.set(limbWorldQuat.x, limbWorldQuat.y, limbWorldQuat.z, limbWorldQuat.w);

            // Add damping for mechanical toy feel
            rightLegBody.angularDamping = 0.4;

            world.addBody(rightLegBody);
            console.log('✅ Created right leg body relative to physics root');
        }

        // STEP 3: COMPUTE HINGE PIVOTS FOR MECHANICAL TOY
        console.log('🔗 Computing hinge pivots for mechanical linkages...');

        // Arms: hinge around X-axis for forward/backward swing
        if (leftArmBody) {
            // Mechanical attachment: left arm connects at top of stick/handle
            const jointPos = new CANNON.Vec3(-0.15, 0.4, 0); // Mechanical left arm joint

            // pivotA: joint position in stick local space
            const pivotA = jointPos;

            // pivotB: attachment point in arm local space
            const pivotB = new CANNON.Vec3(0, 0, 0);

            leftArmConstraint = new CANNON.HingeConstraint(bodyBody, leftArmBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(1, 0, 0),         // X-axis hinge (left/right axis)
                axisB: new CANNON.Vec3(1, 0, 0)
            });
            leftArmConstraint.collideConnected = false; // Prevent self-collision
            world.addConstraint(leftArmConstraint);
            console.log('✅ Created left arm hinge constraint with mechanical pivots');
        }

        if (rightArmBody) {
            // Mechanical attachment: right arm connects at top of stick/handle
            const jointPos = new CANNON.Vec3(0.15, 0.4, 0); // Mechanical right arm joint

            // pivotA: joint position in stick local space
            const pivotA = jointPos;

            // pivotB: attachment point in arm local space
            const pivotB = new CANNON.Vec3(0, 0, 0);

            rightArmConstraint = new CANNON.HingeConstraint(bodyBody, rightArmBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(1, 0, 0),         // X-axis hinge (left/right axis)
                axisB: new CANNON.Vec3(1, 0, 0)
            });
            rightArmConstraint.collideConnected = false; // Prevent self-collision
            world.addConstraint(rightArmConstraint);
            console.log('✅ Created right arm hinge constraint with mechanical pivots');
        }

        // Legs: hinge around Z-axis for left/right swing
        if (leftLegBody) {
            // Mechanical attachment: left leg connects at bottom of stick/handle
            const jointPos = new CANNON.Vec3(-0.12, -0.4, 0); // Mechanical left leg joint

            // pivotA: joint position in stick local space
            const pivotA = jointPos;

            // pivotB: attachment point in leg local space
            const pivotB = new CANNON.Vec3(0, 0, 0);

            leftLegConstraint = new CANNON.HingeConstraint(bodyBody, leftLegBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(0, 0, 1),         // Z-axis hinge (forward/back axis)
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            leftLegConstraint.collideConnected = false; // Prevent self-collision
            world.addConstraint(leftLegConstraint);
            console.log('✅ Created left leg hinge constraint with mechanical pivots');
        }

        if (rightLegBody) {
            // Mechanical attachment: right leg connects at bottom of stick/handle
            const jointPos = new CANNON.Vec3(0.12, -0.4, 0); // Mechanical right leg joint

            // pivotA: joint position in stick local space
            const pivotA = jointPos;

            // pivotB: attachment point in leg local space
            const pivotB = new CANNON.Vec3(0, 0, 0);

            rightLegConstraint = new CANNON.HingeConstraint(bodyBody, rightLegBody, {
                pivotA: pivotA,
                pivotB: pivotB,
                axisA: new CANNON.Vec3(0, 0, 1),         // Z-axis hinge (forward/back axis)
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            rightLegConstraint.collideConnected = false; // Prevent self-collision
            world.addConstraint(rightLegConstraint);
            console.log('✅ Created right leg hinge constraint with mechanical pivots');
        }

        // Hinges alone are now sufficient with proper hierarchy

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

        // CLICK BEHAVIOR: Spin around CURRENT LOCAL VERTICAL AXIS of the kinematic body
        if (bodyBody) {
            const randomAngle = (Math.random() - 0.5) * Math.PI * 4; // Random angle between -2π and +2π

            // Step 1: get current orientation
            const q = bodyBody.quaternion;

            // Step 2: compute local vertical axis in world space
            const worldSpinAxis = q.vmult(VERTICAL_AXIS);

            // Step 3: create spin quaternion around THAT axis
            const spinQuat = new CANNON.Quaternion();
            spinQuat.setFromAxisAngle(worldSpinAxis, randomAngle);

            // Step 4: apply spin WITHOUT destroying tilt
            spinQuaternion = spinQuat.mult(spinQuaternion);

            // Step 5: final orientation = spin × tilt
            bodyBody.quaternion = spinQuaternion.mult(tiltQuaternion);

            console.log('🎪 Spin around body\'s current local vertical axis!');
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

            // DRIVE KINEMATIC BODY WITH SMOOTH INTERPOLATION (allows physics impulses)
            const targetQuat = spinQuaternion.mult(tiltQuaternion);

            // Linear quaternion interpolation for Cannon.js (no built-in slerp)
            const slerpFactor = 0.15;
            bodyBody.quaternion.x = bodyBody.quaternion.x * (1 - slerpFactor) + targetQuat.x * slerpFactor;
            bodyBody.quaternion.y = bodyBody.quaternion.y * (1 - slerpFactor) + targetQuat.y * slerpFactor;
            bodyBody.quaternion.z = bodyBody.quaternion.z * (1 - slerpFactor) + targetQuat.z * slerpFactor;
            bodyBody.quaternion.w = bodyBody.quaternion.w * (1 - slerpFactor) + targetQuat.w * slerpFactor;

            // Normalize to prevent drift
            const len = Math.sqrt(bodyBody.quaternion.x**2 + bodyBody.quaternion.y**2 + bodyBody.quaternion.z**2 + bodyBody.quaternion.w**2);
            if (len > 0) {
                bodyBody.quaternion.x /= len;
                bodyBody.quaternion.y /= len;
                bodyBody.quaternion.z /= len;
                bodyBody.quaternion.w /= len;
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
            world.step(1/60); // 60 FPS physics

            // SYNC RULE: Each animation frame copy Cannon body position + quaternion → matching Three.js object
            // Do NOT modify Three.js transforms directly - physics bodies drive everything

            // Sync kinematic driver (stick/torso) to Three.js group
            if (toyGroupRef) {
                toyGroupRef.position.copy(bodyBody.position);
                toyGroupRef.quaternion.copy(bodyBody.quaternion);
            }

            // Sync dynamic limbs (arms and legs follow physics)
            if (leftArmRef && leftArmBody) {
                leftArmRef.position.copy(leftArmBody.position);
                leftArmRef.quaternion.copy(leftArmBody.quaternion);
            }
            if (rightArmRef && rightArmBody) {
                rightArmRef.position.copy(rightArmBody.position);
                rightArmRef.quaternion.copy(rightArmBody.quaternion);
            }
            if (leftLegRef && leftLegBody) {
                leftLegRef.position.copy(leftLegBody.position);
                leftLegRef.quaternion.copy(leftLegBody.quaternion);
            }
            if (rightLegRef && rightLegBody) {
                rightLegRef.position.copy(rightLegBody.position);
                rightLegRef.quaternion.copy(rightLegBody.quaternion);
            }
        }

        renderer.render(scene, camera);
    } catch (error) {
        console.error('❌ Animation loop error:', error);
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