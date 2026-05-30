///// src/camera/customCamera.js /////
import { CAMERA, CAMERA_SYSTEM } from '../global.js';
import { camData } from '../../config.js';
import { scene } from '../map/mainMap.js';

export const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    window.innerWidth / window.innerHeight,
    CAMERA.nearPlane,
    CAMERA.farPlane
);

// Initially position the ghost camera
camera.position.set(
    CAMERA.initialPos.x,
    CAMERA.initialPos.y,
    CAMERA.initialPos.z
);

export function handleCameraResize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

/**
 * Syncs the camera's world matrix every frame.
 * NO INPUT LOGIC HERE. 
 * If ID > 1, looks up the mother object and permanently locks the camera's matrix 
 * to the mother object + local offsets, maintaining it natively in scene root.
 */
export function updateCameraView() {
    if (CAMERA_SYSTEM.ACTIVE_CAMERA_ID > 1) {
        const cData = camData.find(c => c.id === CAMERA_SYSTEM.ACTIVE_CAMERA_ID);
        if (cData) {
            let mother = null;
            scene.traverse(child => {
                if (child.userData && child.userData.uuid === cData.parentId) {
                    mother = child;
                }
            });
            
            if (mother) {
                // Calculate position and rotation offsets manually to keep camera in scene root
                // This prevents breaking existing chunk/terrain raycast code
                const offsetPos = new THREE.Vector3(cData.lx, cData.ly, cData.lz);
                const offsetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(cData.rx, cData.ry, cData.rz, 'XYZ'));

                mother.updateMatrixWorld(true);
                
                offsetPos.applyMatrix4(mother.matrixWorld);
                const finalQuat = mother.getWorldQuaternion(new THREE.Quaternion()).multiply(offsetQuat);

                camera.position.copy(offsetPos);
                camera.quaternion.copy(finalQuat);
                
                camera.userData.mother = mother; // Keep reference for mainControl.js input router
                return;
            }
        }
    }
    
    // ID 1 (or attached object doesn't exist) -> clear reference
    camera.userData.mother = null;
}