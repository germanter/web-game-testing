///// src/controls/mainControl.js /////
import { CAMERA, CAMERA_SYSTEM, PHYSICS } from '../global.js';
import { resolveMovement } from '../collision/collision.js';
import { camera } from '../camera/customCamera.js';

let _planterModeActive = false;
export function setPlanterModeFlag(val) { _planterModeActive = val; }
export function isPlanterModeActive()   { return _planterModeActive; }

const keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
let yaw   = 0;
let pitch = 0;

export function initControls() {
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== document.body) {
            for (const k in keys) keys[k] = false;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== document.body) return;
        if (_planterModeActive) return;

        if (CAMERA_SYSTEM.ACTIVE_CAMERA_ID === 1) {
            yaw   -= e.movementX * CAMERA.mouseSensitivity;
            pitch -= e.movementY * CAMERA.mouseSensitivity;
            pitch  = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, pitch));
            camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        } else {
            // Inputs translate the mother object. 
            // Camera automatically follows via customCamera view update.
            const mother = camera.userData.mother;
            if (mother) {
                mother.rotation.y -= e.movementX * CAMERA.mouseSensitivity;
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Tab') return;
        if (_planterModeActive) return; 
        switch (e.code) {
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
        switch (e.code) {
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

export function updateControls(delta, currentGroundHeight) {
    if (document.pointerLockElement !== document.body) return;
    if (_planterModeActive) return;

    let speed = CAMERA.baseSpeed * delta;
    if (keys.shift) speed *= CAMERA.sprintMultiplier;

    const moveVector = new THREE.Vector3();
    
    if (CAMERA_SYSTEM.ACTIVE_CAMERA_ID === 1) {
        // ID 1: Ghost fly cam - NO COLLISION CHECKS. Raw vector addition.
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(camera.quaternion);
        const up      = new THREE.Vector3(0, 1,  0);

        if (keys.w) moveVector.add(forward);
        if (keys.s) moveVector.sub(forward);
        if (keys.d) moveVector.add(right);
        if (keys.a) moveVector.sub(right);
        if (keys.e) moveVector.add(up);
        if (keys.q) moveVector.sub(up);

        if (moveVector.lengthSq() > 0) {
            moveVector.normalize().multiplyScalar(speed);
            camera.position.add(moveVector);
        }
        
        if (camera.position.y < currentGroundHeight + CAMERA.groundClearance) {
            camera.position.y = currentGroundHeight + CAMERA.groundClearance;
        }
    } else {
        // ID > 1: Apply physical limits securely to mother object
        const mother = camera.userData.mother;
        if (mother) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mother.quaternion);
            const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(mother.quaternion);
            const up      = new THREE.Vector3(0, 1,  0);

            if (keys.w) moveVector.add(forward);
            if (keys.s) moveVector.sub(forward);
            if (keys.d) moveVector.add(right);
            if (keys.a) moveVector.sub(right);
            if (keys.e) moveVector.add(up);
            if (keys.q) moveVector.sub(up);

            if (moveVector.lengthSq() > 0) {
                moveVector.normalize().multiplyScalar(speed);
                
                // Mathematical decoupled rigidbodies tie into this mother-object movement directly here
                const resolvedMove = resolveMovement(mother.position, moveVector, PHYSICS.entityRadius, mother.userData.uuid);
                mother.position.x += resolvedMove.x;
                mother.position.y += resolvedMove.y;
                mother.position.z += resolvedMove.z;
            }

            if (mother.position.y < currentGroundHeight + CAMERA.groundClearance) {
                mother.position.y = currentGroundHeight + CAMERA.groundClearance;
            }
        }
    }
}