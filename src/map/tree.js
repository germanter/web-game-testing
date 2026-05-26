import { WORLD_SEED } from '../global.js';

// --- CONFIGURATION PARAMETERS ---
export const CONFIG = {
    TREE_DENSITY: 0.00003,       // Controls tree frequency across the map field
    CHUNK_SIZE: 250,             // Must match mainMap.js
    MIN_TREE_HEIGHT: 50.0,       // Tall, grand silhouette scale
    MAX_TREE_HEIGHT: 100.0,
    BIOME: {
        MIN_ELEVATION: 10.0,     // Stays safely above beaches/water
        MAX_ELEVATION: 62.0,     // Stops before rocky mountain peaks
        MAX_SLOPE: 0.14          // Prevents trees from spawning on steep cliffs
    }
};

const treeMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true            // Highlights the complex, organic, hand-carved low-poly facets
});

const chunkTrees = new Map();
const GLOBAL_SEED_NUM = hashString(WORLD_SEED);

function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
}

function createChunkPRNG(cx, cz) {
    let state = (GLOBAL_SEED_NUM ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0;
    return function() {
        state = (state * 1103515245 + 12345) >>> 0;
        return state / 4294967296;
    };
}

// --- GOD-TIER VERTEX COLORING (RADIAL CORE + DEPTH SHADOWS) ---
function shadeOrganicGeometry(geometry, prng, innerColor, outerColor, type = 'foliage') {
    const pos = geometry.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < count; i++) {
        const y = pos.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const heightRange = (maxY - minY) || 1;

    for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        const normalizedY = (y - minY) / heightRange; // 0.0 base to 1.0 peak
        const radialDist = Math.sqrt(x * x + z * z);

        let finalColor = new THREE.Color();

        if (type === 'foliage') {
            // Core Occlusion: Blend from a dark interior core to an expressive outer needle color
            const maxRadiusEstimate = heightRange * 0.4;
            const radialFactor = Math.min(1.0, radialDist / maxRadiusEstimate);
            finalColor.lerpColors(innerColor, outerColor, radialFactor);

            // Hanging Shadow: Darken the undersides of the branch skirts dramatically
            const shadowFactor = 0.35 + (normalizedY * 0.65);
            finalColor.multiplyScalar(shadowFactor);

            // Micro-variance per vertex to break up solid coloring blocks
            const noiseFactor = 0.92 + (prng() * 0.16);
            finalColor.multiplyScalar(noiseFactor);
        } else {
            // Trunk shading (Dark gradient toward the root base)
            finalColor.copy(innerColor);
            const shadowFactor = 0.65 + (normalizedY * 0.35);
            finalColor.multiplyScalar(shadowFactor);
        }

        colors[i * 3] = finalColor.r;
        colors[i * 3 + 1] = finalColor.g;
        colors[i * 3 + 2] = finalColor.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function mergeGeometries(geometries) {
    let totalVertices = 0;
    for (let g of geometries) totalVertices += g.attributes.position.count;
    
    const posArr = new Float32Array(totalVertices * 3);
    const normArr = new Float32Array(totalVertices * 3);
    const colArr = new Float32Array(totalVertices * 3);
    
    let offset = 0;
    for (let g of geometries) {
        posArr.set(g.attributes.position.array, offset);
        normArr.set(g.attributes.normal.array, offset);
        colArr.set(g.attributes.color.array, offset);
        offset += g.attributes.position.array.length;
    }
    
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    return merged;
}

// --- HYPER-PROCEDURAL ADVANCED FIR GENERATOR ---
function buildGodTierConifer(prng, height, wx, wy, wz) {
    const geos = [];
    
    // 1. ORGANIC TRUNK ASSEMBLY (Multi-segmented with natural growth warping)
    const trunkSegments = 5;
    const trunkHeight = height * 0.45;
    let trunkGeo = new THREE.CylinderGeometry(height * 0.015, height * 0.05, trunkHeight, 5, trunkSegments);
    trunkGeo = trunkGeo.toNonIndexed();
    
    const trunkPos = trunkGeo.attributes.position;
    const wobbleX = (prng() - 0.5) * (height * 0.04);
    const wobbleZ = (prng() - 0.5) * (height * 0.04);
    
    for (let i = 0; i < trunkPos.count; i++) {
        let ty = trunkPos.getY(i);
        // Warp trunk vertices based on height to give a natural, non-linear organic curve
        let factor = (ty / trunkHeight) + 0.5; 
        trunkPos.setX(i, trunkPos.getX(i) + wobbleX * Math.sin(factor * Math.PI));
        trunkPos.setZ(i, trunkPos.getZ(i) + wobbleZ * Math.cos(factor * Math.PI));
    }
    trunkGeo.computeVertexNormals();
    trunkGeo.translate(wx, wy + trunkHeight / 2, wz);
    
    const trunkColor = new THREE.Color(0x231712).lerp(new THREE.Color(0x33241C), prng());
    shadeOrganicGeometry(trunkGeo, prng, trunkColor, null, 'trunk');
    geos.push(trunkGeo);

    // 2. PROCEDURAL NEEDLE SKIRTS (Dynamic structural deformation)
    const layers = 5 + Math.floor(prng() * 3); // 5 to 7 deeply unique dense layers
    let currentY = wy + height * 0.22;
    let layerRadius = height * 0.32;
    const layerHeight = (height * 0.88) / layers;

    // Base palettes inspired by dense Caucasian and Siberian fir textures
    const deepCoreColor = new THREE.Color(0x0A190C);
    const vibrantOuterColor = new THREE.Color(0x1E4620).lerp(new THREE.Color(0x2D5C22), prng());

    // Generate unique mathematical characteristics for this specific tree's foliage silhouette
    const branchClusters = 5 + Math.floor(prng() * 4); // 5 to 8 distinct radial growth directions
    const structuralAsymmetry = prng() * 0.25;
    const phaseOffset = prng() * Math.PI * 2;

    for (let i = 0; i < layers; i++) {
        // High vertex distribution (14 radial segments, 4 height cuts) provides high fidelity for mutations
        let layerGeo = new THREE.ConeGeometry(layerRadius, layerHeight, 14, 4);
        layerGeo = layerGeo.toNonIndexed();

        const lPos = layerGeo.attributes.position;
        let minY = Infinity;
        for (let j = 0; j < lPos.count; j++) {
            if (lPos.getY(j) < minY) minY = lPos.getY(j);
        }

        for (let j = 0; j < lPos.count; j++) {
            let x = lPos.getX(j);
            let y = lPos.getY(j);
            let z = lPos.getZ(j);

            let r = Math.sqrt(x * x + z * z);
            if (r > 0.01) {
                let angle = Math.atan2(z, x);

                // WAVE FUNCTION A: Primary radial branch cluster nodes (Rhythmic extensions)
                let clusters = Math.sin(angle * branchClusters + phaseOffset) * 0.22;

                // WAVE FUNCTION B: High-frequency ragged micro-needle roughness
                let needles = Math.cos(angle * 23.0 + (y * 4.0)) * 0.08;

                // WAVE FUNCTION C: Silhouette asymmetry variant (Prevents uniform roundness)
                let variant = Math.sin(angle * 2.0 - phaseOffset) * structuralAsymmetry;

                let totalDisplacement = 1.0 + clusters + needles + variant;
                x *= totalDisplacement;
                z *= totalDisplacement;

                // ORGANIC BRANCH DROOP: Forces outer needle ends to sag heavily downward under their own weight
                let normY = (y - minY) / layerHeight; // 0.0 (bottom edge of layer) to 1.0 (top)
                if (normY < 0.75) {
                    // Lower outer boundaries sag downward based on their extension distance
                    y -= (r * 0.32) * (1.0 - normY);
                }
            }

            lPos.setX(j, x);
            lPos.setY(j, y);
            lPos.setZ(j, z);
        }

        layerGeo.computeVertexNormals();
        
        // Randomly twist each layer around Y-axis to offset matching facets
        layerGeo.rotateY(prng() * Math.PI * 2);
        layerGeo.translate(wx, currentY + layerHeight / 2, wz);

        shadeOrganicGeometry(layerGeo, prng, deepCoreColor, vibrantOuterColor, 'foliage');
        geos.push(layerGeo);

        // Step upward and tightly taper inward for the next structural tier
        currentY += layerHeight * 0.62;
        layerRadius *= 0.72; 
    }

    return geos;
}

function buildTreeGeometries(prng, wx, wy, wz) {
    const height = CONFIG.MIN_TREE_HEIGHT + prng() * (CONFIG.MAX_TREE_HEIGHT - CONFIG.MIN_TREE_HEIGHT);
    return buildGodTierConifer(prng, height, wx, wy, wz);
}

// --- LIFECYCLE MANAGEMENT ---
function getNormalAt(x, z, getHeightFunc) {
    const eps = 0.5;
    const nx = getHeightFunc(x - eps, z) - getHeightFunc(x + eps, z);
    const ny = 2.0 * eps;
    const nz = getHeightFunc(x, z - eps) - getHeightFunc(x, z + eps);
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    return { x: nx/len, y: ny/len, z: nz/len };
}

export function generateTreesForChunk(cx, cz, scene, getHeightFunc) {
    const chunkKey = `${cx},${cz}`;
    if (chunkTrees.has(chunkKey)) return;

    const prng = createChunkPRNG(cx, cz);
    const area = CONFIG.CHUNK_SIZE * CONFIG.CHUNK_SIZE;
    const maxAttempts = Math.floor(area * CONFIG.TREE_DENSITY);
    
    const chunkGeometries = [];
    const offsetX = cx * CONFIG.CHUNK_SIZE;
    const offsetZ = cz * CONFIG.CHUNK_SIZE;

    for (let i = 0; i < maxAttempts; i++) {
        const lx = (prng() - 0.5) * CONFIG.CHUNK_SIZE;
        const lz = (prng() - 0.5) * CONFIG.CHUNK_SIZE;
        
        const wx = offsetX + lx;
        const wz = offsetZ + lz;
        const wy = getHeightFunc(wx, wz);

        if (wy < CONFIG.BIOME.MIN_ELEVATION || wy > CONFIG.BIOME.MAX_ELEVATION) continue;

        const normal = getNormalAt(wx, wz, getHeightFunc);
        if ((1.0 - normal.y) > CONFIG.BIOME.MAX_SLOPE) continue;

        const treeGeos = buildTreeGeometries(prng, wx, wy, wz);
        chunkGeometries.push(...treeGeos);
    }

    if (chunkGeometries.length > 0) {
        const mergedGeometry = mergeGeometries(chunkGeometries);
        const chunkTreeMesh = new THREE.Mesh(mergedGeometry, treeMaterial);
        
        chunkTreeMesh.matrixAutoUpdate = false;
        chunkTreeMesh.updateMatrix();
        
        scene.add(chunkTreeMesh);
        chunkTrees.set(chunkKey, chunkTreeMesh);
    } else {
        chunkTrees.set(chunkKey, null); 
    }
}

export function disposeTreesForChunk(cx, cz, scene) {
    const chunkKey = `${cx},${cz}`;
    if (chunkTrees.has(chunkKey)) {
        const mesh = chunkTrees.get(chunkKey);
        if (mesh) {
            scene.remove(mesh);
            mesh.geometry.dispose();
        }
        chunkTrees.delete(chunkKey);
    }
}