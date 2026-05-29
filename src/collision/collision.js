///// src/collision/collision.js /////
import { chunkTrees } from '../map/tree.js';
import { TREE } from '../global.js';

/**
 * Pure Mathematical Decoupled Physics Check
 * Processes cylinder & cone boundaries directly from world coordinates array to resolve collisions natively.
 * 
 * @param {Object} currentPos - Current {x,y,z} of the entity
 * @param {Object} movement - Intended velocity {x,y,z}
 * @param {Number} entityRadius - Size footprint of the entity
 * @returns {Object} Final resolved velocity {x,y,z} allowing smooth edge sliding
 */
export function resolveMovement(currentPos, movement, entityRadius = 2.0) {
    let finalVx = movement.x;
    let finalVy = movement.y;
    let finalVz = movement.z;

    // Fast broadphase mapping relying entirely on existing chunk tracking loop
    for (const [chunkKey, chunk] of chunkTrees.entries()) {
        if (!chunk || !chunk.data) continue;

        // Loop over the mathematical tree bounds registered in the area
        for (let i = 0; i < chunk.data.length; i++) {
            const tree = chunk.data[i];
            
            const trunkHeight = tree.height * TREE.COLLIDER_HEIGHT_SCALE;
            let yRelative = (currentPos.y + finalVy) - tree.y;
            
            let targetTreeRadius = 0;

            // Mathematical shape approximation checking:
            if (yRelative >= -entityRadius && yRelative <= trunkHeight) {
                // 1. Trunk Cylinder Check (Direct physical tree trunk radius at ground level)
                targetTreeRadius = tree.height * TREE.COLLIDER_RADIUS_SCALE;
            } else if (yRelative > trunkHeight && yRelative <= tree.height) {
                // 2. Foliage Cone Check (Dynamic tapering radius further up the canopy)
                let coneHeight = tree.height - trunkHeight;
                let coneY = yRelative - trunkHeight;
                let maxConeRadius = tree.height * TREE.COLLIDER_CONE_RADIUS_SCALE;
                targetTreeRadius = maxConeRadius * (1.0 - (coneY / coneHeight));
            } else {
                // Completely passed above canopy or under roots
                continue;
            }

            if (targetTreeRadius <= 0) continue;

            const safeDist = entityRadius + targetTreeRadius;
            const sqSafeDist = safeDist * safeDist;

            // XZ Axial Isolation (Allows collision physics to 'slide' around objects seamlessly)
            
            // Check X axis impedance
            let dxX = (currentPos.x + finalVx) - tree.x;
            let dzX = currentPos.z - tree.z;
            if (dxX * dxX + dzX * dzX < sqSafeDist) {
                finalVx = 0; 
            }

            // Check Z axis impedance
            let dxZ = currentPos.x - tree.x;
            let dzZ = (currentPos.z + finalVz) - tree.z;
            if (dxZ * dxZ + dzZ * dzZ < sqSafeDist) {
                finalVz = 0; 
            }

            // Secondary failsafe catch for perfectly simultaneous corner-clip overlaps
            let dx = (currentPos.x + finalVx) - tree.x;
            let dz = (currentPos.z + finalVz) - tree.z;
            if (dx * dx + dz * dz < sqSafeDist) {
                finalVx = 0;
                finalVz = 0;
            }
        }
    }

    return { x: finalVx, y: finalVy, z: finalVz };
}