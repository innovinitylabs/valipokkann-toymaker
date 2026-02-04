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

// Analyze GLTF hierarchy and identify physics parts
function findToyParts(object) {
    console.log('GLTF loaded successfully! Analyzing hierarchy for physics...');

    let objectCount = 0;
    object.traverse((child) => {
        objectCount++;
        console.log(`Object ${objectCount}:`, child.name, '- Type:', child.type, '- Position:', child.position);

        // Look for common naming patterns for physics parts
        const name = child.name.toLowerCase();

        if (name.includes('body') || name.includes('torso') || name.includes('main')) {
            // This will be our fixed body (the stick/handle)
            console.log('🎯 Found body/torso:', child.name);
        } else if ((name.includes('arm_l') || name.includes('left_arm') || name.includes('l_arm')) && !name.includes('right')) {
            leftArmRef = child;
            console.log('🎯 Found left arm:', child.name);
        } else if ((name.includes('arm_r') || name.includes('right_arm') || name.includes('r_arm')) && !name.includes('left')) {
            rightArmRef = child;
            console.log('🎯 Found right arm:', child.name);
        } else if ((name.includes('leg_l') || name.includes('left_leg') || name.includes('l_leg')) && !name.includes('right')) {
            leftLegRef = child;
            console.log('🎯 Found left leg:', child.name);
        } else if ((name.includes('leg_r') || name.includes('right_leg') || name.includes('r_leg')) && !name.includes('left')) {
            rightLegRef = child;
            console.log('🎯 Found right leg:', child.name);
        }
    });

    console.log(`✅ Total objects in GLTF: ${objectCount}`);
    console.log('⚙️ Setting up physics simulation...');
}

// Setup physics bodies and constraints for jumping jack motion
function setupPhysicsBodies() {
    // Create physics bodies for each part
    // Main body (stick/handle) - fixed in place
    bodyBody = new CANNON.Body({ mass: 0 }); // mass: 0 = static/immovable
    bodyBody.addShape(new CANNON.Box(new CANNON.Vec3(0.05, 1, 0.05)));
    bodyBody.position.set(0, 0, 0);
    world.addBody(bodyBody);

    // Left arm - dynamic physics body
    leftArmBody = new CANNON.Body({ mass: 0.1 });
    leftArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
    if (leftArmRef) {
        leftArmBody.position.copy(leftArmRef.position);
    } else {
        leftArmBody.position.set(-0.3, 0.3, 0);
    }
    world.addBody(leftArmBody);

    // Right arm - dynamic physics body
    rightArmBody = new CANNON.Body({ mass: 0.1 });
    rightArmBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.4, 0.02)));
    if (rightArmRef) {
        rightArmBody.position.copy(rightArmRef.position);
    } else {
        rightArmBody.position.set(0.3, 0.3, 0);
    }
    world.addBody(rightArmBody);

    // Left leg - dynamic physics body
    leftLegBody = new CANNON.Body({ mass: 0.15 });
    leftLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
    if (leftLegRef) {
        leftLegBody.position.copy(leftLegRef.position);
    } else {
        leftLegBody.position.set(-0.15, -0.6, 0);
    }
    world.addBody(leftLegBody);

    // Right leg - dynamic physics body
    rightLegBody = new CANNON.Body({ mass: 0.15 });
    rightLegBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 0.03)));
    if (rightLegRef) {
        rightLegBody.position.copy(rightLegRef.position);
    } else {
        rightLegBody.position.set(0.15, -0.6, 0);
    }
    world.addBody(rightLegBody);

    // Create hinge constraints for jumping jack motion
    // Arms - constrained to swing around Z axis at shoulder height
    leftArmConstraint = new CANNON.HingeConstraint(bodyBody, leftArmBody, {
        pivotA: new CANNON.Vec3(-0.05, 0.3, 0),
        pivotB: new CANNON.Vec3(0, -0.4, 0),
        axisA: new CANNON.Vec3(0, 0, 1),
        axisB: new CANNON.Vec3(0, 0, 1)
    });
    world.addConstraint(leftArmConstraint);

    rightArmConstraint = new CANNON.HingeConstraint(bodyBody, rightArmBody, {
        pivotA: new CANNON.Vec3(0.05, 0.3, 0),
        pivotB: new CANNON.Vec3(0, -0.4, 0),
        axisA: new CANNON.Vec3(0, 0, 1),
        axisB: new CANNON.Vec3(0, 0, 1)
    });
    world.addConstraint(rightArmConstraint);

    // Legs - constrained to swing around Z axis at hip height
    leftLegConstraint = new CANNON.HingeConstraint(bodyBody, leftLegBody, {
        pivotA: new CANNON.Vec3(-0.05, -0.1, 0),
        pivotB: new CANNON.Vec3(0, 0.5, 0),
        axisA: new CANNON.Vec3(0, 0, 1),
        axisB: new CANNON.Vec3(0, 0, 1)
    });
    world.addConstraint(leftLegConstraint);

    rightLegConstraint = new CANNON.HingeConstraint(bodyBody, rightLegBody, {
        pivotA: new CANNON.Vec3(0.05, -0.1, 0),
        pivotB: new CANNON.Vec3(0, 0.5, 0),
        axisA: new CANNON.Vec3(0, 0, 1),
        axisB: new CANNON.Vec3(0, 0, 1)
    });
    world.addConstraint(rightLegConstraint);

    console.log('🎯 Physics bodies and constraints created');
    console.log('🎮 Physics jumping jack ready - click to spin!');
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
    mousePressed = true;

    // Apply physics-based spin to all rigid bodies
    if (bodyBody && leftArmBody && rightArmBody && leftLegBody && rightLegBody) {
        // Random angular velocity for spinning motion
        const spinVelocity = (Math.random() - 0.5) * 10; // Random spin speed

        // Apply angular velocity to all bodies for synchronized spinning
        bodyBody.angularVelocity.set(0, spinVelocity, 0);
        leftArmBody.angularVelocity.set(0, spinVelocity, 0);
        rightArmBody.angularVelocity.set(0, spinVelocity, 0);
        leftLegBody.angularVelocity.set(0, spinVelocity, 0);
        rightLegBody.angularVelocity.set(0, spinVelocity, 0);

        console.log('🎪 Physics spin initiated - watch the jumping jack motion!');
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
    if (!bodyBody) return;

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
}

// Spin animation is handled directly in onMouseDown with requestAnimationFrame

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update physics simulation
    world.step(1/60); // 60 FPS physics

    // Sync Three.js meshes with physics bodies
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