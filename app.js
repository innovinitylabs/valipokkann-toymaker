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
let AmmoLib = null;
let physicsWorld;
let rigidBodies = {};
let constraints = {};

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy
let bodyMainRef;

// STEP 1: Load Ammo.js using CDN and initialize physics
function initializeAmmo() {
    console.log('🔍 Starting Ammo.js loading...');
    console.log('typeof Ammo:', typeof Ammo);
    console.log('window.Ammo:', !!window.Ammo);

    if (typeof Ammo === 'undefined') {
        console.error('❌ CRITICAL: Ammo global not found - script failed to load');
        console.error('💡 Check that ammo_browser.js is loading correctly');
        return; // This is now inside a function, so it's valid
    }

    Ammo().then((AmmoLibInstance) => {
        console.log('✅ Ammo.js loaded successfully');
        console.log('AmmoLib available:', !!AmmoLibInstance);
        // Store AmmoLib globally so all functions can access it
        AmmoLib = AmmoLibInstance;
        console.log('AmmoLib assigned, btVector3 available:', !!AmmoLib.btVector3);
        initPhysics();
        initScene();
        animate();
    }).catch((error) => {
        console.error('❌ Failed to load Ammo.js:', error);
    });
}

// Start the initialization
initializeAmmo();

// Initialize physics world (only creates world, bodies created after GLTF loads)
function initPhysics() {
    // ASSERT AMMO IS REAL
    if (!AmmoLib) {
        throw new Error("AmmoLib not initialized");
    }

    try {
        console.log('🔧 Initializing Ammo.js physics world...');

        // Create collision configuration and dispatcher
        const collisionConfig = new AmmoLib.btDefaultCollisionConfiguration();
        const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfig);

        // Create broadphase
        const broadphase = new AmmoLib.btDbvtBroadphase();

        // Create constraint solver (iterations configured in stepSimulation)
        const solver = new AmmoLib.btSequentialImpulseConstraintSolver();

        // Create physics world
        physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(
            dispatcher,
            broadphase,
            solver,
            collisionConfig
        );

        // Set gravity (negative Y in Three.js = down)
        physicsWorld.setGravity(new AmmoLib.btVector3(0, -9.8, 0));

        console.log('✅ Physics world created with gravity:', physicsWorld.getGravity().y());
        console.log('✅ Solver iterations configured');
        console.log('⏳ Waiting for GLTF to load before creating rigid bodies...');

    } catch (error) {
        console.error('❌ Error initializing physics world:', error);
        console.error('Stack:', error.stack);
        throw error;
    }
}

// Load GLTF model and setup scene
function initScene() {
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

            // Create physics bodies (only after GLTF loads and bodyMainRef is found)
            if (bodyMainRef && physicsWorld) {
                createRigidBodies();
                
                // Create constraints (only if bodies were created successfully)
                if (rigidBodies.anchor && rigidBodies.torso) {
                    createConstraints();
                    
                    // CREATE PHYSICS ↔ MESH MAP (MANDATORY)
                    physicsMeshMap = new Map();
                    physicsMeshMap.set(bodyMainRef, rigidBodies.torso);
                    
                    console.log('🎮 Motor-based jumping jack ready - move mouse to tilt, click to spin!');
                } else {
                    console.error('❌ Failed to create physics bodies - cannot create constraints');
                }
            } else {
                console.error('❌ Cannot create physics bodies - bodyMainRef or physicsWorld missing');
            }

            // Hide loading indicator
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.style.display = 'none';
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
}

// Find collection/object in GLTF hierarchy (Blender collections become regular Objects in GLTF)
function findCollectionInGLTF(object, collectionName) {
    let foundCollection = null;
    object.traverse((child) => {
        if (child.name === collectionName && !foundCollection) {
            foundCollection = child;
        }
    });
    return foundCollection;
}

// Find toy parts in GLTF hierarchy for physics setup
function findToyParts(object) {
    console.log('=== GLTF ANALYSIS FOR MOTOR-BASED JUMPING JACK ===');
    console.log('🔍 Looking for body_main collection for torso physics...');

    // Debug: show ALL objects first
    console.log('📋 ALL GLTF OBJECTS:');
    let count = 0;
    object.traverse((child) => {
        count++;
        console.log(`   ${count}. "${child.name}" (${child.type})`);
    });

    // Only need body_main for now - we'll add limbs later
    bodyMainRef = findCollectionInGLTF(object, 'body_main');

    if (bodyMainRef) {
        console.log('✅ FOUND: body_main collection → will use for torso physics');
        console.log('📍 Torso position:', bodyMainRef.position);
        console.log('📍 Torso rotation:', bodyMainRef.rotation);
        console.log('📍 Torso type:', bodyMainRef.type);
        console.log('📍 Torso children:', bodyMainRef.children.length);
    } else {
        console.error('❌ CRITICAL: body_main collection not found - cannot create torso physics');
        console.error('💡 Check that your Blender collection is named exactly: body_main');

        // Debug: show all available objects (not just Groups)
        console.log('🔍 Available objects in GLTF:');
        object.traverse((child) => {
            console.log(`   "${child.name}" (${child.type})`);
        });
    }
}

// Initialize Ammo.js physics world and create rigid bodies

// Create rigid bodies for anchor and torso (motor-based system)
function createRigidBodies() {
    console.log('🏗️ Creating motor-based rigid bodies...');

    if (!AmmoLib) {
        console.error('❌ Cannot create rigid bodies - AmmoLib not loaded');
        return;
    }

    if (!bodyMainRef) {
        console.error('❌ Cannot create rigid bodies - body_main group not found');
        return;
    }

    if (!physicsWorld) {
        console.error('❌ Cannot create rigid bodies - physicsWorld not initialized');
        return;
    }

    console.log('✅ bodyMainRef confirmed, proceeding with physics creation...');

    // STEP 3: CREATE STATIC ANCHOR BODY (follows cursor)
    {
        // Use btSphereShape for simple anchor
        const anchorShape = new AmmoLib.btSphereShape(0.1); // Small sphere

        // Start at origin
        const anchorTransform = new AmmoLib.btTransform();
        anchorTransform.setIdentity();
        anchorTransform.setOrigin(new AmmoLib.btVector3(0, 0, 0));

        const anchorMotionState = new AmmoLib.btDefaultMotionState(anchorTransform);

        // mass = 0 for static body
        const anchorInfo = new AmmoLib.btRigidBodyConstructionInfo(
            0, // mass = 0 (static)
            anchorMotionState,
            anchorShape,
            new AmmoLib.btVector3(0, 0, 0) // zero inertia for static
        );

        rigidBodies.anchor = new AmmoLib.btRigidBody(anchorInfo);
        rigidBodies.anchor.setCollisionFlags(
            rigidBodies.anchor.getCollisionFlags() | 2 // CF_KINEMATIC_OBJECT
        );
        rigidBodies.anchor.setActivationState(4); // DISABLE_DEACTIVATION

        physicsWorld.addRigidBody(rigidBodies.anchor);
        console.log('✅ Created static anchor body (kinematic, follows cursor)');
    }

    // STEP 4: CREATE DYNAMIC TORSO BODY
    {
        // Get world transform from Three.js group
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        bodyMainRef.getWorldPosition(worldPos);
        bodyMainRef.getWorldQuaternion(worldQuat);

        // Approximate box shape from group bounds
        const bbox = new THREE.Box3().setFromObject(bodyMainRef);
        const size = bbox.getSize(new THREE.Vector3());
        const halfExtents = new AmmoLib.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);

        // Create box shape
        const torsoShape = new AmmoLib.btBoxShape(halfExtents);

        // Calculate local inertia (mass = 2.0)
        const mass = 2.0;
        const localInertia = new AmmoLib.btVector3(0, 0, 0);
        torsoShape.calculateLocalInertia(mass, localInertia);

        // Create motion state
        const transform = new AmmoLib.btTransform();
        transform.setIdentity();
        transform.setOrigin(new AmmoLib.btVector3(worldPos.x, worldPos.y, worldPos.z));
        transform.setRotation(new AmmoLib.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w));

        const motionState = new AmmoLib.btDefaultMotionState(transform);

        // Create rigid body info
        const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, torsoShape, localInertia);

        // Create rigid body
        rigidBodies.torso = new AmmoLib.btRigidBody(rbInfo);

        // Set angular damping ~0.2
        rigidBodies.torso.setDamping(0.1, 0.2); // linear, angular damping
        rigidBodies.torso.setActivationState(4); // DISABLE_DEACTIVATION
        rigidBodies.torso.setSleepingThresholds(0, 0);

        // Add to physics world
        physicsWorld.addRigidBody(rigidBodies.torso);

        console.log(`✅ Created dynamic torso body (mass: ${mass}, angular damping: 0.2, size: ${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
    }

    console.log('📊 Rigid bodies summary:', {
        anchor: !!rigidBodies.anchor,
        torso: !!rigidBodies.torso
    });
}

// Create hinge constraint with motor between anchor and torso
function createConstraints() {
    console.log('🔗 Creating motor-based hinge constraint...');

    if (!AmmoLib) {
        console.error('❌ Cannot create constraints - AmmoLib not loaded');
        return;
    }

    if (!physicsWorld) {
        console.error('❌ Cannot create constraints - physicsWorld not initialized');
        return;
    }

    if (!rigidBodies.anchor || !rigidBodies.torso) {
        console.error('❌ Cannot create constraints - anchor or torso body missing');
        return;
    }

    // STEP 5: ANCHOR ↔ TORSO HINGE WITH MOTOR
    // pivotA = anchor origin (0, 0, 0)
    // pivotB = bottom of torso
    // axis = vertical (Y)

    // Get torso bottom position (local to torso)
    const torsoTransform = new AmmoLib.btTransform();
    rigidBodies.torso.getMotionState().getWorldTransform(torsoTransform);
    const torsoOrigin = torsoTransform.getOrigin();

    // Calculate pivot on torso (bottom center, local coordinates)
    const bbox = new THREE.Box3().setFromObject(bodyMainRef);
    const size = bbox.getSize(new THREE.Vector3());
    const pivotB = new AmmoLib.btVector3(0, -size.y * 0.5, 0); // Bottom of torso box

    // Create hinge constraint
    constraints.spinHinge = new AmmoLib.btHingeConstraint(
        rigidBodies.anchor,
        rigidBodies.torso,
        new AmmoLib.btVector3(0, 0, 0),     // pivotA: anchor origin
        pivotB,                          // pivotB: bottom of torso
        new AmmoLib.btVector3(0, 1, 0),     // axisA: Y-axis
        new AmmoLib.btVector3(0, 1, 0),     // axisB: Y-axis
        true                            // useReferenceFrameA
    );

    // Enable angular motor
    const targetSpeed = 0; // Start with no rotation
    const maxTorque = 10;  // Reasonable torque limit
    constraints.spinHinge.enableAngularMotor(true, targetSpeed, maxTorque);

    // Add constraint to physics world
    physicsWorld.addConstraint(constraints.spinHinge, false);

    console.log('✅ Created hinge constraint with motor: spinHinge');
    console.log(`   Target speed: ${targetSpeed}, Max torque: ${maxTorque}`);
}

// Mouse interaction variables
const mouse = new THREE.Vector2();

// Cursor control - anchor follows mouse
let targetAnchorX = 0;
let targetAnchorZ = 0;
let currentAnchorX = 0;
let currentAnchorZ = 0;

// Motor control
const MOTOR_TARGET_SPEED = 8.0; // Speed when clicking
const MOTOR_MAX_TORQUE = 15.0;  // Torque limit

// Zoom constants
const ZOOM_SPEED = 0.1; // How fast to zoom
const MIN_ZOOM_DISTANCE = 5; // Closest zoom distance
const MAX_ZOOM_DISTANCE = 25; // Farthest zoom distance
let currentZoomDistance = 12; // Current distance from camera to target (matches initial position)

// Animation timing
let lastTime = 0;

// Physics ↔ Three.js sync
let physicsMeshMap = new Map();

// Toy references are initialized when GLTF loads
console.log('Motor-based Ammo.js jumping jack initialized');

// Mouse event handlers
function onMouseMove(event) {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // STEP 7: CURSOR CONTROL - Update anchor position targets
    // Convert screen position to world offset
    targetAnchorX = mouse.x * 2.0; // Scale for reasonable movement range
    targetAnchorZ = mouse.y * 2.0;
}

function onMouseDown(event) {
    // STEP 8: CLICK CONTROL - Set motor target speed on spinHinge
    try {
        if (!constraints.spinHinge) {
            console.warn('⚠️ Motor not ready yet - constraints not created');
            return;
        }

        const direction = Math.random() > 0.5 ? 1 : -1; // Random spin direction
        const targetSpeed = direction * MOTOR_TARGET_SPEED;

        constraints.spinHinge.enableAngularMotor(true, targetSpeed, MOTOR_MAX_TORQUE);
        console.log(`🔄 Motor activated: target speed ${targetSpeed}, max torque ${MOTOR_MAX_TORQUE}`);
    } catch (error) {
        console.error('❌ Motor control error:', error);
    }
}

function onMouseUp(event) {
    // Stop motor when mouse released
    try {
        if (!constraints.spinHinge) {
            return; // Motor not ready yet
        }

        constraints.spinHinge.enableAngularMotor(true, 0, MOTOR_MAX_TORQUE);
        console.log('⏹️ Motor stopped');
    } catch (error) {
        console.error('❌ Motor stop error:', error);
    }
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

// Mouse interaction drives kinematic body directly - no animation timers needed

// Animation loop with motor-based Ammo.js physics simulation
function animate(currentTime = 0) {
    try {
        requestAnimationFrame(animate);

        // Calculate delta time for physics simulation
        const delta = Math.min((currentTime - lastTime) / 1000, 1/60); // Cap at 60 FPS for physics
        lastTime = currentTime;

        // Guard: Only run physics if AmmoLib is loaded
        if (!AmmoLib) {
            renderer.render(scene, camera);
            return;
        }

        // STEP 7: CURSOR CONTROL - Update anchor body transform every frame
        if (rigidBodies.anchor) {
            // Smooth interpolation to target position
            currentAnchorX += (targetAnchorX - currentAnchorX) * delta * 3; // Smooth factor
            currentAnchorZ += (targetAnchorZ - currentAnchorZ) * delta * 3;

            // Set anchor transform (only position, no rotation for now)
            const anchorTransform = new AmmoLib.btTransform();
            anchorTransform.setIdentity();
            anchorTransform.setOrigin(new AmmoLib.btVector3(currentAnchorX, 0, currentAnchorZ));

            rigidBodies.anchor.getMotionState().setWorldTransform(anchorTransform);
            rigidBodies.anchor.setActivationState(4); // DISABLE_DEACTIVATION
        }

        // Step physics simulation
        if (physicsWorld) {
            physicsWorld.stepSimulation(delta, 10, 1/60); // Fixed time step for stability
        }

        // STEP 9: SYNC PHYSICS → THREE
        syncPhysicsToThree();

        renderer.render(scene, camera);
    } catch (error) {
        console.error('❌ Animation loop error:', error.message || error);
        console.error('Stack:', error.stack);
        // Continue the animation loop despite errors
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
}

// STEP 9: SYNC PHYSICS → THREE (MANDATORY)
function syncPhysicsToThree() {
    // Guard: Only sync if AmmoLib is loaded
    if (!AmmoLib) {
        return;
    }

    const tmpTrans = new AmmoLib.btTransform();

    // Sync torso from physics to Three.js
    if (rigidBodies.torso && bodyMainRef) {
        const motionState = rigidBodies.torso.getMotionState();
        if (motionState) {
            motionState.getWorldTransform(tmpTrans);

            const p = tmpTrans.getOrigin();
            const q = tmpTrans.getRotation();

            bodyMainRef.position.set(p.x(), p.y(), p.z());
            bodyMainRef.quaternion.set(q.x(), q.y(), q.z(), q.w());
        }
    }

    // Anchor is kinematic and doesn't need syncing back to Three.js
    // (it only moves based on cursor input)
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