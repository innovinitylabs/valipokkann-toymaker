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

        // Check if we found any parts before setting up physics
        const hasAnyParts = leftArmRef || rightArmRef || leftLegRef || rightLegRef;
        if (hasAnyParts) {
            console.log('🔧 Found GLTF parts, setting up physics...');
            setupPhysicsBodies();
        } else {
            console.log('⚠️ No GLTF parts found, skipping physics setup');
            console.log('💡 Check that your GLTF file has objects named: body main, left_arm, right_arm, left_leg, right_leg');
        }

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

// Analyze GLTF hierarchy and identify physics parts
function findToyParts(object) {
    console.log('GLTF loaded successfully! Analyzing hierarchy for physics...');
    console.log('🔍 Looking for these exact names: "body main", "left_arm", "right_arm", "left_leg", "right_leg"');

    let objectCount = 0;
    const meshObjects = [];
    const foundParts = {
        body: false,
        leftArm: false,
        rightArm: false,
        leftLeg: false,
        rightLeg: false
    };

    object.traverse((child) => {
        objectCount++;
        const displayName = child.name || 'unnamed';
        console.log(`📦 Object ${objectCount}: "${displayName}" - Type: ${child.type}`);

        // Collect all mesh objects for fallback assignment
        if (child.isMesh) {
            meshObjects.push(child);
            console.log(`   └─ Position: (${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
        }

        // Look for the specific names from the updated GLTF
        const name = (child.name || '').toLowerCase();
        const originalName = child.name || '';

        // Check for exact matches first (highest priority)
        if (originalName === 'body main') {
            foundParts.body = true;
            console.log('🎯 EXACT MATCH: Found "body main"!');
        } else if (originalName === 'left_arm') {
            leftArmRef = child;
            foundParts.leftArm = true;
            console.log('🎯 EXACT MATCH: Found "left_arm"!');
        } else if (originalName === 'right_arm') {
            rightArmRef = child;
            foundParts.rightArm = true;
            console.log('🎯 EXACT MATCH: Found "right_arm"!');
        } else if (originalName === 'left_leg') {
            leftLegRef = child;
            foundParts.leftLeg = true;
            console.log('🎯 EXACT MATCH: Found "left_leg"!');
        } else if (originalName === 'right_leg') {
            rightLegRef = child;
            foundParts.rightLeg = true;
            console.log('🎯 EXACT MATCH: Found "right_leg"!');
        }

        // Fallback: Look for common naming patterns (expanded patterns)
        else if (name.includes('body') || name.includes('torso') || name.includes('main') || name.includes('stick') || name.includes('handle')) {
            // This will be our fixed body (the stick/handle)
            console.log('🔍 Found body/torso (pattern):', child.name);
        } else if (name.includes('arm') && (name.includes('left') || name.includes('l_') || name.includes('_l') || name.includes('L'))) {
            leftArmRef = child;
            console.log('🔍 Found left arm (pattern):', child.name);
        } else if (name.includes('arm') && (name.includes('right') || name.includes('r_') || name.includes('_r') || name.includes('R'))) {
            rightArmRef = child;
            console.log('🔍 Found right arm (pattern):', child.name);
        } else if (name.includes('leg') && (name.includes('left') || name.includes('l_') || name.includes('_l') || name.includes('L'))) {
            leftLegRef = child;
            console.log('🔍 Found left leg (pattern):', child.name);
        } else if (name.includes('leg') && (name.includes('right') || name.includes('r_') || name.includes('_r') || name.includes('R'))) {
            rightLegRef = child;
            console.log('🔍 Found right leg (pattern):', child.name);
        }
    });

    // Fallback: Assign physics parts based on position and type if naming didn't work
    if (!leftArmRef || !rightArmRef || !leftLegRef || !rightLegRef) {
        console.log('🔍 Name-based detection incomplete, using position-based fallback...');

        // Sort mesh objects by their Y position (higher = arms, lower = legs)
        meshObjects.sort((a, b) => b.position.y - a.position.y);

        // Assign based on position (this is a heuristic)
        for (let i = 0; i < meshObjects.length && i < 4; i++) {
            const obj = meshObjects[i];
            if (!leftArmRef && obj.position.x < 0 && obj.position.y > 0) {
                leftArmRef = obj;
                console.log('🔄 Assigned left arm by position:', obj.name);
            } else if (!rightArmRef && obj.position.x > 0 && obj.position.y > 0) {
                rightArmRef = obj;
                console.log('🔄 Assigned right arm by position:', obj.name);
            } else if (!leftLegRef && obj.position.x < 0 && obj.position.y < 0) {
                leftLegRef = obj;
                console.log('🔄 Assigned left leg by position:', obj.name);
            } else if (!rightLegRef && obj.position.x > 0 && obj.position.y < 0) {
                rightLegRef = obj;
                console.log('🔄 Assigned right leg by position:', obj.name);
            }
        }
    }

    console.log(`✅ Total objects in GLTF: ${objectCount}, Meshes: ${meshObjects.length}`);
    console.log('📋 Detection Summary:', foundParts);
    console.log('⚙️ Setting up physics simulation...');
}

// Setup physics bodies and constraints for jumping jack motion
function setupPhysicsBodies() {
    try {
        console.log('🔧 Setting up physics bodies...');
        console.log('Available parts:', {
            leftArm: !!leftArmRef,
            rightArm: !!rightArmRef,
            leftLeg: !!leftLegRef,
            rightLeg: !!rightLegRef
        });

        // Create physics bodies for each part
        // Main body (stick/handle) - fixed in place
        bodyBody = new CANNON.Body({ mass: 0 }); // mass: 0 = static/immovable
        bodyBody.addShape(new CANNON.Box(new CANNON.Vec3(0.05, 1, 0.05)));
        bodyBody.position.set(0, 0, 0);
        world.addBody(bodyBody);

        // Only create physics bodies for parts that were found
        if (leftArmRef) {
            leftArmBody = new CANNON.Body({ mass: 0.1 });
            leftArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
            const scaledPos = leftArmRef.position.clone().multiplyScalar(toyGroupRef.scale.x);
            leftArmBody.position.copy(scaledPos);
            world.addBody(leftArmBody);
            console.log('✅ Created physics body for left arm');
        }

        if (rightArmRef) {
            rightArmBody = new CANNON.Body({ mass: 0.1 });
            rightArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
            const scaledPos = rightArmRef.position.clone().multiplyScalar(toyGroupRef.scale.x);
            rightArmBody.position.copy(scaledPos);
            world.addBody(rightArmBody);
            console.log('✅ Created physics body for right arm');
        }

        if (leftLegRef) {
            leftLegBody = new CANNON.Body({ mass: 0.15 });
            leftLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
            const scaledPos = leftLegRef.position.clone().multiplyScalar(toyGroupRef.scale.x);
            leftLegBody.position.copy(scaledPos);
            world.addBody(leftLegBody);
            console.log('✅ Created physics body for left leg');
        }

        if (rightLegRef) {
            rightLegBody = new CANNON.Body({ mass: 0.15 });
            rightLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
            const scaledPos = rightLegRef.position.clone().multiplyScalar(toyGroupRef.scale.x);
            rightLegBody.position.copy(scaledPos);
            world.addBody(rightLegBody);
            console.log('✅ Created physics body for right leg');
        }

        // Create hinge constraints for jumping jack motion (only for bodies that exist)
        console.log('🔗 Creating physics constraints...');

        // Arms - constrained to swing around Z axis at shoulder height
        if (leftArmBody) {
            leftArmConstraint = new CANNON.HingeConstraint(bodyBody, leftArmBody, {
                pivotA: new CANNON.Vec3(-0.05, 0.3, 0),
                pivotB: new CANNON.Vec3(0, -0.4, 0),
                axisA: new CANNON.Vec3(0, 0, 1),
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            world.addConstraint(leftArmConstraint);
            console.log('✅ Created left arm constraint');
        }

        if (rightArmBody) {
            rightArmConstraint = new CANNON.HingeConstraint(bodyBody, rightArmBody, {
                pivotA: new CANNON.Vec3(0.05, 0.3, 0),
                pivotB: new CANNON.Vec3(0, -0.4, 0),
                axisA: new CANNON.Vec3(0, 0, 1),
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            world.addConstraint(rightArmConstraint);
            console.log('✅ Created right arm constraint');
        }

        // Legs - constrained to swing around Z axis at hip height
        if (leftLegBody) {
            leftLegConstraint = new CANNON.HingeConstraint(bodyBody, leftLegBody, {
                pivotA: new CANNON.Vec3(-0.05, -0.1, 0),
                pivotB: new CANNON.Vec3(0, 0.5, 0),
                axisA: new CANNON.Vec3(0, 0, 1),
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            world.addConstraint(leftLegConstraint);
            console.log('✅ Created left leg constraint');
        }

        if (rightLegBody) {
            rightLegConstraint = new CANNON.HingeConstraint(bodyBody, rightLegBody, {
                pivotA: new CANNON.Vec3(0.05, -0.1, 0),
                pivotB: new CANNON.Vec3(0, 0.5, 0),
                axisA: new CANNON.Vec3(0, 0, 1),
                axisB: new CANNON.Vec3(0, 0, 1)
            });
            world.addConstraint(rightLegConstraint);
            console.log('✅ Created right leg constraint');
        }

        console.log('✅ Physics bodies and constraints created successfully');
        console.log('🎮 Physics jumping jack ready - click to spin!');

    } catch (error) {
        console.error('❌ Error setting up physics:', error);
        console.error('Falling back to basic interaction mode');

        // Fallback: simple direct rotation for basic interaction
        bodyBody = null; // Disable physics mode
        console.log('🔄 Basic rotation mode enabled - move mouse to tilt, click to spin');
    }
}

// Animation variables (removed - using direct spin animation instead)

// Mouse interaction variables
const mouse = new THREE.Vector2();
let mousePressed = false;

// Toy tilt variables (subtle rotations based on mouse position)
const maxToyTiltX = Math.PI / 6; // ±30 degrees X tilt
const maxToyTiltY = Math.PI / 8; // ±22.5 degrees Y tilt

// Animation constants for spin effect
const SPIN_DURATION = 2000; // 2 seconds for spin animation

// Physics world setup
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Earth gravity
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.3;

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

        // Physics mode: Apply physics-based spin to all rigid bodies that exist
        let hasPhysicsBodies = false;

        if (bodyBody) {
            const spinVelocity = (Math.random() - 0.5) * 10; // Random spin speed
            bodyBody.angularVelocity.set(0, spinVelocity, 0);
            hasPhysicsBodies = true;
        }

        if (leftArmBody) {
            const spinVelocity = (Math.random() - 0.5) * 10;
            leftArmBody.angularVelocity.set(0, spinVelocity, 0);
            hasPhysicsBodies = true;
        }

        if (rightArmBody) {
            const spinVelocity = (Math.random() - 0.5) * 10;
            rightArmBody.angularVelocity.set(0, spinVelocity, 0);
            hasPhysicsBodies = true;
        }

        if (leftLegBody) {
            const spinVelocity = (Math.random() - 0.5) * 10;
            leftLegBody.angularVelocity.set(0, spinVelocity, 0);
            hasPhysicsBodies = true;
        }

        if (rightLegBody) {
            const spinVelocity = (Math.random() - 0.5) * 10;
            rightLegBody.angularVelocity.set(0, spinVelocity, 0);
            hasPhysicsBodies = true;
        }

        if (hasPhysicsBodies) {
            console.log('🎪 Physics spin initiated - watch the jumping jack motion!');
        } else if (toyGroupRef) {
            // Fallback mode: Simple direct rotation
            const randomAngle = (Math.random() - 0.5) * Math.PI * 4;
            toyGroupRef.rotation.y = randomAngle;
            console.log('🔄 Basic spin applied');
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
        // Physics mode: Apply physics forces to bodies that exist
        if (bodyBody) {
            // Apply subtle physics forces based on mouse position for realistic tilting
            // Mouse X affects side-to-side tilting (torque around Z axis)
            const tiltForceZ = mouse.x * 2; // Side-to-side force

            // Mouse Y affects forward-backward tilting (torque around X axis)
            const tiltForceX = mouse.y * 2; // Forward-backward force

            // Apply combined torques
            bodyBody.torque.set(tiltForceX, 0, tiltForceZ);

            // Apply damping to prevent excessive spinning
            const damping = 0.95;
            bodyBody.angularVelocity.scale(damping, bodyBody.angularVelocity);
        } else if (toyGroupRef) {
            // Fallback mode: Simple direct tilting
            const toyRotationY = mouse.x * maxToyTiltY;
            const toyRotationX = mouse.y * maxToyTiltX;
            toyGroupRef.rotation.y = toyRotationY;
            toyGroupRef.rotation.x = toyRotationX;
        }
    } catch (error) {
        console.error('❌ Toy interaction error:', error);
    }
}

// Spin animation is handled directly in onMouseDown with requestAnimationFrame

// Animation loop
function animate() {
    try {
        requestAnimationFrame(animate);

        // Update physics simulation only if bodies exist
        if (world && bodyBody) {
            world.step(1/60); // 60 FPS physics

            // Sync Three.js meshes with physics bodies (only for bodies that exist)
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