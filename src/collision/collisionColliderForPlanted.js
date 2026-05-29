///// src/collision/collisionColliderForPlanted.js /////

export const COLLIDER_NODE_FLAG = 'isPlantedColliderNode';

const DEFAULT_COLLIDER_SHAPE = 'box';

function _num(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function _positive(value, fallback = 1) {
    return Number.isFinite(value) && Math.abs(value) > 0.0001 ? value : fallback;
}

export function cloneColliderData(collider) {
    const shape = ['box', 'sphere', 'cylinder'].includes(collider?.shape)
        ? collider.shape
        : DEFAULT_COLLIDER_SHAPE;

    return {
        shape,
        x: _num(collider?.x),
        y: _num(collider?.y),
        z: _num(collider?.z),
        rx: _num(collider?.rx),
        ry: _num(collider?.ry),
        rz: _num(collider?.rz),
        sx: _positive(collider?.sx),
        sy: _positive(collider?.sy),
        sz: _positive(collider?.sz),
    };
}

export function cloneColliderArray(colliders) {
    return Array.isArray(colliders) ? colliders.map(cloneColliderData) : [];
}

export function serializeColliderObject(object, shape) {
    return cloneColliderData({
        shape: shape || object?.userData?.colliderShape,
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
        rx: object.rotation.x,
        ry: object.rotation.y,
        rz: object.rotation.z,
        sx: object.scale.x,
        sy: object.scale.y,
        sz: object.scale.z,
    });
}

export function applyColliderTransform(object, collider) {
    const c = cloneColliderData(collider);
    object.position.set(c.x, c.y, c.z);
    object.rotation.set(c.rx, c.ry, c.rz);
    object.scale.set(c.sx, c.sy, c.sz);
    object.userData.colliderShape = c.shape;
    return object;
}

export function createColliderNode(collider) {
    const c = cloneColliderData(collider);
    const node = new THREE.Object3D();
    node.name = `collider_${c.shape}`;
    node.visible = false;
    node.userData[COLLIDER_NODE_FLAG] = true;
    node.userData.collider = c;
    applyColliderTransform(node, c);
    return node;
}

export function clearColliderNodes(parent) {
    if (!parent) return;
    const toRemove = [];

    parent.children.forEach((child) => {
        if (child.userData?.[COLLIDER_NODE_FLAG]) toRemove.push(child);
    });

    toRemove.forEach((child) => {
        parent.remove(child);
        child.traverse((node) => {
            if (node.isMesh) {
                node.geometry?.dispose?.();
                if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
                else node.material?.dispose?.();
            }
        });
    });
}

export function rebuildColliderNodes(parent, colliders) {
    clearColliderNodes(parent);
    cloneColliderArray(colliders).forEach((collider) => {
        parent.add(createColliderNode(collider));
    });
}

export function isProceduralObjectDef(def) {
    return !!def?.createGeometry;
}

export function createBoundingBoxColliderForObject(object) {
    const box = _getLocalBoundingBox(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    return cloneColliderData({
        shape: 'box',
        x: center.x,
        y: center.y,
        z: center.z,
        rx: 0,
        ry: 0,
        rz: 0,
        sx: Math.max(size.x, 1),
        sy: Math.max(size.y, 1),
        sz: Math.max(size.z, 1),
    });
}

export function ensureEntryColliders(entry, object, objectDef) {
    if (!entry || Array.isArray(entry.colliders) && entry.colliders.length > 0) {
        if (entry?.colliders) entry.colliders = cloneColliderArray(entry.colliders);
        return entry?.colliders || [];
    }

    if (isProceduralObjectDef(objectDef) && object) {
        entry.colliders = [createBoundingBoxColliderForObject(object)];
        return entry.colliders;
    }

    entry.colliders = [];
    return entry.colliders;
}

function _getLocalBoundingBox(root) {
    const box = new THREE.Box3();

    root.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

    root.traverse((node) => {
        if (!node.isMesh || node.userData?.[COLLIDER_NODE_FLAG]) return;
        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        const nodeBox = node.geometry.boundingBox.clone();
        const nodeToRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, node.matrixWorld);
        nodeBox.applyMatrix4(nodeToRoot);
        box.union(nodeBox);
    });

    if (box.isEmpty()) {
        box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
    }

    return box;
}
