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

// Ammo.js physics world and rigid bodies
let Ammo;
let physicsWorld;
let rigidBodies = {};
let constraints = [];

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy
let bodyMainRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef;

// Load the GLTF model and initialize physics
loader.load(
    'ToyMaker_anim1.glb',
    (gltf) => {
        toyGroupRef = gltf.scene;

        // Enable shadows
        toyGroupRef.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(toyGroupRef);

        // Find toy parts in the hierarchy
        findToyParts(toyGroupRef);

        // Initialize physics after GLTF is loaded
        // Wait for Ammo.js to be available
        const initAmmoPhysics = () => {
            if (typeof Ammo === 'function') {
                Ammo().then((AmmoLib) => {
                    Ammo = AmmoLib;
                    initPhysics();
                    console.log('Ammo.js physics initialized');
                }).catch((error) => {
                    console.error('Failed to initialize Ammo.js:', error);
                });
            } else {
                // Retry after a short delay if Ammo isn't loaded yet
                setTimeout(initAmmoPhysics, 100);
            }
        };

        initAmmoPhysics();

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

// Find toy parts in GLTF hierarchy for physics setup
function findToyParts(object) {
    console.log('=== GLTF ANALYSIS FOR AMMO.JS PHYSICS ===');

    let objectCount = 0;
    const foundParts = {
        body: false,
        leftArm: false,
        rightArm: false,
        leftLeg: false,
        rightLeg: false
    };

    // Find the actual mesh objects we need for physics
    object.traverse((child) => {
        objectCount++;
        const name = child.name || '';

        if (name === 'body_main') {
            bodyMainRef = child;
            foundParts.body = true;
            console.log('✅ FOUND: body_main (torso)');
        } else if (name === 'left_arm') {
            leftArmRef = child;
            foundParts.leftArm = true;
            console.log('✅ FOUND: left_arm');
        } else if (name === 'right_arm') {
            rightArmRef = child;
            foundParts.rightArm = true;
            console.log('✅ FOUND: right_arm');
        } else if (name === 'left_leg') {
            leftLegRef = child;
            foundParts.leftLeg = true;
            console.log('✅ FOUND: left_leg');
        } else if (name === 'right_leg') {
            rightLegRef = child;
            foundParts.rightLeg = true;
            console.log('✅ FOUND: right_leg');
        }
    });

    console.log('\n📋 PHYSICS PARTS FOUND:');
    console.log(`   Body: ${foundParts.body ? '✅' : '❌'}`);
    console.log(`   Left Arm: ${foundParts.leftArm ? '✅' : '❌'}`);
    console.log(`   Right Arm: ${foundParts.rightArm ? '✅' : '❌'}`);
    console.log(`   Left Leg: ${foundParts.leftLeg ? '✅' : '❌'}`);
    console.log(`   Right Leg: ${foundParts.rightLeg ? '✅' : '❌'}`);

    const foundCount = Object.values(foundParts).filter(Boolean).length;
    console.log(`\n🎯 AMMO.JS READY: ${foundCount}/5 parts found`);

    if (!foundParts.body) {
        console.error('❌ CRITICAL: body_main not found - physics cannot initialize');
    }
}

// Initialize Ammo.js physics world and create rigid bodies
function initPhysics() {
    try {
        console.log('🔧 Initializing Ammo.js physics world...');

        // Create collision configuration and dispatcher
        const collisionConfig = new Ammo.btDefaultCollisionConfiguration();
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfig);

        // Create broadphase
        const broadphase = new Ammo.btDbvtBroadphase();

        // Create constraint solver
        const solver = new Ammo.btSequentialImpulseConstraintSolver();

        // Create physics world
        physicsWorld = new Ammo.btDiscreteDynamicsWorld(
            dispatcher,
            broadphase,
            solver,
            collisionConfig
        );

        // Set gravity (negative Y in Three.js = down)
        physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0));

        console.log('✅ Physics world created');

        // Create rigid bodies for toy parts
        createRigidBodies();

        // Create hinge constraints
        createConstraints();

        console.log('🎮 Ammo.js jumping jack ready - move mouse to tilt, click to apply torque!');

    } catch (error) {
        console.error('❌ Error initializing physics:', error);
    }
}

// Create rigid bodies for all toy parts
function createRigidBodies() {
    console.log('🏗️ Creating rigid bodies...');

    // Helper function to create a box shape rigid body
    function createBoxBody(meshRef, name, mass = 1.0) {
        if (!meshRef) {
            console.log(`⚠️ Skipping ${name} - mesh not found`);
            return null;
        }

        // Get world transform from Three.js mesh
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        meshRef.getWorldPosition(worldPos);
        meshRef.getWorldQuaternion(worldQuat);

        // Approximate box shape from mesh bounds
        const bbox = new THREE.Box3().setFromObject(meshRef);
        const size = bbox.getSize(new THREE.Vector3());
        const halfExtents = new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);

        // Create box shape
        const shape = new Ammo.btBoxShape(halfExtents);

        // Calculate local inertia
        const localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        // Create motion state
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(worldPos.x, worldPos.y, worldPos.z));
        transform.setRotation(new Ammo.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w));

        const motionState = new Ammo.btDefaultMotionState(transform);

        // Create rigid body info
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

        // Create rigid body
        const body = new Ammo.btRigidBody(rbInfo);

        // Add to physics world
        physicsWorld.addRigidBody(body);

        console.log(`✅ Created rigid body: ${name} (mass: ${mass}, size: ${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);

        return body;
    }

    // Create torso/body (heavier, main body)
    rigidBodies.torso = createBoxBody(bodyMainRef, 'torso', 2.0);

    // Create limbs (lighter)
    rigidBodies.leftArm = createBoxBody(leftArmRef, 'leftArm', 0.5);
    rigidBodies.rightArm = createBoxBody(rightArmRef, 'rightArm', 0.5);
    rigidBodies.leftLeg = createBoxBody(leftLegRef, 'leftLeg', 0.7);
    rigidBodies.rightLeg = createBoxBody(rightLegRef, 'rightLeg', 0.7);

    console.log('✅ All rigid bodies created');
}

// Create hinge constraints between body and limbs
function createConstraints() {
    console.log('🔗 Creating hinge constraints...');

    if (!rigidBodies.torso) {
        console.error('❌ Cannot create constraints - torso body missing');
        return;
    }

    // Helper function to get hinge pivot points (approximate joint locations)
    function getHingePivot(meshRef, axis = 'x') {
        if (!meshRef) return new THREE.Vector3(0, 0, 0);

        const bbox = new THREE.Box3().setFromObject(meshRef);
        const center = bbox.getCenter(new THREE.Vector3());

        // For arms: pivot at shoulder height, slightly forward/back
        // For legs: pivot at hip height
        if (meshRef.name.includes('arm')) {
            return new THREE.Vector3(center.x, center.y + 0.1, center.z);
        } else if (meshRef.name.includes('leg')) {
            return new THREE.Vector3(center.x, center.y - 0.1, center.z);
        }

        return center;
    }

    // Get torso center for reference
    const torsoBbox = new THREE.Box3().setFromObject(bodyMainRef);
    const torsoCenter = torsoBbox.getCenter(new THREE.Vector3());

    // Create hinges for each limb
    const limbs = [
        { name: 'leftArm', body: rigidBodies.leftArm, mesh: leftArmRef },
        { name: 'rightArm', body: rigidBodies.rightArm, mesh: rightArmRef },
        { name: 'leftLeg', body: rigidBodies.leftLeg, mesh: leftLegRef },
        { name: 'rightLeg', body: rigidBodies.rightLeg, mesh: rightLegRef }
    ];

    limbs.forEach(({ name, body, mesh }) => {
        if (!body || !mesh) {
            console.log(`⚠️ Skipping constraint for ${name} - body or mesh missing`);
            return;
        }

        // Get pivot points in world space
        const pivotA = getHingePivot(mesh); // Pivot on torso
        const pivotB = getHingePivot(mesh); // Pivot on limb

        // Hinge axis (Z-axis for side-to-side swing)
        const axisA = new Ammo.btVector3(0, 0, 1);
        const axisB = new Ammo.btVector3(0, 0, 1);

        // Create hinge constraint
        const hinge = new Ammo.btHingeConstraint(
            rigidBodies.torso,
            body,
            new Ammo.btVector3(pivotA.x, pivotA.y, pivotA.z),
            new Ammo.btVector3(pivotB.x, pivotB.y, pivotB.z),
            axisA,
            axisB,
            true // useReferenceFrameA
        );

        // Set hinge limits (prevent inversion)
        const maxAngle = Math.PI / 3; // ±60 degrees
        hinge.setLimit(-maxAngle, maxAngle);

        // Add constraint to physics world (disable collisions between connected bodies)
        physicsWorld.addConstraint(hinge, false);

        // Store constraint reference
        constraints.push(hinge);

        console.log(`✅ Created hinge constraint: ${name}`);
    });

    console.log('✅ All hinge constraints created');
}

// Mouse interaction variables
const mouse = new THREE.Vector2();
let mousePressed = false;

// Physics interaction constants
const TORQUE_IMPULSE = 8.0;   // click applies torque to torso
const TILT_FORCE = 5.0;       // mouse tilt applies force/torque

// Zoom constants
const ZOOM_SPEED = 0.1; // How fast to zoom
const MIN_ZOOM_DISTANCE = 5; // Closest zoom distance
const MAX_ZOOM_DISTANCE = 25; // Farthest zoom distance
let currentZoomDistance = 12; // Current distance from camera to target (matches initial position)

// Animation timing
let lastTime = 0;

// Toy references are initialized when GLTF loads
console.log('Three.js Ammo.js jumping jack toy initialized');

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

        // Apply real torque to torso body (around Y-axis for spin)
        if (rigidBodies.torso && physicsWorld) {
            const torqueDirection = Math.random() > 0.5 ? 1 : -1;
            const torque = new Ammo.btVector3(0, torqueDirection * TORQUE_IMPULSE, 0);
            rigidBodies.torso.applyTorque(torque);
            console.log(`🔄 Applied torque: ${torqueDirection * TORQUE_IMPULSE} to torso`);
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
        // PHYSICS-BASED TILT: Apply forces/torques instead of direct rotation
        if (rigidBodies.torso && physicsWorld) {
            // Mouse X: left/right tilt → torque around Y-axis
            const leftRightTorque = mouse.x * TILT_FORCE;

            // Mouse Y: front/back tilt → torque around X-axis
            const frontBackTorque = mouse.y * TILT_FORCE;

            // Apply torques to torso for realistic physics-based tilting
            const torque = new Ammo.btVector3(frontBackTorque, 0, -leftRightTorque);
            rigidBodies.torso.applyTorque(torque);
        }
    } catch (error) {
        console.error('❌ Toy interaction error:', error);
    }
}

// Mouse interaction drives kinematic body directly - no animation timers needed

// Animation loop with Ammo.js physics simulation
function animate(currentTime = 0) {
    try {
        requestAnimationFrame(animate);

        // Calculate delta time for physics simulation
        const delta = Math.min((currentTime - lastTime) / 1000, 1/60); // Cap at 60 FPS for physics
        lastTime = currentTime;

        // Step physics simulation
        if (physicsWorld) {
            physicsWorld.stepSimulation(delta, 10, 1/60); // Fixed time step for stability
        }

        // Sync physics transforms to Three.js meshes
        syncPhysicsToMeshes();

        renderer.render(scene, camera);
    } catch (error) {
        console.error('❌ Animation loop error:', error.message || error);
        console.error('Stack:', error.stack);
        // Continue the animation loop despite errors
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
}

// Sync Bullet physics transforms to Three.js meshes
function syncPhysicsToMeshes() {
    try {
        // Helper function to sync a single rigid body
        function syncBody(body, mesh) {
            if (!body || !mesh) return;

            // Get transform from physics body
            const transform = new Ammo.btTransform();
            body.getMotionState().getWorldTransform(transform);

            const origin = transform.getOrigin();
            const rotation = transform.getRotation();

            // Update Three.js mesh position and quaternion
            mesh.position.set(origin.x(), origin.y(), origin.z());
            mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
        }

        // Sync all rigid bodies to their meshes
        syncBody(rigidBodies.torso, bodyMainRef);
        syncBody(rigidBodies.leftArm, leftArmRef);
        syncBody(rigidBodies.rightArm, rightArmRef);
        syncBody(rigidBodies.leftLeg, leftLegRef);
        syncBody(rigidBodies.rightLeg, rightLegRef);

    } catch (error) {
        console.error('❌ Physics sync error:', error);
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