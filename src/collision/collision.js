///// src/collision/collision.js /////
import { chunkTrees } from '../map/tree.js';
import { TREE } from '../global.js';
import { data } from '../../config.js';

// Pre-allocate THREE object instances to avoid Garbage Collection stutter during animation loops
const _objPos = new THREE.Vector3();
const _objQuat = new THREE.Quaternion();
const _objScale = new THREE.Vector3();
const _objMat = new THREE.Matrix4();

const _colPos = new THREE.Vector3();
const _colQuat = new THREE.Quaternion();
const _colScale = new THREE.Vector3();
const _colMat = new THREE.Matrix4();

const _worldColMat = new THREE.Matrix4();
const _invWorldColMat = new THREE.Matrix4();

const _testPos = new THREE.Vector3();
const _localPos = new THREE.Vector3();
const _clampedLocalPos = new THREE.Vector3();
const _closestWorldPos = new THREE.Vector3();
const _euler = new THREE.Euler();

/**
 * Checks if a world position mathematically intersects with the current collider matrix
 */
function checkColliderCollision(worldPos, entityRadius, shape) {
    // 1. Transform the test point into the local space of the collider
    _localPos.copy(worldPos).applyMatrix4(_invWorldColMat);

    // 2. Determine the closest valid mathematical point based on the collider's geometric shape
    if (shape === 'sphere') {
        const len = _localPos.length();
        if (len > 0.00001) {
            _clampedLocalPos.copy(_localPos).multiplyScalar(0.5 / len);
            if (len < 0.5) _clampedLocalPos.copy(_localPos); // Inside sphere
        } else {
            _clampedLocalPos.set(0, 0, 0);
        }
    } else if (shape === 'cylinder') {
        const clampedY = Math.max(-0.5, Math.min(0.5, _localPos.y));
        const dist2D = Math.sqrt(_localPos.x * _localPos.x + _localPos.z * _localPos.z);
        let cx = _localPos.x;
        let cz = _localPos.z;
        if (dist2D > 0.5) {
            const ratio = 0.5 / dist2D;
            cx *= ratio;
            cz *= ratio;
        }
        _clampedLocalPos.set(cx, clampedY, cz);
    } else {
        // 'box' (default) - Local bounds are perfectly -0.5 to 0.5 due to matrix scales
        _clampedLocalPos.set(
            Math.max(-0.5, Math.min(0.5, _localPos.x)),
            Math.max(-0.5, Math.min(0.5, _localPos.y)),
            Math.max(-0.5, Math.min(0.5, _localPos.z))
        );
    }

    // 3. Transform the closest mathematical local point back into absolute world space
    _closestWorldPos.copy(_clampedLocalPos).applyMatrix4(_worldColMat);

    // 4. Compare physical distance (Squared for performance)
    return worldPos.distanceToSquared(_closestWorldPos) < (entityRadius * entityRadius);
}

/**
 * Pure Mathematical Decoupled Physics Check
 * Processes cylinder & cone boundaries directly from world coordinates array to resolve collisions natively.
 * 
 * @param {Object} currentPos - Current {x,y,z} of the entity
 * @param {Object} movement - Intended velocity {x,y,z}
 * @param {Number} entityRadius - Size footprint of the entity
 * @returns {Object} Final resolved velocity {x,y,z} allowing smooth edge sliding
 */
export function resolveMovement(currentPos, movement, entityRadius = 2.0, ignoreUUID = null) {
    let finalVx = movement.x;
    let finalVy = movement.y;
    let finalVz = movement.z;

    // ── 1. PROCEDURAL GENERATION (TREES) BROADPHASE ─────────────────────────────
    for (const [chunkKey, chunk] of chunkTrees.entries()) {
        if (!chunk || !chunk.data) continue;

        for (let i = 0; i < chunk.data.length; i++) {
            const tree = chunk.data[i];
            
            const trunkHeight = tree.height * TREE.COLLIDER_HEIGHT_SCALE;
            let yRelative = (currentPos.y + finalVy) - tree.y;
            
            let targetTreeRadius = 0;

            if (yRelative >= -entityRadius && yRelative <= trunkHeight) {
                targetTreeRadius = tree.height * TREE.COLLIDER_RADIUS_SCALE;
            } else if (yRelative > trunkHeight && yRelative <= tree.height) {
                let coneHeight = tree.height - trunkHeight;
                let coneY = yRelative - trunkHeight;
                let maxConeRadius = tree.height * TREE.COLLIDER_CONE_RADIUS_SCALE;
                targetTreeRadius = maxConeRadius * (1.0 - (coneY / coneHeight));
            } else {
                continue;
            }

            if (targetTreeRadius <= 0) continue;

            const safeDist = entityRadius + targetTreeRadius;
            const sqSafeDist = safeDist * safeDist;

            // XZ Axial Isolation (Allows collision physics to 'slide' around objects seamlessly)
            let dxX = (currentPos.x + finalVx) - tree.x;
            let dzX = currentPos.z - tree.z;
            if (dxX * dxX + dzX * dzX < sqSafeDist) finalVx = 0; 

            let dxZ = currentPos.x - tree.x;
            let dzZ = (currentPos.z + finalVz) - tree.z;
            if (dxZ * dxZ + dzZ * dzZ < sqSafeDist) finalVz = 0; 

            let dx = (currentPos.x + finalVx) - tree.x;
            let dz = (currentPos.z + finalVz) - tree.z;
            if (dx * dx + dz * dz < sqSafeDist) {
                finalVx = 0;
                finalVz = 0;
            }
        }
    }

    // ── 2. PLANTED OBJECTS (config.js) COLLISION BROADPHASE ─────────────────────
    for (let i = 0; i < data.length; i++) {
        const obj = data[i];
        if (!obj.colliders || obj.colliders.length === 0) continue;

        // ADD THIS CRITICAL LINE: Skip collision checking against yourself
        if (ignoreUUID !== null && obj.uuid === ignoreUUID) continue;

        // Setup the Object's World Matrix
        _objPos.set(obj.x, obj.y, obj.z);
        _objQuat.setFromEuler(_euler.set(obj.rx, obj.ry, obj.rz, 'XYZ'));
        _objScale.set(obj.sx, obj.sy, obj.sz);
        _objMat.compose(_objPos, _objQuat, _objScale);

        // Process all attached colliders
        for (let j = 0; j < obj.colliders.length; j++) {
            const col = obj.colliders[j];
            const shape = col.shape || 'box';

            // Calculate the Collider's Local Matrix relative to the Object
            _colPos.set(col.x, col.y, col.z);
            _colQuat.setFromEuler(_euler.set(col.rx, col.ry, col.rz, 'XYZ'));
            _colScale.set(col.sx, col.sy, col.sz);
            _colMat.compose(_colPos, _colQuat, _colScale);

            // Compute Absolute World Transform representing this Collider natively
            _worldColMat.multiplyMatrices(_objMat, _colMat);
            _invWorldColMat.copy(_worldColMat).invert();

            // Isolate X Axis
            if (finalVx !== 0) {
                _testPos.set(currentPos.x + finalVx, currentPos.y, currentPos.z);
                if (checkColliderCollision(_testPos, entityRadius, shape)) finalVx = 0;
            }

            // Isolate Z Axis
            if (finalVz !== 0) {
                _testPos.set(currentPos.x, currentPos.y, currentPos.z + finalVz);
                if (checkColliderCollision(_testPos, entityRadius, shape)) finalVz = 0;
            }

            // Isolate Y Axis (Allows walking on platforms and hitting ceilings)
            if (finalVy !== 0) {
                _testPos.set(currentPos.x, currentPos.y + finalVy, currentPos.z);
                if (checkColliderCollision(_testPos, entityRadius, shape)) finalVy = 0;
            }

            // Failsafe Corner Check (Simultaneous XZ diagonal clip prevention)
            if (finalVx !== 0 && finalVz !== 0) {
                _testPos.set(currentPos.x + finalVx, currentPos.y, currentPos.z + finalVz);
                if (checkColliderCollision(_testPos, entityRadius, shape)) {
                    finalVx = 0;
                    finalVz = 0;
                }
            }
        }
    }

    return { x: finalVx, y: finalVy, z: finalVz };
}