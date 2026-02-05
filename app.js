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
        // Ammo.js should now be loaded from local file
        console.log('🔄 Initializing Ammo.js physics...');

        if (typeof Ammo === 'function') {
            console.log('✅ Ammo.js function found, initializing...');
            Ammo().then((AmmoLib) => {
                Ammo = AmmoLib;
                console.log('✅ Ammo.js library loaded, calling initPhysics()...');
                initPhysics();
                console.log('🎮 Ammo.js physics initialized and ready!');
                console.log('💡 Try clicking to apply torque and watch the physics simulation!');
            }).catch((error) => {
                console.error('❌ Failed to initialize Ammo.js:', error);
            });
        } else {
            console.error('❌ Ammo.js not available as function:', typeof Ammo);
            console.error('💡 Local ammo.js file may not have loaded correctly');
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

// Find mesh within a GLTF collection group
function findMeshInCollection(collection) {
    let foundMesh = null;
    collection.traverse((child) => {
        if (child.isMesh && !foundMesh) {
            foundMesh = child;
        }
    });
    return foundMesh;
}

// Find toy parts in GLTF hierarchy for physics setup
function findToyParts(object) {
    console.log('=== GLTF ANALYSIS FOR AMMO.JS PHYSICS ===');
    console.log('🔍 Looking for Blender collections that became Groups in GLTF...');

    let objectCount = 0;
    const foundParts = {
        body: false,
        leftArm: false,
        rightArm: false,
        leftLeg: false,
        rightLeg: false
    };

    // First pass: list ALL objects to understand structure
    console.log('📋 ALL GLTF OBJECTS:');
    object.traverse((child) => {
        objectCount++;
        const displayName = child.name || 'unnamed';
        console.log(`   ${objectCount}. "${displayName}" (${child.type})`);

        // Check if this is one of our target collections
        const name = child.name || '';

        if (name === 'body_main' && child.type === 'Group') {
            const mesh = findMeshInCollection(child);
            if (mesh) {
                bodyMainRef = mesh; // Use the mesh, not the group
                foundParts.body = true;
                console.log('✅ FOUND: body_main collection → mesh for torso');
            } else {
                console.log('⚠️  FOUND: body_main collection but no mesh inside');
            }

        } else if (name === 'left_arm' && child.type === 'Group') {
            const mesh = findMeshInCollection(child);
            if (mesh) {
                leftArmRef = mesh;
                foundParts.leftArm = true;
                console.log('✅ FOUND: left_arm collection → mesh');
            } else {
                console.log('⚠️  FOUND: left_arm collection but no mesh inside');
            }

        } else if (name === 'right_arm' && child.type === 'Group') {
            const mesh = findMeshInCollection(child);
            if (mesh) {
                rightArmRef = mesh;
                foundParts.rightArm = true;
                console.log('✅ FOUND: right_arm collection → mesh');
            } else {
                console.log('⚠️  FOUND: right_arm collection but no mesh inside');
            }

        } else if (name === 'left_leg' && child.type === 'Group') {
            const mesh = findMeshInCollection(child);
            if (mesh) {
                leftLegRef = mesh;
                foundParts.leftLeg = true;
                console.log('✅ FOUND: left_leg collection → mesh');
            } else {
                console.log('⚠️  FOUND: left_leg collection but no mesh inside');
            }

        } else if (name === 'right_leg' && child.type === 'Group') {
            const mesh = findMeshInCollection(child);
            if (mesh) {
                rightLegRef = mesh;
                foundParts.rightLeg = true;
                console.log('✅ FOUND: right_leg collection → mesh');
            } else {
                console.log('⚠️  FOUND: right_leg collection but no mesh inside');
            }
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
        console.error('❌ CRITICAL: body_main collection or mesh not found - physics cannot initialize');
        console.error('💡 Check that your Blender collections are named exactly: body_main, left_arm, right_arm, left_leg, right_leg');
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

        console.log('✅ Physics world created with gravity:', physicsWorld.getGravity().y());

        // Create rigid bodies for toy parts
        createRigidBodies();

        // Create hinge constraints
        createConstraints();

        console.log('🎮 Ammo.js jumping jack ready - move mouse to tilt, click to apply torque!');
        console.log('💡 Try clicking to apply torque and watch the physics simulation!');

    } catch (error) {
        console.error('❌ Error initializing physics:', error);
        console.error('Stack:', error.stack);
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

        // --- FIX 1: Force bodies to stay active ---
        body.setActivationState(4); // DISABLE_DEACTIVATION
        body.setSleepingThresholds(0, 0);

        // Add to physics world
        physicsWorld.addRigidBody(body);

        console.log(`✅ Created rigid body: ${name} (mass: ${mass}, size: ${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);

        return body;
    }

    // Create torso/body (heavier, main body)
    rigidBodies.torso = createBoxBody(bodyMainRef, 'torso', 2.0);
    // --- FIX 2: Add angular + linear damping to torso ---
    if (rigidBodies.torso) {
        rigidBodies.torso.setDamping(0.05, 0.01);
        rigidBodies.torso.setActivationState(4);
        rigidBodies.torso.setSleepingThresholds(0, 0);
    }

    // === KINEMATIC STICK (ANCHOR BODY) ===
    const stickShape = new Ammo.btCylinderShape(
      new Ammo.btVector3(0.05, 2.0, 0.05)
    );

    const stickTransform = new Ammo.btTransform();
    stickTransform.setIdentity();
    stickTransform.setOrigin(new Ammo.btVector3(0, 0, 0));

    const stickMotionState = new Ammo.btDefaultMotionState(stickTransform);

    const stickInfo = new Ammo.btRigidBodyConstructionInfo(
      0, // mass = 0 → kinematic
      stickMotionState,
      stickShape,
      new Ammo.btVector3(0, 0, 0)
    );

    rigidBodies.stick = new Ammo.btRigidBody(stickInfo);
    rigidBodies.stick.setCollisionFlags(
      rigidBodies.stick.getCollisionFlags() | 2 // CF_KINEMATIC_OBJECT
    );
    rigidBodies.stick.setActivationState(4); // DISABLE_DEACTIVATION

    physicsWorld.addRigidBody(rigidBodies.stick);

    // Create limbs (lighter)
    rigidBodies.leftArm = createBoxBody(leftArmRef, 'leftArm', 0.5);
    if (rigidBodies.leftArm) {
        rigidBodies.leftArm.setDamping(0.05, 0.05);
        rigidBodies.leftArm.setActivationState(4);
        rigidBodies.leftArm.setSleepingThresholds(0, 0);
    }
    rigidBodies.rightArm = createBoxBody(rightArmRef, 'rightArm', 0.5);
    if (rigidBodies.rightArm) {
        rigidBodies.rightArm.setDamping(0.05, 0.05);
        rigidBodies.rightArm.setActivationState(4);
        rigidBodies.rightArm.setSleepingThresholds(0, 0);
    }
    rigidBodies.leftLeg = createBoxBody(leftLegRef, 'leftLeg', 0.7);
    if (rigidBodies.leftLeg) {
        rigidBodies.leftLeg.setDamping(0.05, 0.05);
        rigidBodies.leftLeg.setActivationState(4);
        rigidBodies.leftLeg.setSleepingThresholds(0, 0);
    }
    rigidBodies.rightLeg = createBoxBody(rightLegRef, 'rightLeg', 0.7);
    if (rigidBodies.rightLeg) {
        rigidBodies.rightLeg.setDamping(0.05, 0.05);
        rigidBodies.rightLeg.setActivationState(4);
        rigidBodies.rightLeg.setSleepingThresholds(0, 0);
    }

    console.log('✅ All rigid bodies created');
    console.log('📊 Rigid bodies summary:', {
        stick: !!rigidBodies.stick,
        torso: !!rigidBodies.torso,
        leftArm: !!rigidBodies.leftArm,
        rightArm: !!rigidBodies.rightArm,
        leftLeg: !!rigidBodies.leftLeg,
        rightLeg: !!rigidBodies.rightLeg
    });
}

// Create hinge constraints between body and limbs
function createConstraints() {
    console.log('🔗 Creating hinge constraints...');

    if (!rigidBodies.torso) {
        console.error('❌ Cannot create constraints - torso body missing');
        return;
    }

    // === STICK → TORSO HINGE (MAIN ROTATION AXIS) ===
    const stickTorsoHinge = new Ammo.btHingeConstraint(
      rigidBodies.stick,
      rigidBodies.torso,
      new Ammo.btVector3(0, 0, 0),   // pivot on stick
      new Ammo.btVector3(0, 0, 0),   // pivot on torso
      new Ammo.btVector3(0, 1, 0),   // Y-axis spin
      new Ammo.btVector3(0, 1, 0),
      true
    );

    physicsWorld.addConstraint(stickTorsoHinge, false);

    // --- FIX 3: CORRECT HINGE PIVOT SPACE ---
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

        // Get transforms
        const torsoTransform = new Ammo.btTransform();
        rigidBodies.torso.getMotionState().getWorldTransform(torsoTransform);
        const torsoOrigin = torsoTransform.getOrigin();

        const limbTransform = new Ammo.btTransform();
        body.getMotionState().getWorldTransform(limbTransform);
        const limbOrigin = limbTransform.getOrigin();

        // Joint position from Blender origin of limb mesh (in world space)
        const jointWorld = new THREE.Vector3();
        mesh.getWorldPosition(jointWorld);

        // Convert world joint → local torso
        const pivotA = new Ammo.btVector3(
            jointWorld.x - torsoOrigin.x(),
            jointWorld.y - torsoOrigin.y(),
            jointWorld.z - torsoOrigin.z()
        );

        // Convert world joint → local limb
        const pivotB = new Ammo.btVector3(
            jointWorld.x - limbOrigin.x(),
            jointWorld.y - limbOrigin.y(),
            jointWorld.z - limbOrigin.z()
        );

        // Hinge axis (Z-axis for side-to-side swing)
        const axisA = new Ammo.btVector3(0, 0, 1);
        const axisB = new Ammo.btVector3(0, 0, 1);

        // Create hinge constraint
        const hinge = new Ammo.btHingeConstraint(
            rigidBodies.torso,
            body,
            pivotA,
            pivotB,
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

        // Apply torque to stick, not torso
        if (rigidBodies.stick) {
            rigidBodies.stick.activate(true);

            const dir = Math.random() > 0.5 ? 1 : -1;
            const torqueValue = dir * TORQUE_IMPULSE;
            rigidBodies.stick.applyTorqueImpulse(
                new Ammo.btVector3(0, torqueValue, 0)
            );
            console.log(`🔄 Applied torque: ${torqueValue.toFixed(1)} to stick`);
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
        // Tilt via stick torque
        if (rigidBodies.stick) {
          rigidBodies.stick.activate(true);

          const tx = mouse.y * TILT_FORCE;
          const tz = -mouse.x * TILT_FORCE;

          rigidBodies.stick.applyTorqueImpulse(
            new Ammo.btVector3(tx, 0, tz)
          );
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