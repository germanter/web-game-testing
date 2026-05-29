///// src/map/tree.js /////
import { WORLD_SEED, MAP, TREE } from '../global.js';

const treeMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true            
});

// EXPORTED: Allows physics engine to access raw mathematical bounds
export const chunkTrees = new Map();
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

        const normalizedY = (y - minY) / heightRange; 
        const radialDist = Math.sqrt(x * x + z * z);

        let finalColor = new THREE.Color();

        if (type === 'foliage') {
            const maxRadiusEstimate = heightRange * 0.4;
            const radialFactor = Math.min(1.0, radialDist / maxRadiusEstimate);
            finalColor.lerpColors(innerColor, outerColor, radialFactor);

            const shadowFactor = 0.35 + (normalizedY * 0.65);
            finalColor.multiplyScalar(shadowFactor);

            const noiseFactor = 0.92 + (prng() * 0.16);
            finalColor.multiplyScalar(noiseFactor);
        } else {
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

function buildGodTierConifer(prng, height, wx, wy, wz) {
    const geos = [];
    
    const trunkSegments = 5;
    const trunkHeight = height * TREE.COLLIDER_HEIGHT_SCALE;
    let trunkGeo = new THREE.CylinderGeometry(height * 0.015, height * TREE.COLLIDER_RADIUS_SCALE, trunkHeight, 5, trunkSegments);
    trunkGeo = trunkGeo.toNonIndexed();
    
    const trunkPos = trunkGeo.attributes.position;
    const wobbleX = (prng() - 0.5) * (height * 0.04);
    const wobbleZ = (prng() - 0.5) * (height * 0.04);
    
    for (let i = 0; i < trunkPos.count; i++) {
        let ty = trunkPos.getY(i);
        let factor = (ty / trunkHeight) + 0.5; 
        trunkPos.setX(i, trunkPos.getX(i) + wobbleX * Math.sin(factor * Math.PI));
        trunkPos.setZ(i, trunkPos.getZ(i) + wobbleZ * Math.cos(factor * Math.PI));
    }
    trunkGeo.computeVertexNormals();
    trunkGeo.translate(wx, wy + trunkHeight / 2, wz);
    
    const trunkColor = new THREE.Color(TREE.colorTrunkDark).lerp(new THREE.Color(TREE.colorTrunkLight), prng());
    shadeOrganicGeometry(trunkGeo, prng, trunkColor, null, 'trunk');
    geos.push(trunkGeo);

    const layers = 5 + Math.floor(prng() * 3); 
    let currentY = wy + height * 0.22;
    let layerRadius = height * TREE.COLLIDER_CONE_RADIUS_SCALE;
    const layerHeight = (height * 0.88) / layers;

    const deepCoreColor = new THREE.Color(TREE.colorFoliageCore);
    const vibrantOuterColor = new THREE.Color(TREE.colorFoliageOuterMin).lerp(new THREE.Color(TREE.colorFoliageOuterMax), prng());

    const branchClusters = 5 + Math.floor(prng() * 4); 
    const structuralAsymmetry = prng() * 0.25;
    const phaseOffset = prng() * Math.PI * 2;

    for (let i = 0; i < layers; i++) {
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
                let clusters = Math.sin(angle * branchClusters + phaseOffset) * 0.22;
                let needles = Math.cos(angle * 23.0 + (y * 4.0)) * 0.08;
                let variant = Math.sin(angle * 2.0 - phaseOffset) * structuralAsymmetry;

                let totalDisplacement = 1.0 + clusters + needles + variant;
                x *= totalDisplacement;
                z *= totalDisplacement;

                let normY = (y - minY) / layerHeight; 
                if (normY < 0.75) {
                    y -= (r * 0.32) * (1.0 - normY);
                }
            }

            lPos.setX(j, x);
            lPos.setY(j, y);
            lPos.setZ(j, z);
        }

        layerGeo.computeVertexNormals();
        layerGeo.rotateY(prng() * Math.PI * 2);
        layerGeo.translate(wx, currentY + layerHeight / 2, wz);

        shadeOrganicGeometry(layerGeo, prng, deepCoreColor, vibrantOuterColor, 'foliage');
        geos.push(layerGeo);

        currentY += layerHeight * 0.62;
        layerRadius *= 0.72; 
    }

    return geos;
}

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
    const area = MAP.chunkSize * MAP.chunkSize;
    const maxAttempts = Math.floor(area * TREE.density);
    
    const chunkGeometries = [];
    const treeData = [];
    const offsetX = cx * MAP.chunkSize;
    const offsetZ = cz * MAP.chunkSize;

    for (let i = 0; i < maxAttempts; i++) {
        const lx = (prng() - 0.5) * MAP.chunkSize;
        const lz = (prng() - 0.5) * MAP.chunkSize;
        
        const wx = offsetX + lx;
        const wz = offsetZ + lz;
        const wy = getHeightFunc(wx, wz);

        if (wy < TREE.minElevation || wy > TREE.maxElevation) continue;

        const normal = getNormalAt(wx, wz, getHeightFunc);
        if ((1.0 - normal.y) > TREE.maxSlope) continue;

        // Ensure PRNG sequence behaves identically 
        const height = TREE.minHeight + prng() * (TREE.maxHeight - TREE.minHeight);
        const treeGeos = buildGodTierConifer(prng, height, wx, wy, wz);
        chunkGeometries.push(...treeGeos);
        
        // Save the raw mathematical footprint of the tree object for custom collision engine
        treeData.push({ x: wx, y: wy, z: wz, height });
    }

    if (chunkGeometries.length > 0) {
        const mergedGeometry = mergeGeometries(chunkGeometries);
        const chunkTreeMesh = new THREE.Mesh(mergedGeometry, treeMaterial);
        
        chunkTreeMesh.matrixAutoUpdate = false;
        chunkTreeMesh.updateMatrix();
        
        scene.add(chunkTreeMesh);

        // Store both visual array and math data bounding array
        chunkTrees.set(chunkKey, { mesh: chunkTreeMesh, data: treeData });
    } else {
        chunkTrees.set(chunkKey, { mesh: null, data: [] }); 
    }
}

export function disposeTreesForChunk(cx, cz, scene) {
    const chunkKey = `${cx},${cz}`;
    if (chunkTrees.has(chunkKey)) {
        const chunkData = chunkTrees.get(chunkKey);
        if (chunkData && chunkData.mesh) {
            scene.remove(chunkData.mesh);
            chunkData.mesh.geometry.dispose();
        }
        chunkTrees.delete(chunkKey);
    }
}