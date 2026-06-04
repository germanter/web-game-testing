import { camera } from '../camera/customCamera.js';
import { CAMERA_SYSTEM } from '../global.js';

/**
 * Moves the free camera, or the mother object it is attached to, to the target coordinates.
 */
export function teleportTo(x, y, z) {
    if (CAMERA_SYSTEM.ACTIVE_CAMERA_ID > 1 && camera.userData.mother) {
        const mother = camera.userData.mother;
        mother.position.set(x, y, z);
    } else {
        camera.position.set(x, y, z);
    }
}