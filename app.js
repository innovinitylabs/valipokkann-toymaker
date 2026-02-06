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
camera.position.set(0, 8, 18);
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

// DEBUG GIZMOS will be added after GLTF loads (variables not available yet)

// GLTF Loader for r128
const loader = new THREE.GLTFLoader();

// Helper function to create labeled axes helper
function createLabeledAxesHelper(size = 1, labelSize = 0.1) {
    const group = new THREE.Group();

    // Create the basic axes lines
    const axesHelper = new THREE.AxesHelper(size);
    group.add(axesHelper);

    // X-axis label (red cube at end of X-axis)
    const xLabelGeometry = new THREE.BoxGeometry(labelSize, labelSize, labelSize);
    const xLabelMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xLabel = new THREE.Mesh(xLabelGeometry, xLabelMaterial);
    xLabel.position.set(size + labelSize/2, 0, 0);
    group.add(xLabel);

    // Y-axis label (green cube at end of Y-axis)
    const yLabelGeometry = new THREE.BoxGeometry(labelSize, labelSize, labelSize);
    const yLabelMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yLabel = new THREE.Mesh(yLabelGeometry, yLabelMaterial);
    yLabel.position.set(0, size + labelSize/2, 0);
    group.add(yLabel);

    // Z-axis label (blue cube at end of Z-axis)
    const zLabelGeometry = new THREE.BoxGeometry(labelSize, labelSize, labelSize);
    const zLabelMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zLabel = new THREE.Mesh(zLabelGeometry, zLabelMaterial);
    zLabel.position.set(0, 0, size + labelSize/2);
    group.add(zLabel);

    return group;
}

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
    const torsoFlags = rigidBodies.torso.getCollisionFlags();
    if (torsoFlags & 2) { // CF_KINEMATIC_OBJECT
        throw new Error("❌ PHYSICS AUTHORITY VIOLATION: Torso is kinematic - must be dynamic!");
    }

    // Check that limbs are also dynamic
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(name => {
        if (rigidBodies[name]) {
            const flags = rigidBodies[name].getCollisionFlags();
            if (flags & 2) { // CF_KINEMATIC_OBJECT
                throw new Error(`❌ PHYSICS AUTHORITY VIOLATION: ${name} is kinematic - must be dynamic!`);
            }
        }
    });

    // console.log("✅ PHYSICS AUTHORITY VALIDATED: Torso and limbs are dynamic");
}

function safeSetWorldTransform(body, transform) {
    if (body === rigidBodies.torso) {
        throw new Error("❌ PHYSICS AUTHORITY VIOLATION: Manual setWorldTransform on torso after constraints created!");
    }
    body.getMotionState().setWorldTransform(transform);
}

// console.log("PHYSICS AUTHORITY ACTIVE");

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy
let bodyMainRef;
let jointEmptyRef; // Blender Empty marking the stick-to-torso joint
let leftArmRef, rightArmRef, leftLegRef, rightLegRef;
// Joint constraint objects from Blender
let leftHandConstraint, rightHandConstraint, leftLegConstraint, rightLegConstraint;
let torsoToEmptyOffset = new THREE.Vector3(); // Offset from torso mesh to Empty (for visual sync)

// Debug gizmos for coordinate systems
let globalAxesHelper, torsoAxesHelper;

// STEP 1: Load Ammo.js using CDN and initialize physics
function initializeAmmo() {
    // console.log('🔍 Starting Ammo.js loading...');
    // console.log('typeof Ammo:', typeof Ammo);
    // console.log('window.Ammo:', !!window.Ammo);

    if (typeof Ammo === 'undefined') {
        console.error('❌ CRITICAL: Ammo global not found - script failed to load');
        console.error('💡 Check that ammo_browser.js is loading correctly');
        return; // This is now inside a function, so it's valid
    }

    Ammo().then((AmmoLibInstance) => {
        console.log('✅ Ammo.js loaded successfully');
        // console.log('AmmoLib available:', !!AmmoLibInstance);
        // Store AmmoLib globally so all functions can access it
        AmmoLib = AmmoLibInstance;
        // console.log('AmmoLib assigned, btVector3 available:', !!AmmoLib.btVector3);

        // Hide loading overlay after Ammo initializes
        hideLoading();

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
        // console.log('🔧 Initializing Ammo.js physics world...');

        // Create collision configuration and dispatcher
        const collisionConfig = new AmmoLib.btDefaultCollisionConfiguration();
        const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfig);

        // Create broadphase - try AxisSweep3 for better dynamic collision detection
        const broadphase = new AmmoLib.btAxisSweep3(
            new AmmoLib.btVector3(-100, -100, -100),
            new AmmoLib.btVector3(100, 100, 100)
        );

        // Create constraint solver (iterations configured in stepSimulation)
        const solver = new AmmoLib.btSequentialImpulseConstraintSolver();

        // Create physics world
        physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(
            dispatcher,
            broadphase,
            solver,
            collisionConfig
        );

        // Set gravity (temporarily disabled for debugging hinge constraints)
        physicsWorld.setGravity(new AmmoLib.btVector3(0, 0, 0)); // DISABLED GRAVITY

        // DEBUG: Check rigid body count
        // console.log('🔢 Physics world initialized with gravity:', physicsWorld.getGravity().y());

        // console.log('✅ Physics world created with gravity:', physicsWorld.getGravity().y());
        // console.log('✅ Solver iterations configured');
        // console.log('⏳ Waiting for GLTF to load before creating rigid bodies...');

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

            // console.log(`🎭 GLTF loaded with ${totalMeshes} total meshes`);
            // console.log('📋 Mesh name counts:', Object.fromEntries(meshNames));

            // Check for potential duplicates
            const duplicates = Array.from(meshNames.entries()).filter(([name, count]) => count > 1);
            if (duplicates.length > 0) {
                console.warn('⚠️ Potential duplicate meshes found:', duplicates);
                console.warn('💡 This could explain the static + moving mesh issue');
            }

            // All meshes are important - don't hide any

            // List all meshes with their positions (all should be visible)
            // console.log('📍 All mesh positions:');
            let meshIndex = 0;
            toyGroupRef.traverse((child) => {
                if (child.isMesh) {
                    meshIndex++;
                    const worldPos = new THREE.Vector3();
                    child.getWorldPosition(worldPos);
                    // console.log(`  ${meshIndex}. ${child.name || 'unnamed'}: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
                }
            });
            // console.log(`🎭 All ${meshIndex} meshes are visible and important`);
            scene.add(toyGroupRef);

            // Find toy parts in the hierarchy
            findToyParts(toyGroupRef);

            // 🔧 PHYSICS CONTROL: Detach limbs to world space for independent physics sync
            if (bodyMainRef) {
                // Detach arms to world space (required for physics sync)
                if (leftArmRef) scene.attach(leftArmRef);
                if (rightArmRef) scene.attach(rightArmRef);
                if (leftLegRef) scene.attach(leftLegRef);
                if (rightLegRef) scene.attach(rightLegRef);

            }

            // Add coordinate system gizmos for debugging
            // REMOVED: Global axes helper (shows world XYZ at origin)
            // globalAxesHelper = createLabeledAxesHelper(2, 0.15); // 2 units long, 0.15 label size
            // globalAxesHelper.position.set(0, 0, 0);
            // scene.add(globalAxesHelper);

            // if (bodyMainRef) {
            //     torsoAxesHelper = createLabeledAxesHelper(1, 0.08); // 1 unit long, 0.08 label size
            //     bodyMainRef.add(torsoAxesHelper);
            // }


            // Create physics bodies (only after GLTF loads and bodyMainRef is found)
            if (bodyMainRef && physicsWorld) {
                createRigidBodies();
                
                // Create constraints (only if bodies were created successfully)
                if (rigidBodies.anchor && rigidBodies.torso) {
                    createConstraints();

                    // Limbs are already dynamic from creation - no kinematic switching needed

                    // Enable gravity for realistic physics
                    physicsWorld.setGravity(new AmmoLib.btVector3(0, -9.8, 0));
                    
                    // CREATE PHYSICS ↔ MESH MAP (MANDATORY)
                    physicsMeshMap = new Map();
                    physicsMeshMap.set(bodyMainRef, rigidBodies.torso);
                    if (leftArmRef && rigidBodies.leftArm) physicsMeshMap.set(leftArmRef, rigidBodies.leftArm);
                    if (rightArmRef && rigidBodies.rightArm) physicsMeshMap.set(rightArmRef, rigidBodies.rightArm);
                    if (leftLegRef && rigidBodies.leftLeg) physicsMeshMap.set(leftLegRef, rigidBodies.leftLeg);
                    if (rightLegRef && rigidBodies.rightLeg) physicsMeshMap.set(rightLegRef, rigidBodies.rightLeg);
                    
                    // console.log('🎮 Motor-based jumping jack ready - move mouse to tilt, click to spin!');
                    // console.log(`📊 Physics bodies: ${Object.keys(rigidBodies).filter(k => rigidBodies[k]).length} total`);
                } else {
                    console.error('❌ Failed to create physics bodies - cannot create constraints');
                }
            } else {
                console.error('❌ Cannot create physics bodies - bodyMainRef or physicsWorld missing');
            }

            // Hide loading overlay (backup call in case Ammo load didn't trigger it)
            hideLoading();

            // console.log('GLTF loaded successfully');
            // console.log('Toy hierarchy:', toyGroupRef);
        },
        (progress) => {
            // console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
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
    // console.log('=== GLTF ANALYSIS FOR MOTOR-BASED JUMPING JACK ===');
    // console.log('🔍 Looking for body_main collection for torso physics...');

    // Debug: show ALL objects first
    // console.log('📋 ALL GLTF OBJECTS:');
    // let count = 0;
    // object.traverse((child) => {
    //     count++;
    //     console.log(`   ${count}. "${child.name}" (${child.type})`);
    // });

    // Only need body_main for now - we'll add limbs later
    bodyMainRef = findCollectionInGLTF(object, 'body_main') ||
                  findCollectionInGLTF(object, 'Body') ||
                  findCollectionInGLTF(object, 'body') ||
                  findCollectionInGLTF(object, 'torso') ||
                  findCollectionInGLTF(object, 'Torso');

    if (bodyMainRef) {
        // console.log('✅ FOUND: body object → will use for torso physics');
        // console.log('📍 Torso name:', bodyMainRef.name);
        // console.log('📍 Torso position:', bodyMainRef.position);
        // console.log('📍 Torso rotation:', bodyMainRef.rotation);
        // console.log('📍 Torso type:', bodyMainRef.type);
        // console.log('📍 Torso children:', bodyMainRef.children.length);
        
        // Identify and analyze torso meshes for individual collision shapes
        const torsoMeshes = [];
        bodyMainRef.traverse((child) => {
            if (child.isMesh) {
                torsoMeshes.push({
                    name: child.name || 'unnamed',
                    mesh: child,
                    geometry: child.geometry,
                    worldPosition: new THREE.Vector3(),
                    worldQuaternion: new THREE.Quaternion(),
                    boundingBox: new THREE.Box3().setFromObject(child)
                });
                // Update world position for later use
                child.getWorldPosition(torsoMeshes[torsoMeshes.length - 1].worldPosition);
                child.getWorldQuaternion(torsoMeshes[torsoMeshes.length - 1].worldQuaternion);
            }
        });

        console.log(`📊 bodyMainRef contains ${torsoMeshes.length} meshes:`);
        torsoMeshes.forEach((meshInfo, index) => {
            const size = meshInfo.boundingBox.getSize(new THREE.Vector3());
            console.log(`  ${index + 1}. "${meshInfo.name}": size(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}) at (${meshInfo.worldPosition.x.toFixed(2)}, ${meshInfo.worldPosition.y.toFixed(2)}, ${meshInfo.worldPosition.z.toFixed(2)})`);
        });

        // Store torso meshes globally for collider creation
        window.torsoMeshes = torsoMeshes;

        // console.log('✅ Using torso group for sync:', bodyMainRef.name);
    } else {
        console.error('❌ CRITICAL: body_main collection not found - cannot create torso physics');
        console.error('💡 Check that your Blender collection is named exactly: body_main');

        // Debug: show all available objects (not just Groups)
        // console.log('🔍 Available objects in GLTF:');
        // object.traverse((child) => {
        //     console.log(`   "${child.name}" (${child.type})`);
        // });
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
        // console.log('⚠️ No constraint objects found, using origin as joint');
        jointEmptyRef = {
            name: 'virtual_joint',
            position: new THREE.Vector3(0, 0, 0),
            getWorldPosition: (vec) => vec.set(0, 0, 0)
        };
    } else {
        // console.log('✅ Using constraint as joint:', jointEmptyRef.name);
        // console.log('📍 Joint position:', jointEmptyRef.position);
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

    // console.log('📋 Limbs found:', {
    //     leftArm: !!leftArmRef,
    //     rightArm: !!rightArmRef,
    //     leftLeg: !!leftLegRef,
    //     rightLeg: !!rightLegRef
    // });

    // console.log('🔗 Joint constraints found:', {
    //     leftHand: !!leftHandConstraint,
    //     rightHand: !!rightHandConstraint,
    //     leftLeg: !!leftLegConstraint,
    //     rightLeg: !!rightLegConstraint
    // });

    // Debug: Show positions of constraints vs limbs vs torso
    if (bodyMainRef) {
        const torsoPos = new THREE.Vector3();
        bodyMainRef.getWorldPosition(torsoPos);
        // console.log(`📍 Torso position: (${torsoPos.x.toFixed(3)}, ${torsoPos.y.toFixed(3)}, ${torsoPos.z.toFixed(3)})`);
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
            // console.log(`📍 ${name} constraint: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
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
            // console.log(`📍 ${name} limb: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
        }
    });

    // Show which names were found
    const limbRefs = { leftArmRef, rightArmRef, leftLegRef, rightLegRef };
    Object.entries(limbRefs).forEach(([key, ref]) => {
        if (ref) {
            // console.log(`✅ ${key}: "${ref.name}"`);
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
            // console.log(`📊 ${names[index]} contains ${meshCount} meshes`);
        }
    });
}

// Initialize Ammo.js physics world and create rigid bodies

// Create rigid bodies for anchor and torso (motor-based system)
function createRigidBodies() {
    // console.log('🏗️ Creating motor-based rigid bodies...');

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

        // console.log('✅ bodyMainRef confirmed, proceeding with physics creation...');

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

        physicsWorld.addRigidBody(rigidBodies.anchor, GROUP_TORSO, GROUP_TORSO); // Anchor collides with everything
        // console.log('✅ Created static anchor body (kinematic, follows cursor)');
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

        // Shrink collision shapes significantly to prevent initial overlap
        const shrink = 0.5; // 50% of original size for torso (more clearance)
        const halfExtents = new AmmoLib.btVector3(
            size.x * 0.5 * shrink,
            size.y * 0.5 * shrink,
            size.z * 0.5 * shrink
        );

        // Create box shape
        const torsoShape = new AmmoLib.btBoxShape(halfExtents);

        // Calculate local inertia (mass = 2.0)
        const mass = 2.0; // Dynamic torso
        const localInertia = new AmmoLib.btVector3(0, 0, 0);
        torsoShape.calculateLocalInertia(mass, localInertia);

        // Scale inertia to allow rotation around Y-axis (spin axis)
        // Reduce Y component aggressively for easy spinning, moderate reduction for X/Z
        localInertia.setX(localInertia.x() * 0.3);  // Moderate reduction
        localInertia.setY(localInertia.y() * 0.05); // Aggressive reduction for spin axis
        localInertia.setZ(localInertia.z() * 0.3);  // Moderate reduction

        // console.log(`🔄 Torso inertia scaled: X=${localInertia.x().toFixed(3)}, Y=${localInertia.y().toFixed(3)}, Z=${localInertia.z().toFixed(3)}`);

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

        // Torso stays dynamic (not kinematic) - only limbs are kinematic for manual control
        // Set activation state and damping once at creation
        rigidBodies.torso.setActivationState(4); // DISABLE_DEACTIVATION
        rigidBodies.torso.setDamping(0.02, 0.02); // Physically sane damping for hinge motor control

        // Add to physics world - torso core does NOT collide with anything (mass/inertia/constraints only)
        physicsWorld.addRigidBody(rigidBodies.torso, GROUP_TORSO, 0); // Torso collides with nothing

        // FAIL FAST: Validate physics authority
        validatePhysicsAuthority();

        // console.log(`✅ DYNAMIC TORSO CREATED (mass: ${mass}, size: ${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
    }

    // STEP 5: CREATE INDIVIDUAL TORSO MESH COLLIDERS
    {
        if (!window.torsoMeshes || window.torsoMeshes.length === 0) {
            console.error('❌ No torso meshes found for collision creation');
            return;
        }

        rigidBodies.torsoMeshColliders = []; // Store individual mesh colliders

        window.torsoMeshes.forEach((meshInfo, index) => {
            const { name, mesh, boundingBox, worldPosition, worldQuaternion } = meshInfo;

            // Skip certain meshes that shouldn't have collision (like very small parts)
            // But allow stick to have collision as it's an important interactive part
            if (name.includes('string') || (!name.includes('stick') && boundingBox.getSize(new THREE.Vector3()).length() < 0.1)) {
                console.log(`⏭️ Skipping collision for small mesh: ${name}`);
                return;
            }

            // Create collision shape that matches mesh geometry
            console.log(`🔧 Creating collider for torso mesh "${name}"`);

            let shape;

            // Special handling for stick - use capsule for better physics on thin objects
            if (name.includes('stick')) {
                const size = boundingBox.getSize(new THREE.Vector3());
                // For sticks, use the longest dimension as height and thinner dimensions for radius
                const height = Math.max(size.x, size.y, size.z);
                const radius = Math.min(size.x, size.y, size.z) * 0.5 + 0.02;

                shape = new AmmoLib.btCapsuleShape(radius, Math.max(0.1, height - 2 * radius));
                console.log(`    📏 Using capsule for stick: radius=${radius.toFixed(3)}, height=${(height - 2 * radius).toFixed(3)}`);
            }
            try {
                // Try to create convex hull shape from mesh geometry
                const geometry = mesh.geometry;

                // Ensure geometry has positions
                if (!geometry.attributes.position) {
                    throw new Error('No position attribute in geometry');
                }

                // Create convex hull shape from mesh vertices
                const convexShape = new AmmoLib.btConvexHullShape();

                // Get vertex positions from geometry
                const positions = geometry.attributes.position.array;
                const vertexCount = positions.length / 3;

                if (vertexCount < 4) {
                    throw new Error('Not enough vertices for convex hull');
                }

                // Add vertices to convex hull (sample every Nth vertex for performance)
                const samplingRate = Math.max(1, Math.floor(vertexCount / 100)); // Limit to ~100 vertices max
                const margin = 0.02; // Small margin to prevent objects from getting too close

                let addedPoints = 0;
                for (let i = 0; i < vertexCount; i += samplingRate) {
                    const x = positions[i * 3];
                    const y = positions[i * 3 + 1];
                    const z = positions[i * 3 + 2];

                    // Apply small outward offset for margin
                    const length = Math.sqrt(x*x + y*y + z*z);
                    const normalScale = length > 0.001 ? (length + margin) / length : 1.0 + margin;

                    convexShape.addPoint(new AmmoLib.btVector3(
                        x * normalScale,
                        y * normalScale,
                        z * normalScale
                    ), true);
                    addedPoints++;
                }

                if (addedPoints < 4) {
                    throw new Error('Not enough points added to convex hull');
                }

                // Set collision margin and optimize
                convexShape.setMargin(margin);
                convexShape.recalcLocalAabb();

                // Try to optimize if available
                if (convexShape.optimizeConvexHull) {
                    convexShape.optimizeConvexHull();
                }

                // Validate convex hull
                const numPoints = convexShape.getNumPoints();
                if (numPoints < 4) {
                    throw new Error(`Convex hull has only ${numPoints} points, need at least 4`);
                }

                shape = convexShape;
                console.log(`  ✅ Convex hull created with ${numPoints} points from ${vertexCount} vertices (${addedPoints} sampled)`);

            } catch (error) {
                // Fallback to multiple boxes or capsule if convex hull fails
                console.warn(`  ⚠️ Convex hull failed for "${name}": ${error.message}, using compound shape`);

                const size = boundingBox.getSize(new THREE.Vector3());

                // For elongated shapes, use capsule; for boxy shapes, use box
                if (Math.max(size.x, size.y, size.z) / Math.min(size.x, size.y, size.z) > 3) {
                    // Elongated shape - use capsule
                    const radius = Math.min(size.x, size.y, size.z) * 0.5 + 0.02;
                    const height = Math.max(size.x, size.y, size.z) - 2 * radius;
                    shape = new AmmoLib.btCapsuleShape(radius, Math.max(0.1, height));
                    console.log(`    📏 Using capsule: radius=${radius.toFixed(3)}, height=${height.toFixed(3)}`);
                } else {
                    // Boxy shape - use oriented box
                    const padding = 0.02;
                    const halfExtents = new AmmoLib.btVector3(
                        (size.x * 0.5) + padding,
                        (size.y * 0.5) + padding,
                        (size.z * 0.5) + padding
                    );
                    shape = new AmmoLib.btBoxShape(halfExtents);
                    console.log(`    📦 Using box: size=(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);
                }
            }

            // Static body (mass = 0) - kinematic collision-only
            const localInertia = new AmmoLib.btVector3(0, 0, 0);

            // Position collider at mesh world position
            const transform = new AmmoLib.btTransform();
            transform.setIdentity();
            transform.setOrigin(new AmmoLib.btVector3(worldPosition.x, worldPosition.y, worldPosition.z));
            transform.setRotation(new AmmoLib.btQuaternion(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w));

            const motionState = new AmmoLib.btDefaultMotionState(transform);
            const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(0, motionState, shape, localInertia);

            const colliderBody = new AmmoLib.btRigidBody(rbInfo);
            colliderBody.setCollisionFlags(colliderBody.getCollisionFlags() | 1); // CF_STATIC_OBJECT
            colliderBody.setActivationState(4); // DISABLE_DEACTIVATION

            // Add to physics world - collides with limbs
            physicsWorld.addRigidBody(colliderBody, GROUP_TORSO_PART, GROUP_LIMB);

            // Debug: Log collision shape type and basic info
            const shapeType = shape.constructor.name;
            console.log(`  🎯 Added ${shapeType} collider for "${name}"`);

            // Store for later position updates
            rigidBodies.torsoMeshColliders.push({
                body: colliderBody,
                mesh: mesh,
                name: name,
                initialPosition: worldPosition.clone(),
                initialQuaternion: worldQuaternion.clone(),
                shape: shape,
                shapeType: shapeType
            });
        });

        console.log(`✅ Created ${rigidBodies.torsoMeshColliders.length} individual torso mesh colliders`);
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
            return;
        }

        // Get world transform
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        ref.getWorldPosition(worldPos);
        ref.getWorldQuaternion(worldQuat);

        // Create collision shape that matches limb mesh geometry
        console.log(`🔧 Creating collider for limb mesh "${name}"`);

        let shape;
        try {
            // Create convex hull shape from limb mesh geometry
            const geometry = ref.geometry;

            // Ensure geometry has positions
            if (!geometry.attributes.position) {
                throw new Error('No position attribute in geometry');
            }

            // Create convex hull shape from mesh vertices
            const convexShape = new AmmoLib.btConvexHullShape();

            // Get vertex positions from geometry
            const positions = geometry.attributes.position.array;
            const vertexCount = positions.length / 3;

            if (vertexCount < 4) {
                throw new Error('Not enough vertices for convex hull');
            }

            // Add vertices to convex hull (sample every Nth vertex for performance)
            const samplingRate = Math.max(1, Math.floor(vertexCount / 50)); // Limit to ~50 vertices max for limbs
            const margin = 0.015; // Smaller margin for limbs

            let addedPoints = 0;
            for (let i = 0; i < vertexCount; i += samplingRate) {
                const x = positions[i * 3];
                const y = positions[i * 3 + 1];
                const z = positions[i * 3 + 2];

                // Apply small outward offset for margin
                const length = Math.sqrt(x*x + y*y + z*z);
                const normalScale = length > 0.001 ? (length + margin) / length : 1.0 + margin;

                convexShape.addPoint(new AmmoLib.btVector3(
                    x * normalScale,
                    y * normalScale,
                    z * normalScale
                ), true);
                addedPoints++;
            }

            if (addedPoints < 4) {
                throw new Error('Not enough points added to convex hull');
            }

            // Set collision margin and optimize
            convexShape.setMargin(margin);
            convexShape.recalcLocalAabb();

            // Try to optimize if available
            if (convexShape.optimizeConvexHull) {
                convexShape.optimizeConvexHull();
            }

            // Validate convex hull
            const numPoints = convexShape.getNumPoints();
            if (numPoints < 4) {
                throw new Error(`Convex hull has only ${numPoints} points, need at least 4`);
            }

            shape = convexShape;
            console.log(`  ✅ Limb convex hull created with ${numPoints} points from ${vertexCount} vertices`);

        } catch (error) {
            // Fallback to capsule if convex hull fails
            console.warn(`  ⚠️ Convex hull failed for limb "${name}": ${error.message}, using capsule`);

            // Use capsule as fallback for limbs
            const radius = 0.08;      // thickness of wooden limb
            const height = 1.2;       // length excluding caps
            shape = new AmmoLib.btCapsuleShape(radius, height);
            console.log(`    📏 Using capsule: radius=${radius.toFixed(3)}, height=${height.toFixed(3)}`);
        }

        // Calculate local inertia
        const localInertia = new AmmoLib.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, localInertia);

        // Create initial transform matching mesh position and rotation
        const initialTransform = new AmmoLib.btTransform();
        initialTransform.setIdentity();
        initialTransform.setOrigin(new AmmoLib.btVector3(worldPos.x, worldPos.y, worldPos.z));
        initialTransform.setRotation(new AmmoLib.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w));


        // Create motion state with initial transform
        const motionState = new AmmoLib.btDefaultMotionState(initialTransform);
        const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

        rigidBodies[name] = new AmmoLib.btRigidBody(rbInfo);

        // SAFETY CHECK: Ensure limb is NOT kinematic
        const flags = rigidBodies[name].getCollisionFlags();
        if (flags & 2) { // CF_KINEMATIC_OBJECT
            console.error(`❌ ${name} was created as kinematic - this breaks physics!`);
            throw new Error(`${name} must be dynamic from creation`);
        }
        // console.log(`✅ ${name} created as dynamic body (flags: ${flags})`);

        // Dynamic body setup - limbs must be dynamic from creation
        rigidBodies[name].setDamping(0.005, 0.01); // Extremely light damping for centrifugal response
        rigidBodies[name].setActivationState(4); // DISABLE_DEACTIVATION - limbs stay active
        rigidBodies[name].setSleepingThresholds(0, 0); // Never sleep

        // Basic friction properties (conservative - only known working methods)
        try {
            rigidBodies[name].setFriction(0.6);
            rigidBodies[name].setRestitution(0.05); // Wood barely bounces
        } catch (e) {
            console.warn(`Could not set physics properties for ${name}:`, e.message);
        }

        // Add limb to physics world with proper collision groups
        // Debug: Log collision shape type
        const shapeType = shape.constructor.name;
        console.log(`  🎯 Added ${shapeType} collider for limb "${name}"`);

        physicsWorld.addRigidBody(rigidBodies[name], GROUP_LIMB, GROUP_LIMB | GROUP_TORSO_PART); // Limbs collide with other limbs and torso parts
    });

    // FINAL SAFETY CHECK: Ensure limbs are dynamic, not kinematic
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(name => {
        if (rigidBodies[name]) {
            const flags = rigidBodies[name].getCollisionFlags();
            if (flags & 2) { // CF_KINEMATIC_OBJECT
                console.error(`❌ CRITICAL: ${name} is still kinematic! Physics will not work.`);
                throw new Error(`${name} must be dynamic for articulated physics`);
            }
            // console.log(`✅ ${name} confirmed dynamic (flags: ${flags})`);
        }
    });

    // console.log('📊 Rigid bodies summary:', {
    //     anchor: !!rigidBodies.anchor,
    //     torso: !!rigidBodies.torso,
    //     leftArm: !!rigidBodies.leftArm,
    //     rightArm: !!rigidBodies.rightArm,
    //     leftLeg: !!rigidBodies.leftLeg,
    //     rightLeg: !!rigidBodies.rightLeg
    // });
}

// Create hinge constraint with motor between anchor and torso
function createConstraints() {
    // console.log('🚀 createConstraints() called');

    // FAIL-FAST VALIDATION: Throw errors instead of silent returns
    if (!rigidBodies.torso) {
        throw new Error('❌ CRITICAL: No torso body found - physics graph incomplete!');
    }

    if (!AmmoLib) {
        throw new Error('❌ CRITICAL: Cannot create constraints - AmmoLib not loaded!');
    }

    if (!physicsWorld) {
        throw new Error('❌ CRITICAL: Cannot create constraints - physicsWorld not initialized!');
    }

    if (!rigidBodies.anchor) {
        throw new Error('❌ CRITICAL: Cannot create constraints - anchor body missing!');
    }

    if (!jointEmptyRef) {
        throw new Error('❌ CRITICAL: Cannot create constraints - joint Empty not found!');
    }

    if (!bodyMainRef) {
        throw new Error('❌ CRITICAL: Cannot create constraints - bodyMainRef not found!');
    }

    // Validate all limb rigid bodies exist
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(name => {
        if (!rigidBodies[name]) {
            throw new Error(`❌ CRITICAL: ${name} rigid body missing - articulated physics impossible!`);
        }
    });

    // console.log('📊 Available rigid bodies:', Object.keys(rigidBodies).filter(key => rigidBodies[key]));
    // console.log('🔗 Creating motor-based hinge constraint...');

    // STEP 5: ANCHOR ↔ TORSO HINGE - ENABLED TO KEEP TORSO IN FRAME WITH GRAVITY
    // Compute jointWorld from Blender Empty
    const jointWorld = new THREE.Vector3();
    jointEmptyRef.getWorldPosition(jointWorld);

    // Use world Y-axis (0,1,0) - GLB export should align torso correctly
    const trueYAxis = new AmmoLib.btVector3(0, 1, 0);

    // For clean center rotation, use (0,0,0) as pivot in torso local space
    // This makes the torso rotate around its center of mass
    const pivotB = new AmmoLib.btVector3(0, 0, 0);

        // console.log(`🔄 Using center pivot for stable rotation around torso center of mass`);

    // Create hinge constraint between anchor and torso - rotates around center
    constraints.spinHinge = new AmmoLib.btHingeConstraint(
        rigidBodies.anchor,
        rigidBodies.torso,
        new AmmoLib.btVector3(0, 0, 0),     // pivotA: anchor origin
        pivotB,                             // pivotB: (0,0,0) - torso center
        trueYAxis,                          // axisA: Y-axis for rotation
        trueYAxis,                          // axisB: Y-axis for rotation
        true                                // useReferenceFrameA
    );

    // Set wide angle limits to allow free Y-axis rotation
    constraints.spinHinge.setLimit(-Math.PI * 2, Math.PI * 2, 0.1, 0.1, 1.0);

    // Enable motor for free spinning (but don't start it yet)
    constraints.spinHinge.enableAngularMotor(false, 0, 0);

    // Add constraint to physics world (disable collision between connected bodies)
    physicsWorld.addConstraint(constraints.spinHinge, true);

        // console.log('✅ Created anchor ↔ torso hinge constraint (free Y-axis rotation)');

    // Create limb constraints using constraint objects as joint positions
    const limbConstraints = [
        { name: 'leftArm', ref: leftArmRef, body: rigidBodies.leftArm, joint: leftHandConstraint },
        { name: 'rightArm', ref: rightArmRef, body: rigidBodies.rightArm, joint: rightHandConstraint },
        { name: 'leftLeg', ref: leftLegRef, body: rigidBodies.leftLeg, joint: leftLegConstraint },
        { name: 'rightLeg', ref: rightLegRef, body: rigidBodies.rightLeg, joint: rightLegConstraint }
    ];

    // console.log('🔧 Creating limb constraints...');


    limbConstraints.forEach(({ name, ref, body, joint }) => {
        if (!body) {
            throw new Error(`❌ CRITICAL: ${name} rigid body missing - cannot create hinge constraint!`);
        }
        if (!ref) {
            throw new Error(`❌ CRITICAL: ${name} Three.js reference missing - cannot create hinge constraint!`);
        }

        // console.log(`🔧 Creating constraint for ${name}...`);

        // Get joint position from constraint object (or fallback to limb position)
        const jointWorld = new THREE.Vector3();
        if (joint) {
            joint.getWorldPosition(jointWorld);
            // console.log(`🎯 Using constraint joint for ${name}: (${jointWorld.x.toFixed(2)}, ${jointWorld.y.toFixed(2)}, ${jointWorld.z.toFixed(2)})`);
        } else {
            // Fallback: use limb origin as joint
            ref.getWorldPosition(jointWorld);
            // console.log(`⚠️ Using fallback joint for ${name}: (${jointWorld.x.toFixed(2)}, ${jointWorld.y.toFixed(2)}, ${jointWorld.z.toFixed(2)})`);
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

        // console.log(`📍 ${name} joint at: (${jointWorld.x.toFixed(2)}, ${jointWorld.y.toFixed(2)}, ${jointWorld.z.toFixed(2)})`);

        try {
            // Create btHingeConstraint(torso, limb, pivotA, pivotB, axis, axis, true)
            const hinge = new AmmoLib.btHingeConstraint(
                rigidBodies.torso,
                body,
                pivotA,
                pivotB,
                new AmmoLib.btVector3(0, 0, 1),  // axisA: Z-axis (forward axis)
                new AmmoLib.btVector3(0, 0, 1),  // axisB: Z-axis
                true
            );

            // Disable angle limits to allow free rotation (important for centrifugal force!)
            hinge.setLimit(-Math.PI * 2, Math.PI * 2, 0.01, 0.01, 1.0); // Very soft limits - minimal resistance

            // Add to physics world (disable collisions between connected bodies)
            physicsWorld.addConstraint(hinge, true);

            // Store constraint
            constraints[name] = hinge;

            // console.log(`✅ Successfully created and added hinge constraint for ${name}`);

        } catch (error) {
            console.error(`❌ Failed to create hinge constraint for ${name}:`, error);
        }
    });

    // ENSURE CONSTRAINTS ARE ALWAYS CREATED - No silent failures
    if (Object.keys(constraints).length === 0) {
        throw new Error("❌ CRITICAL: NO CONSTRAINTS CREATED — PHYSICS GRAPH IS BROKEN!");
    }

    // console.log(`✅ CONSTRAINTS CREATED: ${Object.keys(constraints).length} total`);
    // console.log("CONSTRAINT GRAPH:", Object.keys(constraints));
}

// Mouse interaction variables
const mouse = new THREE.Vector2();

// Click-to-rotate control
let currentRotationDirection = 1; // 1 for clockwise, -1 for counterclockwise

// Motor control
const MOTOR_TARGET_SPEED = 8.0; // Speed when clicking
const MOTOR_MAX_TORQUE = 15.0;  // Torque limit

// Collision groups for proper limb-torso separation
const GROUP_TORSO = 1;
const GROUP_LIMB = 2;
const GROUP_TORSO_PART = 4; // New group for torso collision proxies

// Loading overlay management
function hideLoading() {
    const el = document.getElementById("loading");
    if (el) {
        el.style.display = "none";
        // console.log("✅ Loading overlay hidden");
    } else {
        console.warn("⚠️ Loading element not found");
    }
}

// Zoom constants
const ZOOM_SPEED = 0.1; // How fast to zoom
const MIN_ZOOM_DISTANCE = 5; // Closest zoom distance
const MAX_ZOOM_DISTANCE = 25; // Farthest zoom distance
let currentZoomDistance = 18; // Current distance from camera to target (matches initial position)

// Animation timing
let lastTime = 0;
let frameCount = 0;

// Physics ↔ Three.js sync
let physicsMeshMap = new Map();

// Toy references are initialized when GLTF loads
// console.log('Motor-based Ammo.js jumping jack initialized');

// Mouse control state
let mouseButtonDown = false;
let lastMouseX = 0;
let currentMouseDelta = 0;

function onMouseMove(event) {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Track mouse delta for rotation control (only when button is down)
    if (mouseButtonDown) {
        const deltaX = event.clientX - lastMouseX;
        currentMouseDelta = deltaX * 0.005; // Scale down for reasonable rotation speed
        lastMouseX = event.clientX;

        // Debug: Log mouse movement
        // if (Math.abs(deltaX) > 0.1) {
        //     console.log(`🐭 Mouse move: deltaX=${deltaX.toFixed(1)}, currentDelta=${currentMouseDelta.toFixed(3)}`);
        // }
    }

        // Debug: Log mouse delta when button is down
        // if (mouseButtonDown && Math.abs(currentMouseDelta) > 0.001) {
        //     if (frameCount % 30 === 0) { // Throttle logging
        //         console.log(`🐭 Mouse delta: ${currentMouseDelta.toFixed(3)}`);
        //     }
        // }
}

function onMouseDown(event) {
    mouseButtonDown = true;
    lastMouseX = event.clientX;
    // Alternate rotation direction with each click
    currentRotationDirection *= -1; // Toggle between 1 and -1
    // console.log(`🖱️ Mouse button down - rotation enabled (${currentRotationDirection > 0 ? 'clockwise' : 'counterclockwise'}) at X:`, event.clientX);
}

function onMouseUp(event) {
    mouseButtonDown = false;
    mouseMoving = false;
    // console.log('🖱️ Mouse button up - rotation disabled');
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

        // Simple frame counter to verify animation is running
        frameCount++;
        if (frameCount % 60 === 0) { // Every ~1 second at 60fps
            // console.log(`🎬 Animation running - frame ${frameCount}`);
        }

        // PHYSICS CONTROL - Click-to-rotate control
        if (AmmoLib && physicsWorld) {
            // DEBUG: Check constraint count occasionally
            // if (frameCount % 120 === 0) {
            //     console.log(`🔗 Active constraints: ${Object.keys(constraints).length}`);
            // }

            // Control anchor↔torso hinge motor based on mouse input
            if (constraints.spinHinge) {
                // console.log(`🔗 spinHinge constraint exists: ${!!constraints.spinHinge}`);
                if (mouseButtonDown) {
                    // Reset to low damping for free spinning when mouse is down
                    if (rigidBodies.torso) {
                        rigidBodies.torso.setDamping(0.02, 0.02); // Low damping for spinning

                        // Limit angular velocity during spinning to prevent excessive speed
                        const angVel = rigidBodies.torso.getAngularVelocity();
                        const speed = Math.sqrt(angVel.x() * angVel.x() + angVel.y() * angVel.y() + angVel.z() * angVel.z());
                        if (speed > 12.0) { // Reasonable max speed during active spinning
                            const scale = 12.0 / speed;
                            rigidBodies.torso.setAngularVelocity(new AmmoLib.btVector3(
                                angVel.x() * scale,
                                angVel.y() * scale,
                                angVel.z() * scale
                            ));
                        }
                    }

                    // Apply torque for controlled spinning
                    const torque = 100.0 * currentRotationDirection;
                    rigidBodies.torso.applyTorque(new AmmoLib.btVector3(0, torque, 0));

                    // Check immediately after calling
                    // setTimeout(() => {
                    //     if (rigidBodies.torso) {
                    //         const angVel = rigidBodies.torso.getAngularVelocity();
                    //         const speed = Math.sqrt(angVel.x() * angVel.x() + angVel.y() * angVel.y() + angVel.z() * angVel.z());
                    //         console.log(`🔄 IMMEDIATE CHECK: Angular velocity (${angVel.x().toFixed(3)}, ${angVel.y().toFixed(3)}, ${angVel.z().toFixed(3)}) speed=${speed.toFixed(3)}`);
                    //     }
                    // }, 10);

                    // VERIFY ANGULAR VELOCITY - hard failure check
                    // setTimeout(() => {
                    //     if (rigidBodies.torso) {
                    //         const angVel = rigidBodies.torso.getAngularVelocity();
                    //         const speed = Math.sqrt(angVel.x() * angVel.x() + angVel.y() * angVel.y() + angVel.z() * angVel.z());
                    //         if (speed < 1.0) {
                    //             console.error(`❌ HINGE MOTOR FAILURE: Angular velocity too low (${speed.toFixed(3)}), motor not working!`);
                    //             console.error(`Angular velocity: (${angVel.x().toFixed(3)}, ${angVel.y().toFixed(3)}, ${angVel.z().toFixed(3)})`);
                    //         } else {
                    //             console.log(`✅ Hinge motor working: Angular velocity ${speed.toFixed(3)}`);
                    //         }
                    //     }
                    // }, 100); // Check after physics has a chance to respond

                    // DEBUG: Log motor activation
                    // if (frameCount % 60 === 0) {
                    //     console.log(`🔄 HINGE MOTOR: enabled, speed=${targetAngularSpeed}, maxImpulse=${maxMotorImpulse}`);
                    // }
                } else {
                    // Disable motor cleanly
                    constraints.spinHinge.enableAngularMotor(false, 0, 0);

                    // Apply very strong damping to bring toy to rest when mouse is released
                    if (rigidBodies.torso) {
                        rigidBodies.torso.setDamping(0.95, 0.98); // Very strong damping to stop very quickly

                        // Also limit angular velocity to prevent excessive spin
                        const angVel = rigidBodies.torso.getAngularVelocity();
                        const speed = Math.sqrt(angVel.x() * angVel.x() + angVel.y() * angVel.y() + angVel.z() * angVel.z());
                        if (speed > 15.0) { // Limit max rotation speed
                            const scale = 15.0 / speed;
                            rigidBodies.torso.setAngularVelocity(new AmmoLib.btVector3(
                                angVel.x() * scale,
                                angVel.y() * scale,
                                angVel.z() * scale
                            ));
                        }
                    }

                    // Also increase limb damping to help stop rotation
                    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(name => {
                        if (rigidBodies[name]) {
                            rigidBodies[name].setDamping(0.3, 0.4); // Higher damping on limbs when stopping
                        }
                    });

                    // DEBUG: Log motor deactivation
                    // if (frameCount % 60 === 0) {
                    //     console.log(`🔄 HINGE MOTOR: disabled`);
                    // }
                }
            }

            // Keep limbs active for centrifugal response (damping managed above)
            ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(name => {
                if (rigidBodies[name]) {
                    rigidBodies[name].activate(true); // Keep limbs active

                    // Reset limb damping when spinning (if not already set above)
                    if (mouseButtonDown && rigidBodies[name].getLinearDamping() > 0.1) {
                        rigidBodies[name].setDamping(0.005, 0.01); // Reset to low damping for spinning
                    }
                }
            });

            // Step real physics simulation
            try {
                physicsWorld.stepSimulation(delta, 10);

                // DEBUG: Check if constraints are being processed
                // if (frameCount % 120 === 0) {
                //     console.log(`🔗 Active constraints: ${Object.keys(constraints).length}`);
                // }
            } catch (e) {
                console.error('❌ Physics step failed:', e);
                return;
            }

            // Sync physics transforms to Three.js visuals
            syncPhysicsToThree();

            // Periodic check if sync is working
            if (frameCount % 120 === 0) { // Every 2 seconds
                // console.log(`🔄 Physics sync active - frame ${frameCount}`);
            }
        }

        // PHYSICS → VISUAL SYNC (MANDATORY)
        // syncPhysicsToThree() is called above in the physics control section

        renderer.render(scene, camera);
    } catch (error) {
        console.error('❌ Animation loop error:', error.message || error);
        console.error('Stack:', error.stack);
        // Continue the animation loop despite errors
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
}


// PHYSICS → VISUAL SYNC (MANDATORY)
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

                // Sync to the group - groups handle hierarchical transforms correctly
                bodyMainRef.position.set(p.x(), p.y(), p.z());
                bodyMainRef.quaternion.set(q.x(), q.y(), q.z(), q.w());

                // DEBUG: Log torso rotation occasionally
                if (frameCount % 60 === 0) { // Every second
                    // console.log(`🔄 Torso visual: pos(${p.x().toFixed(2)}, ${p.y().toFixed(2)}, ${p.z().toFixed(3)}, ${p.w().toFixed(3)}) rot(${q.x().toFixed(3)}, ${q.y().toFixed(3)}, ${q.z().toFixed(3)}, ${q.w().toFixed(3)})`);
                }
            } catch (e) {
                console.error('❌ Error getting torso transform:', e);
                return;
            }
        } else {
            console.warn('⚠️ Torso motion state is null');
        }
    }

    // Sync individual torso mesh colliders to follow their respective meshes
    if (rigidBodies.torsoMeshColliders && rigidBodies.torsoMeshColliders.length > 0) {
        rigidBodies.torsoMeshColliders.forEach(collider => {
            const { body, mesh, initialPosition, initialQuaternion } = collider;

            // Get current mesh world transform
            const currentPos = new THREE.Vector3();
            const currentQuat = new THREE.Quaternion();
            mesh.getWorldPosition(currentPos);
            mesh.getWorldQuaternion(currentQuat);

            // Create transform for collider
            const colliderTransform = new AmmoLib.btTransform();
            colliderTransform.setIdentity();
            colliderTransform.setOrigin(new AmmoLib.btVector3(currentPos.x, currentPos.y, currentPos.z));
            colliderTransform.setRotation(new AmmoLib.btQuaternion(currentQuat.x, currentQuat.y, currentQuat.z, currentQuat.w));

            // Update collider position (static bodies need manual transform updates)
            body.setWorldTransform(colliderTransform);
        });
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

                    // DEBUG: Log limb movement when spinning (less frequently)
                    // if (mouseButtonDown && frameCount % 120 === 0) {
                    //     console.log(`${name}: pos(${p.x().toFixed(2)}, ${p.y().toFixed(2)}, ${p.z().toFixed(2)})`);
                    // }
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
// Mouse events for desktop
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

// Touch events for mobile devices
window.addEventListener('touchstart', function(event) {
    // Only prevent default if not touching the description box
    const target = event.target;
    const isDescriptionTouch = target.closest && target.closest('#instructions');

    if (!isDescriptionTouch) {
        // Prevent scrolling and other default behaviors for canvas interactions
        event.preventDefault();
        const touch = event.touches[0];
        if (touch) {
            onMouseDown(touch);
        }
    }
    // If touching description, let normal touch behavior happen
}, { passive: false });

window.addEventListener('touchend', function(event) {
    // Only prevent default if not touching the description box
    const target = event.target;
    const isDescriptionTouch = target.closest && target.closest('#instructions');

    if (!isDescriptionTouch) {
        // Prevent any default behaviors for canvas touch end
        event.preventDefault();
        const touch = event.changedTouches[0];
        if (touch) {
            onMouseUp(touch);
        }
    }
    // If touching description, let normal touch behavior happen
}, { passive: false });
window.addEventListener('wheel', onMouseWheel, { passive: false });

// Start animation
animate();

// Debug helper - log hierarchy on key press
window.addEventListener('keydown', (event) => {
    if (event.key === 'h') {
        // console.log('Toy hierarchy:');
        // toyGroupRef.traverse((child) => {
        //     console.log(child.name || 'unnamed', child.type, child.position, child.rotation);
        // });
    }
});