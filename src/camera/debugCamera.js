///// src/debugCamera.js /////

// --- ADJUSTABLE CAMERA PARAMETERS ---
export const CAM_SETTINGS = {
    fov: 90,                         // Field of View
    nearPlane: 0.1,                  // Closest render distance
    farPlane: 5000,                  // Furthest render distance
    initialPos: { x: 0, y: 300, z: 0 }, // Starting coordinates
    baseSpeed: 250.0,                // Normal flying speed
    sprintMultiplier: 5.0,           // Speed multiplier when holding Shift
    mouseSensitivity: 0.002,         // Look sensitivity
    groundClearance: 5.0,            // Minimum height above terrain
    minPitch: -Math.PI / 2 + 0.01,   // Look down limit
    maxPitch: Math.PI / 2 - 0.01     // Look up limit
};

// Create and export the camera instance
export const camera = new THREE.PerspectiveCamera(
    CAM_SETTINGS.fov, 
    window.innerWidth / window.innerHeight, 
    CAM_SETTINGS.nearPlane, 
    CAM_SETTINGS.farPlane
);
camera.position.set(CAM_SETTINGS.initialPos.x, CAM_SETTINGS.initialPos.y, CAM_SETTINGS.initialPos.z);

// Internal state
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
let yaw = 0;
let pitch = 0;

// Input Listeners
export function initCameraControls() {
    document.addEventListener('pointerlockchange', () => {
        // Reset inputs when tabbed out or unlocking pointer
        if (document.pointerLockElement !== document.body) {
            for(let k in keys) keys[k] = false;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            yaw -= e.movementX * CAM_SETTINGS.mouseSensitivity;
            pitch -= e.movementY * CAM_SETTINGS.mouseSensitivity;
            pitch = Math.max(CAM_SETTINGS.minPitch, Math.min(CAM_SETTINGS.maxPitch, pitch));
            camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        }
    });

    document.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': keys.w = true; break;
            case 'KeyA': keys.a = true; break;
            case 'KeyS': keys.s = true; break;
            case 'KeyD': keys.d = true; break;
            case 'KeyQ': keys.q = true; break;
            case 'KeyE': case 'Space': keys.e = true; break;
            case 'ShiftLeft': case 'ShiftRight': keys.shift = true; break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': keys.w = false; break;
            case 'KeyA': keys.a = false; break;
            case 'KeyS': keys.s = false; break;
            case 'KeyD': keys.d = false; break;
            case 'KeyQ': keys.q = false; break;
            case 'KeyE': case 'Space': keys.e = false; break;
            case 'ShiftLeft': case 'ShiftRight': keys.shift = false; break;
        }
    });
}

// Update loop logic for movement
export function updateCameraMovement(delta, currentGroundHeight) {
    if (document.pointerLockElement !== document.body) return;

    let speed = CAM_SETTINGS.baseSpeed * delta; 
    if (keys.shift) speed *= CAM_SETTINGS.sprintMultiplier; 

    const moveVector = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    if (keys.w) moveVector.add(forward);
    if (keys.s) moveVector.sub(forward);
    if (keys.d) moveVector.add(right);
    if (keys.a) moveVector.sub(right);
    if (keys.e) moveVector.add(up); 
    if (keys.q) moveVector.sub(up); 

    if (moveVector.lengthSq() > 0) {
        moveVector.normalize();
        camera.position.addScaledVector(moveVector, speed);
    }
    
    // Terrain collision correction
    if (camera.position.y < currentGroundHeight + CAM_SETTINGS.groundClearance) {
        camera.position.y = currentGroundHeight + CAM_SETTINGS.groundClearance;
    }
}

// Handle window resizing
export function handleCameraResize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}