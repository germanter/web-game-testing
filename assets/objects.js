///// assets/objects.js /////
//
// OBJECT REGISTRY CENTER
// ──────────────────────────────────────────────────────────────────────────────
// This is THE single registry for every placeable object in the world.
// Rules:
//   • Procedural meshes: fill createGeometry / createMaterial
//   • .glb models (future): fill glbPath, leave createGeometry null
//   • The inventory UI reads OBJECT_REGISTRY to build its buttons automatically
//   • config.js stores only the typeId string — look up definition here at load time
// ──────────────────────────────────────────────────────────────────────────────

export const OBJECT_REGISTRY = new Map([

    // ── PRIMITIVES ────────────────────────────────────────────────────────────

    ['basic_block', {
        id: 'basic_block',
        name: 'Basic Block',
        category: 'Primitives',
        icon: '🟥',
        glbPath: null,
        createGeometry: () => new THREE.BoxGeometry(160, 160, 160),
        createMaterial: () => new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.7 }),
        defaultScale: 1.0,
    }],

    ['wood_plank', {
        id: 'wood_plank',
        name: 'Wood Plank',
        category: 'Primitives',
        icon: '🟫',
        glbPath: null,
        createGeometry: () => new THREE.BoxGeometry(320, 40, 120),
        createMaterial: () => new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.9 }),
        defaultScale: 1.0,
    }],

    ['stone_pillar', {
        id: 'stone_pillar',
        name: 'Stone Pillar',
        category: 'Primitives',
        icon: '🔵',
        glbPath: null,
        createGeometry: () => new THREE.CylinderGeometry(30, 36, 220, 12),
        createMaterial: () => new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95 }),
        defaultScale: 1.0,
    }],

    ['flat_slab', {
        id: 'flat_slab',
        name: 'Flat Slab',
        category: 'Primitives',
        icon: '⬛',
        glbPath: null,
        createGeometry: () => new THREE.BoxGeometry(240, 30, 240),
        createMaterial: () => new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.8 }),
        defaultScale: 1.0,
    }],

    // ── .GLB MODELS (add entries like this when ready) ────────────────────────
    
    ['f22raptor', {
        id: 'f22raptor',
        name: 'F22 Raptor',
        category: 'Jet',
        icon: '✈️',
        glbPath: './assets/models/f22raptor.glb',  // ← path relative to index.html
        createGeometry: null,
        createMaterial: null,
        defaultScale: 100.0,
    }],

    ['b2spirit', {
        id: 'b2spirit',
        name: 'B2 Spirit',
        category: 'Bomber',
        icon: '✈️',
        glbPath: './assets/models/b2spirit.glb',  // ← path relative to index.html
        createGeometry: null,
        createMaterial: null,
        defaultScale: 100.0,
    }]

]);

// ─────────────────────────────────────────────────────────────────────────────
// createObjectMesh(typeId) → THREE.Mesh | null
//   Creates a fresh mesh from the registry entry.
//   GLB support: add GLTFLoader branch here when needed.
// ─────────────────────────────────────────────────────────────────────────────
// Replace your existing createObjectMesh function with this:

export async function createObjectMesh(typeId) { 
    const def = OBJECT_REGISTRY.get(typeId); 
    if (!def) { 
        console.error(`[ObjectRegistry] Unknown typeId: "${typeId}"`); 
        return null; 
    }

    // ── Procedural mesh ───────────────────────────────────────────────────────
    if (def.createGeometry) {
        const mesh = new THREE.Mesh(def.createGeometry(), def.createMaterial());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.objectTypeId = typeId;
        // Also apply default scale to primitives if set
        const s = def.defaultScale || 1.0;
        mesh.scale.set(s, s, s);
        return mesh;
    }

    // ── GLB mesh ──────────────────────────────────────────────────────────────
    if (def.glbPath) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(
                def.glbPath,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Traverse and apply shadows to all sub-meshes
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    // Tag the root with the ID so we can identify it later
                    model.userData.objectTypeId = typeId;
                    
                    // Apply default scale
                    const s = def.defaultScale || 1.0;
                    model.scale.set(s, s, s);

                    resolve(model);
                },
                undefined, // Progress callback (optional)
                (error) => {
                    console.error(`[ObjectRegistry] Failed to load GLB: "${typeId}"`, error);
                    resolve(null); // Resolve null so it doesn't break the app
                }
            );
        });
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy shim – keeps existing config.js loading working during transition
// ─────────────────────────────────────────────────────────────────────────────
export const blockGeo = new THREE.BoxGeometry(160, 160, 160);
export const blockMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.7 });

export function spawnBlock(scene, placedBlocksArray, x, y, z) {
    const mesh = new THREE.Mesh(blockGeo, blockMat);
    mesh.position.set(x, y + 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.objectTypeId = 'basic_block';
    scene.add(mesh);
    placedBlocksArray.push(mesh);
    return mesh;
}