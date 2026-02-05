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

// FAIL FAST SAFETY CHECKS
function validatePhysicsAuthority() {
    if (!rigidBodies.torso) {
        throw new Error("❌ PHYSICS AUTHORITY VIOLATION: Torso rigid body not created!");
    }

    // Check if it's a valid Ammo.js rigid body by checking for expected methods
    if (typeof rigidBodies.torso.getMotionState !== 'function') {
        throw new Error("❌ PHYSICS AUTHORITY VIOLATION: Torso is not a valid Ammo.js rigid body!");
    }

    // Check collision flags - should not be kinematic (CF_KINEMATIC_OBJECT = 2)
    const flags = rigidBodies.torso.getCollisionFlags();
    if (flags & 2) { // CF_KINEMATIC_OBJECT
        throw new Error("❌ PHYSICS AUTHORITY VIOLATION: Torso is kinematic - must be dynamic!");
    }

    console.log("✅ PHYSICS AUTHORITY VALIDATED: Torso is dynamic");
}

function safeSetWorldTransform(body, transform) {
    if (body === rigidBodies.torso) {
        throw new Error("❌ PHYSICS AUTHORITY VIOLATION: Manual setWorldTransform on torso after constraints created!");
    }
    body.getMotionState().setWorldTransform(transform);
}

console.log("PHYSICS AUTHORITY ACTIVE");

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy
let bodyMainRef;
let jointEmptyRef; // Blender Empty marking the stick-to-torso joint
let leftArmRef, rightArmRef, leftLegRef, rightLegRef;
// Joint constraint objects from Blender
let leftHandConstraint, rightHandConstraint, leftLegConstraint, rightLegConstraint;
let torsoToEmptyOffset = new THREE.Vector3(); // Offset from torso mesh to Empty (for visual sync)

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

            // Enable shadows and analyze mesh structure
            let totalMeshes = 0;
            const meshNames = new Map();
            toyGroupRef.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    totalMeshes++;

                    const name = child.name || 'unnamed';
                    meshNames.set(name, (meshNames.get(name) || 0) + 1);
                }
            });

            console.log(`🎭 GLTF loaded with ${totalMeshes} total meshes`);
            console.log('📋 Mesh name counts:', Object.fromEntries(meshNames));

            // Check for potential duplicates
            const duplicates = Array.from(meshNames.entries()).filter(([name, count]) => count > 1);
            if (duplicates.length > 0) {
                console.warn('⚠️ Potential duplicate meshes found:', duplicates);
                console.warn('💡 This could explain the static + moving mesh issue');
            }

            // All meshes are important - don't hide any

            // List all meshes with their positions (all should be visible)
            console.log('📍 All mesh positions:');
            let meshIndex = 0;
            toyGroupRef.traverse((child) => {
                if (child.isMesh) {
                    meshIndex++;
                    const worldPos = new THREE.Vector3();
                    child.getWorldPosition(worldPos);
                    console.log(`  ${meshIndex}. ${child.name || 'unnamed'}: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
                }
            });
            console.log(`🎭 All ${meshIndex} meshes are visible and important`);
            scene.add(toyGroupRef);

            // Find toy parts in the hierarchy
            findToyParts(toyGroupRef);

            // 🔧 FIX: Detach limbs to world space to avoid local/world transform mismatch
            if (leftArmRef) scene.attach(leftArmRef);
            if (rightArmRef) scene.attach(rightArmRef);
            if (leftLegRef) scene.attach(leftLegRef);
            if (rightLegRef) scene.attach(rightLegRef);

            console.log('✅ Limbs detached to world space:', {
                leftArm: leftArmRef?.parent === scene,
                rightArm: rightArmRef?.parent === scene,
                leftLeg: leftLegRef?.parent === scene,
                rightLeg: rightLegRef?.parent === scene
            });

            // Create physics bodies (only after GLTF loads and bodyMainRef is found)
            if (bodyMainRef && physicsWorld) {
                createRigidBodies();
                
                // Create constraints (only if bodies were created successfully)
                if (rigidBodies.anchor && rigidBodies.torso) {
                    createConstraints();
                    
                    // CREATE PHYSICS ↔ MESH MAP (MANDATORY)
                    physicsMeshMap = new Map();
                    physicsMeshMap.set(bodyMainRef, rigidBodies.torso);
                    if (leftArmRef && rigidBodies.leftArm) physicsMeshMap.set(leftArmRef, rigidBodies.leftArm);
                    if (rightArmRef && rigidBodies.rightArm) physicsMeshMap.set(rightArmRef, rigidBodies.rightArm);
                    if (leftLegRef && rigidBodies.leftLeg) physicsMeshMap.set(leftLegRef, rigidBodies.leftLeg);
                    if (rightLegRef && rigidBodies.rightLeg) physicsMeshMap.set(rightLegRef, rigidBodies.rightLeg);
                    
                    console.log('🎮 Motor-based jumping jack ready - move mouse to tilt, click to spin!');
                    console.log(`📊 Physics bodies: ${Object.keys(rigidBodies).filter(k => rigidBodies[k]).length} total`);
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
    bodyMainRef = findCollectionInGLTF(object, 'body_main') ||
                  findCollectionInGLTF(object, 'Body') ||
                  findCollectionInGLTF(object, 'body') ||
                  findCollectionInGLTF(object, 'torso') ||
                  findCollectionInGLTF(object, 'Torso');

    if (bodyMainRef) {
        console.log('✅ FOUND: body object → will use for torso physics');
        console.log('📍 Torso name:', bodyMainRef.name);
        console.log('📍 Torso position:', bodyMainRef.position);
        console.log('📍 Torso rotation:', bodyMainRef.rotation);
        console.log('📍 Torso type:', bodyMainRef.type);
        console.log('📍 Torso children:', bodyMainRef.children.length);
        
        // Count meshes in torso group (for debugging)
        let torsoMeshCount = 0;
        bodyMainRef.traverse((child) => {
            if (child.isMesh) {
                torsoMeshCount++;
            }
        });

        console.log(`📊 bodyMainRef contains ${torsoMeshCount} meshes`);

        console.log('✅ Using torso group for sync:', bodyMainRef.name);
    } else {
        console.error('❌ CRITICAL: body_main collection not found - cannot create torso physics');
        console.error('💡 Check that your Blender collection is named exactly: body_main');

        // Debug: show all available objects (not just Groups)
        console.log('🔍 Available objects in GLTF:');
        object.traverse((child) => {
            console.log(`   "${child.name}" (${child.type})`);
        });
    }

    // STEP 1: IDENTIFY THE JOINT CONSTRAINT (was Empty in Blender)
    // Search for constraint objects that represent joints
    const constraintNames = ['Constraint_left_hand', 'Constraint_right_hand',
                           'Constraint_left_leg', 'Constraint_right_leg'];

    // For torso joint, look for any constraint or use origin
    jointEmptyRef = null;

    // Try to find a central constraint or use origin as fallback
    jointEmptyRef = findCollectionInGLTF(object, 'Constraint_left_hand') ||
                   findCollectionInGLTF(object, 'Constraint_right_hand') ||
                   findCollectionInGLTF(object, 'Constraint_left_leg') ||
                   findCollectionInGLTF(object, 'Constraint_right_leg');

    if (!jointEmptyRef) {
        // Create a virtual joint at origin if no constraints found
        console.log('⚠️ No constraint objects found, using origin as joint');
        jointEmptyRef = {
            name: 'virtual_joint',
            position: new THREE.Vector3(0, 0, 0),
            getWorldPosition: (vec) => vec.set(0, 0, 0)
        };
    } else {
        console.log('✅ Using constraint as joint:', jointEmptyRef.name);
        console.log('📍 Joint position:', jointEmptyRef.position);
    }

    // Find limbs for future physics setup - try multiple naming patterns
    const findLimb = (patterns) => {
        for (const pattern of patterns) {
            const found = findCollectionInGLTF(object, pattern);
            if (found) return found;
        }
        return null;
    };

    leftArmRef = findLimb(['left_arm', 'LeftArm', 'leftArm', 'L_Arm', 'LArm']);
    rightArmRef = findLimb(['right_arm', 'RightArm', 'rightArm', 'R_Arm', 'RArm']);
    leftLegRef = findLimb(['left_leg', 'LeftLeg', 'leftLeg', 'L_Leg', 'LLeg']);
    rightLegRef = findLimb(['right_leg', 'RightLeg', 'rightLeg', 'R_Leg', 'RLeg']);

    // Find constraint objects for joint positions
    leftHandConstraint = findCollectionInGLTF(object, 'Constraint_left_hand');
    rightHandConstraint = findCollectionInGLTF(object, 'Constraint_right_hand');
    leftLegConstraint = findCollectionInGLTF(object, 'Constraint_left_leg');
    rightLegConstraint = findCollectionInGLTF(object, 'Constraint_right_leg');

    console.log('📋 Limbs found:', {
        leftArm: !!leftArmRef,
        rightArm: !!rightArmRef,
        leftLeg: !!leftLegRef,
        rightLeg: !!rightLegRef
    });

    console.log('🔗 Joint constraints found:', {
        leftHand: !!leftHandConstraint,
        rightHand: !!rightHandConstraint,
        leftLeg: !!leftLegConstraint,
        rightLeg: !!rightLegConstraint
    });

    // Debug: Show positions of constraints vs limbs vs torso
    if (bodyMainRef) {
        const torsoPos = new THREE.Vector3();
        bodyMainRef.getWorldPosition(torsoPos);
        console.log(`📍 Torso position: (${torsoPos.x.toFixed(3)}, ${torsoPos.y.toFixed(3)}, ${torsoPos.z.toFixed(3)})`);
    }

    const constraints = [
        { name: 'leftHand', obj: leftHandConstraint },
        { name: 'rightHand', obj: rightHandConstraint },
        { name: 'leftLeg', obj: leftLegConstraint },
        { name: 'rightLeg', obj: rightLegConstraint }
    ];

    constraints.forEach(({ name, obj }) => {
        if (obj) {
            const pos = new THREE.Vector3();
            obj.getWorldPosition(pos);
            console.log(`📍 ${name} constraint: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
        }
    });

    const limbs = [
        { name: 'leftArm', obj: leftArmRef },
        { name: 'rightArm', obj: rightArmRef },
        { name: 'leftLeg', obj: leftLegRef },
        { name: 'rightLeg', obj: rightLegRef }
    ];

    limbs.forEach(({ name, obj }) => {
        if (obj) {
            const pos = new THREE.Vector3();
            obj.getWorldPosition(pos);
            console.log(`📍 ${name} limb: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
        }
    });

    // Show which names were found
    const limbRefs = { leftArmRef, rightArmRef, leftLegRef, rightLegRef };
    Object.entries(limbRefs).forEach(([key, ref]) => {
        if (ref) {
            console.log(`✅ ${key}: "${ref.name}"`);
        }
    });

    // Debug limb structure
    [leftArmRef, rightArmRef, leftLegRef, rightLegRef].forEach((ref, index) => {
        if (ref) {
            const names = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
            let meshCount = 0;
            ref.traverse((child) => {
                if (child.isMesh) meshCount++;
            });
            console.log(`📊 ${names[index]} contains ${meshCount} meshes`);
        }
    });
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

    if (!jointEmptyRef) {
        console.error('❌ Cannot create rigid bodies - joint Empty not found');
        return;
    }

    console.log('✅ bodyMainRef confirmed, proceeding with physics creation...');

    // STEP 2: CREATE STATIC ANCHOR BODY (follows cursor) - ALIGNED TO JOINT EMPTY
    {
        // Use btSphereShape for simple anchor
        const anchorShape = new AmmoLib.btSphereShape(0.1); // Small sphere

        // Align anchor to Empty position initially
        const jointWorldPos = new THREE.Vector3();
        jointEmptyRef.getWorldPosition(jointWorldPos);

        const anchorTransform = new AmmoLib.btTransform();
        anchorTransform.setIdentity();
        anchorTransform.setOrigin(
            new AmmoLib.btVector3(
                jointWorldPos.x,
                jointWorldPos.y,
                jointWorldPos.z
            )
        );

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

        // Debug: Validate torso size
        if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z) ||
            size.x <= 0 || size.y <= 0 || size.z <= 0) {
            console.error('❌ Invalid torso bounding box size:', size.x, size.y, size.z);
            return;
        }

        const halfExtents = new AmmoLib.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);

        // Create box shape
        const torsoShape = new AmmoLib.btBoxShape(halfExtents);

        // Calculate local inertia (mass = 2.0)
        const mass = 2.0; // Dynamic torso
        const localInertia = new AmmoLib.btVector3(0, 0, 0);
        torsoShape.calculateLocalInertia(mass, localInertia);

        // Create motion state at the GLTF position - physics body starts where mesh is
        const transform = new AmmoLib.btTransform();
        transform.setIdentity();
        transform.setOrigin(new AmmoLib.btVector3(worldPos.x, worldPos.y, worldPos.z));
        transform.setRotation(new AmmoLib.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w));

        const motionState = new AmmoLib.btDefaultMotionState(transform);

        // Create rigid body info
        const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, torsoShape, localInertia);

        // Create rigid body
        rigidBodies.torso = new AmmoLib.btRigidBody(rbInfo);

        if (!rigidBodies.torso) {
            throw new Error("❌ Failed to create torso rigid body!");
        }

        // Set activation state - no kinematic flags
        rigidBodies.torso.setActivationState(4); // DISABLE_DEACTIVATION

        // Add to physics world
        physicsWorld.addRigidBody(rigidBodies.torso);

        // FAIL FAST: Validate physics authority
        validatePhysicsAuthority();

        console.log(`✅ DYNAMIC TORSO CREATED (mass: ${mass}, size: ${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
    }

    // Create limbs (arms and legs)
    const limbs = [
        { name: 'leftArm', ref: leftArmRef, mass: 0.5 },
        { name: 'rightArm', ref: rightArmRef, mass: 0.5 },
        { name: 'leftLeg', ref: leftLegRef, mass: 0.7 },
        { name: 'rightLeg', ref: rightLegRef, mass: 0.7 }
    ];

    limbs.forEach(({ name, ref, mass }) => {
        if (!ref) {
            console.log(`⚠️ Skipping ${name} - reference not found`);
            return;
        }

        // Get world transform
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        ref.getWorldPosition(worldPos);
        ref.getWorldQuaternion(worldQuat);

        // Approximate box shape from bounds
        const bbox = new THREE.Box3().setFromObject(ref);
        const size = bbox.getSize(new THREE.Vector3());

        // Debug: Validate size
        if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z) ||
            size.x <= 0 || size.y <= 0 || size.z <= 0) {
            console.error('❌ Invalid bounding box size for', name, ':', size.x, size.y, size.z);
            return;
        }

        const halfExtents = new AmmoLib.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);

        const shape = new AmmoLib.btBoxShape(halfExtents);

        // Calculate local inertia
        const localInertia = new AmmoLib.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, localInertia);

        // Create initial transform
        const initialTransform = new AmmoLib.btTransform();
        initialTransform.setIdentity();
        initialTransform.setOrigin(new AmmoLib.btVector3(worldPos.x, worldPos.y, worldPos.z));
        initialTransform.setRotation(new AmmoLib.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w));

        // Create motion state with initial transform
        const motionState = new AmmoLib.btDefaultMotionState(initialTransform);
        const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

        rigidBodies[name] = new AmmoLib.btRigidBody(rbInfo);
        rigidBodies[name].setDamping(0.1, 0.2);
        rigidBodies[name].setActivationState(4);
        rigidBodies[name].setSleepingThresholds(0, 0);

        physicsWorld.addRigidBody(rigidBodies[name]);
        console.log(`✅ Created ${name} body (mass: ${mass}) at (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
    });

    console.log('📊 Rigid bodies summary:', {
        anchor: !!rigidBodies.anchor,
        torso: !!rigidBodies.torso,
        leftArm: !!rigidBodies.leftArm,
        rightArm: !!rigidBodies.rightArm,
        leftLeg: !!rigidBodies.leftLeg,
        rightLeg: !!rigidBodies.rightLeg
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

    if (!jointEmptyRef) {
        console.error('❌ Cannot create constraints - joint Empty not found');
        return;
    }

    if (!bodyMainRef) {
        console.error('❌ Cannot create constraints - bodyMainRef not found');
        return;
    }

    // STEP 5: ANCHOR ↔ TORSO HINGE
    // pivotA = (0,0,0) in anchor local space
    // pivotB = jointWorld − torsoWorldOrigin
    // axis = Y axis

    // Compute jointWorld from Blender Empty
    const jointWorld = new THREE.Vector3();
    jointEmptyRef.getWorldPosition(jointWorld);

    // Get torso physics body world position
    const torsoTransform = new AmmoLib.btTransform();
    rigidBodies.torso.getMotionState().getWorldTransform(torsoTransform);
    const torsoOrigin = torsoTransform.getOrigin();

    // Compute pivotB = jointWorld − torsoWorldOrigin
    const pivotB = new AmmoLib.btVector3(
        jointWorld.x - torsoOrigin.x(),
        jointWorld.y - torsoOrigin.y(),
        jointWorld.z - torsoOrigin.z()
    );

    // Create hinge constraint between anchor and torso
    constraints.spinHinge = new AmmoLib.btHingeConstraint(
        rigidBodies.anchor,
        rigidBodies.torso,
        new AmmoLib.btVector3(0, 0, 0),     // pivotA: anchor origin
        pivotB,                             // pivotB: torso local pivot
        new AmmoLib.btVector3(0, 1, 0),     // axisA: Y-axis
        new AmmoLib.btVector3(0, 1, 0),     // axisB: Y-axis
        true                                // useReferenceFrameA
    );

    // Add constraint to physics world
    physicsWorld.addConstraint(constraints.spinHinge, false);

    console.log('✅ Created anchor ↔ torso hinge constraint');

    // Create limb constraints using constraint objects as joint positions
    const limbConstraints = [
        { name: 'leftArm', ref: leftArmRef, body: rigidBodies.leftArm, joint: leftHandConstraint },
        { name: 'rightArm', ref: rightArmRef, body: rigidBodies.rightArm, joint: rightHandConstraint },
        { name: 'leftLeg', ref: leftLegRef, body: rigidBodies.leftLeg, joint: leftLegConstraint },
        { name: 'rightLeg', ref: rightLegRef, body: rigidBodies.rightLeg, joint: rightLegConstraint }
    ];

    limbConstraints.forEach(({ name, ref, body, joint }) => {
        if (!body || !ref) {
            console.log(`⚠️ Skipping constraint for ${name} - body or reference missing`);
            return;
        }

        // Count meshes in limb group (for debugging)
        let limbMeshCount = 0;
        ref.traverse((child) => {
            if (child.isMesh) {
                limbMeshCount++;
            }
        });
        console.log(`📊 ${name} contains ${limbMeshCount} meshes`);

        // Get joint position from constraint object (or fallback to limb position)
        const jointWorld = new THREE.Vector3();
        if (joint) {
            joint.getWorldPosition(jointWorld);
            console.log(`🔗 ${name} using constraint joint: ${joint.name}`);
        } else {
            // Fallback: use limb origin as joint
            ref.getWorldPosition(jointWorld);
            console.log(`⚠️ ${name} using fallback joint (limb origin)`);
        }

        // Get torso physics body world position
        const torsoTransform = new AmmoLib.btTransform();
        rigidBodies.torso.getMotionState().getWorldTransform(torsoTransform);
        const torsoOrigin = torsoTransform.getOrigin();

        // Get limb physics body world position
        const limbTransform = new AmmoLib.btTransform();
        body.getMotionState().getWorldTransform(limbTransform);
        const limbOrigin = limbTransform.getOrigin();

        // Compute pivots using hinge pattern:
        // pivotA = jointWorld − torsoWorldOrigin
        // pivotB = jointWorld − limbWorldOrigin
        const pivotA = new AmmoLib.btVector3(
            jointWorld.x - torsoOrigin.x(),
            jointWorld.y - torsoOrigin.y(),
            jointWorld.z - torsoOrigin.z()
        );

        const pivotB = new AmmoLib.btVector3(
            jointWorld.x - limbOrigin.x(),
            jointWorld.y - limbOrigin.y(),
            jointWorld.z - limbOrigin.z()
        );

        // Create btHingeConstraint(torso, limb, pivotA, pivotB, axis, axis, true)
        const hinge = new AmmoLib.btHingeConstraint(
            rigidBodies.torso,
            body,
            pivotA,
            pivotB,
            new AmmoLib.btVector3(0, 1, 0),  // axisA: Y-axis
            new AmmoLib.btVector3(0, 1, 0),  // axisB: Y-axis
            true
        );

        // Add to physics world (disable collisions between connected bodies)
        physicsWorld.addConstraint(hinge, false);

        // Store constraint
        constraints[name] = hinge;

        console.log(`✅ Created hinge constraint: ${name}`);
        console.log(`   Joint: (${jointWorld.x.toFixed(3)}, ${jointWorld.y.toFixed(3)}, ${jointWorld.z.toFixed(3)})`);
        console.log(`   Torso origin: (${torsoOrigin.x().toFixed(3)}, ${torsoOrigin.y().toFixed(3)}, ${torsoOrigin.z().toFixed(3)})`);
        console.log(`   Limb origin: (${limbOrigin.x().toFixed(3)}, ${limbOrigin.y().toFixed(3)}, ${limbOrigin.z().toFixed(3)})`);
        console.log(`   Pivot A (torso local): (${pivotA.x().toFixed(3)}, ${pivotA.y().toFixed(3)}, ${pivotA.z().toFixed(3)})`);
        console.log(`   Pivot B (limb local): (${pivotB.x().toFixed(3)}, ${pivotB.y().toFixed(3)}, ${pivotB.z().toFixed(3)})`);
    });
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
let frameCount = 0;
let syncCount = 0;

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
    // STEP 8: CLICK CONTROL - DISABLED for debugging pendulum physics
    // try {
    //     if (!constraints.spinHinge) {
    //         console.warn('⚠️ Motor not ready yet - constraints not created');
    //         return;
    //     }

    //     const direction = Math.random() > 0.5 ? 1 : -1; // Random spin direction
    //     const targetSpeed = direction * MOTOR_TARGET_SPEED;

    //     constraints.spinHinge.enableAngularMotor(true, targetSpeed, MOTOR_MAX_TORQUE);
    //     console.log(`🔄 Motor activated: target speed ${targetSpeed}, max torque ${MOTOR_MAX_TORQUE}`);
    // } catch (error) {
    //     console.error('❌ Motor control error:', error);
    // }
}

function onMouseUp(event) {
    // Stop motor when mouse released - DISABLED for debugging
    // try {
    //     if (!constraints.spinHinge) {
    //         return; // Motor not ready yet
    //     }

    //     constraints.spinHinge.enableAngularMotor(true, 0, MOTOR_MAX_TORQUE);
    //     console.log('⏹️ Motor stopped');
    // } catch (error) {
    //     console.error('❌ Motor stop error:', error);
    // }
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

        // Initialize lastTime on first frame
        if (lastTime === 0) {
            lastTime = currentTime;
        }

        // Calculate delta time for physics simulation
        const delta = Math.min((currentTime - lastTime) / 1000, 1/60); // Cap at 60 FPS for physics
        lastTime = currentTime;

        // Debug: Log large delta values that might cause instability
        if (delta > 0.1) {
            console.warn('⚠️ Large delta time:', delta, 'capping to prevent physics instability');
        }

        // Guard: Only run physics if AmmoLib is loaded
        if (!AmmoLib) {
            renderer.render(scene, camera);
            return;
        }

        // STEP 7: CURSOR CONTROL - Update anchor body transform every frame
        if (rigidBodies.anchor && jointEmptyRef) {
            // Smooth interpolation to target position
            currentAnchorX += (targetAnchorX - currentAnchorX) * delta * 3; // Smooth factor
            currentAnchorZ += (targetAnchorZ - currentAnchorZ) * delta * 3;

            // Get Empty position as base
            const jointWorldPos = new THREE.Vector3();
            jointEmptyRef.getWorldPosition(jointWorldPos);

            // Set anchor transform - move in X/Z plane relative to Empty
            const anchorTransform = new AmmoLib.btTransform();
            anchorTransform.setIdentity();
            anchorTransform.setOrigin(new AmmoLib.btVector3(
                jointWorldPos.x + currentAnchorX,
                jointWorldPos.y,  // Keep Y at Empty level
                jointWorldPos.z + currentAnchorZ
            ));

            safeSetWorldTransform(rigidBodies.anchor, anchorTransform);
            rigidBodies.anchor.setActivationState(4); // DISABLE_DEACTIVATION
        }


        // Step physics simulation
        if (physicsWorld) {
            // Debug: Log physics step
            if (delta > 0.0167) { // More than 60 FPS
                console.warn('⚠️ Physics step with large delta:', delta);
            }

            try {
                physicsWorld.stepSimulation(delta, 10, 1/60); // Fixed time step for stability
            } catch (e) {
                console.error('❌ Physics step failed:', e);
                return;
            }

            // Debug: Check if this is the first few frames
            if (frameCount < 5) {
                frameCount++;
                console.log(`📊 Frame ${frameCount}: physics stepped with delta ${delta.toFixed(4)}`);
            }
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
    // Guard: Only sync if AmmoLib is loaded and physics bodies exist
    if (!AmmoLib || !rigidBodies.torso) {
        return;
    }

    // 🔒 Safety guard: never sync world physics into parented meshes
    if (
        (leftArmRef && leftArmRef.parent !== scene) ||
        (rightArmRef && rightArmRef.parent !== scene) ||
        (leftLegRef && leftLegRef.parent !== scene) ||
        (rightLegRef && rightLegRef.parent !== scene)
    ) {
        console.warn('⚠️ Limbs still parented – skipping physics sync');
        return;
    }

    const tmpTrans = new AmmoLib.btTransform();

    // Sync torso from physics to Three.js
    if (rigidBodies.torso && bodyMainRef) {
        const motionState = rigidBodies.torso.getMotionState();
        if (motionState) {
            try {
                motionState.getWorldTransform(tmpTrans);

                const p = tmpTrans.getOrigin();
                const q = tmpTrans.getRotation();

                // Check if values are valid
                if (isNaN(p.x()) || isNaN(p.y()) || isNaN(p.z()) || isNaN(q.x()) || isNaN(q.y()) || isNaN(q.z()) || isNaN(q.w())) {
                    console.warn('⚠️ Invalid torso physics transform - pos:', p.x(), p.y(), p.z(), 'rot:', q.x(), q.y(), q.z(), q.w(), 'skipping sync');
                    return;
                }

                // Debug: Log first few successful syncs
                if (syncCount < 3) {
                    syncCount++;
                    console.log(`🔄 Torso sync ${syncCount}: pos (${p.x().toFixed(3)}, ${p.y().toFixed(3)}, ${p.z().toFixed(3)})`);
                }

                // Sync to the group - groups handle hierarchical transforms correctly
                bodyMainRef.position.set(p.x(), p.y(), p.z());
                bodyMainRef.quaternion.set(q.x(), q.y(), q.z(), q.w());
            } catch (e) {
                console.error('❌ Error getting torso transform:', e);
                return;
            }
        } else {
            console.warn('⚠️ Torso motion state is null');
        }
    }

    // Sync limbs from physics to Three.js
    const limbs = [
        { name: 'leftArm', ref: leftArmRef, body: rigidBodies.leftArm },
        { name: 'rightArm', ref: rightArmRef, body: rigidBodies.rightArm },
        { name: 'leftLeg', ref: leftLegRef, body: rigidBodies.leftLeg },
        { name: 'rightLeg', ref: rightLegRef, body: rigidBodies.rightLeg }
    ];

    limbs.forEach(({ name, ref, body }) => {
        if (body && ref) {
            const motionState = body.getMotionState();
            if (motionState) {
                try {
                    motionState.getWorldTransform(tmpTrans);

                    const p = tmpTrans.getOrigin();
                    const q = tmpTrans.getRotation();

                    // Check if values are valid
                    if (isNaN(p.x()) || isNaN(p.y()) || isNaN(p.z()) || isNaN(q.x()) || isNaN(q.y()) || isNaN(q.z()) || isNaN(q.w())) {
                        console.warn(`⚠️ Invalid ${name} physics transform - pos:`, p.x(), p.y(), p.z(), 'rot:', q.x(), q.y(), q.z(), q.w());
                        return;
                    }

                    ref.position.set(p.x(), p.y(), p.z());
                    ref.quaternion.set(q.x(), q.y(), q.z(), q.w());
                } catch (e) {
                    console.error(`❌ Error getting ${name} transform:`, e);
                }
            }
        }
    });

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