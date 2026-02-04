// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Camera setup - slight downward angle
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting setup - neutral lighting
const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.6);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// GLTF Loader for r128
const loader = new THREE.GLTFLoader();

// Toy hierarchy references - will be set after GLTF loads
let toyGroupRef; // Root group of the toy (used for spinning)

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

// Analyze GLTF hierarchy for debugging
// The toy now spins as a whole object on click - no individual part animations needed
function findToyParts(object) {
    console.log('GLTF loaded successfully! Analyzing hierarchy...');

    let objectCount = 0;
    object.traverse((child) => {
        objectCount++;
        console.log(`Object ${objectCount}:`, child.name, '- Type:', child.type);
    });

    console.log(`✅ Total objects in GLTF: ${objectCount}`);
    console.log('🎮 Controls: Move mouse to tilt toy, click to spin on vertical axis');
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

    if (toyGroupRef) {
        // Apply random rotation around the toy's vertical Y axis
        // This makes the entire jumping jack toy spin when clicked
        const randomAngle = (Math.random() - 0.5) * Math.PI * 4; // ±720° (2 full rotations)
        const startTime = Date.now();

        // Animate the spin over time with smooth easing
        function animateSpin() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / SPIN_DURATION, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

            const currentAngle = randomAngle * easeProgress;
            toyGroupRef.rotation.y = currentAngle;

            if (progress < 1) {
                requestAnimationFrame(animateSpin);
            }
        }

        animateSpin();
    }
}

function onMouseUp(event) {
    mousePressed = false;
}

// Update toy interaction based on mouse position
function updateToyInteraction() {
    if (!toyGroupRef || !stickObjectRef) return;

    // Map mouse position to subtle toy rotations for tactile feel
    // Mouse X (-1 to 1) maps to toy Y rotation (side-to-side tilt)
    const toyRotationY = mouse.x * maxToyTiltY;

    // Mouse Y (-1 to 1) maps to toy X rotation (forward-backward tilt)
    // Top of screen (y = -1) = more tilted back, bottom (y = 1) = more upright
    const toyRotationX = mouse.y * maxToyTiltX;

    // Apply subtle rotations to entire toy for realistic physics feel
    toyGroupRef.rotation.y = toyRotationY;
    toyGroupRef.rotation.x = toyRotationX;

    // Move stick to follow mouse cursor in screen space
    // This creates the illusion that the bottom of the stick is attached to the cursor
    if (stickObjectRef) {
        // Get the stick's base position in world space (assuming it's the bottom)
        const stickBasePos = new THREE.Vector3(0, -1, 0); // Local position at bottom of stick
        stickObjectRef.localToWorld(stickBasePos);

        // Convert mouse position to world coordinates at the stick's base depth
        const mouseWorldPos = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        mouseWorldPos.unproject(camera);

        // Calculate the offset needed to move stick base to mouse position
        const offset = mouseWorldPos.clone().sub(stickBasePos);

        // Apply offset to stick position (smooth following)
        const lerpFactor = 0.15; // Smooth following factor
        stickObjectRef.position.lerp(stickObjectRef.position.clone().add(offset), lerpFactor);
    }
}

// Spin animation is handled directly in onMouseDown with requestAnimationFrame

// Animation loop
function animate() {
    requestAnimationFrame(animate);

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