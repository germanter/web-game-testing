///// src/map/mainMap.js /////

export const WORLD_SEED = "germanter-hysler-2000"; 

// DJB2 String Hashing function
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); 
    }
    return hash >>> 0; 
}

// Linear Congruential Generator (LCG)
let currentSeed = hashString(WORLD_SEED);
function seededRandom() {
    currentSeed = (Math.imul(currentSeed, 1103515245) + 12345) >>> 0;
    return currentSeed / 4294967296; 
}

// FAST 2D SIMPLEX NOISE IMPLEMENTATION (Seeded)
const SimplexNoise = (function() {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = Math.floor(seededRandom() * 256); 
    
    const perm = new Uint8Array(512);
    const permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        permMod12[i] = (perm[i] % 12);
    }
    const grad3 = new Float32Array([
        1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
        1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
        0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1
    ]);
    
    return function(xin, yin) {
        let n0, n1, n2;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;
        const ii = i & 255;
        const jj = j & 255;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) n0 = 0.0;
        else {
            const gi0 = permMod12[ii + perm[jj]] * 3;
            t0 *= t0;
            n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0+1] * y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) n1 = 0.0;
        else {
            const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
            t1 *= t1;
            n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1+1] * y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) n2 = 0.0;
        else {
            const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
            t2 *= t2;
            n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2+1] * y2);
        }
        return 70.0 * (n0 + n1 + n2);
    };
})();

// TERRAIN MATH
function fbm(x, z, octaves, persistence, lacunarity) {
    let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        total += SimplexNoise(x * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue; 
}

function ridgedMultifractal(x, z, octaves) {
    let total = 0, frequency = 1, amplitude = 1, weight = 1.0;
    for(let i = 0; i < octaves; i++) {
        let n = SimplexNoise(x * frequency, z * frequency);
        n = 1.0 - Math.abs(n); n = n * n; n *= weight; 
        weight = Math.max(0.0, Math.min(1.0, n * 2.0));
        total += n * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return total; 
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
    let t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function getMacroBiomeValue(x, z) {
    let macro = fbm(x * 0.00025, z * 0.00025, 3, 0.5, 2.0);
    return (macro + 1.0) * 0.5; 
}

export function getHeight(x, z) {
    const macro = getMacroBiomeValue(x, z);

    let plains = fbm(x * 0.001, z * 0.001, 2, 0.5, 2.0);
    plains = (plains + 0.5) * 12.0; 

    let hills = fbm(x * 0.002, z * 0.002, 4, 0.5, 2.0);
    hills = (hills + 1.0) * 0.5; 
    hills = Math.pow(hills, 1.8) * 90.0; 

    let mountains = ridgedMultifractal(x * 0.0025, z * 0.0025, 6);
    mountains = (mountains * 450.0) - 20.0; 

    let plainsToHillsBlend = smoothstep(0.25, 0.45, macro);
    let terrainHeight = lerp(plains, hills, plainsToHillsBlend);

    let hillsToMountainsBlend = smoothstep(0.60, 0.80, macro);
    terrainHeight = lerp(terrainHeight, mountains, hillsToMountainsBlend);

    let micro = fbm(x * 0.05, z * 0.05, 2, 0.5, 2.0) * 1.5;
    return terrainHeight + micro - 5.0; 
}

// BIOMES & PROCEDURAL VERTEX COLORING
const colorSand    = new THREE.Color(0xd2b48c);
const colorLowland = new THREE.Color(0x284715);
const colorHill    = new THREE.Color(0x5c6631);
const colorRock    = new THREE.Color(0x3d4045);
const colorSnow    = new THREE.Color(0xf0f4f8);

function getBiomeColor(y, normal, targetColor) {
    const slope = 1.0 - normal.y; 
    
    if (y < 6) {
        let t = Math.max(0, Math.min(1, (y - 2) / 4.0));
        targetColor.lerpColors(colorSand, colorLowland, t);
    } else if (y < 65) {
        let t = (y - 6) / 59.0;
        targetColor.lerpColors(colorLowland, colorHill, t);
    } else if (y < 160) {
        let t = (y - 65) / 95.0;
        targetColor.lerpColors(colorHill, colorRock, t);
    } else {
        targetColor.copy(colorRock);
    }

    let rockBlend = Math.max(0, Math.min(1, (slope - 0.25) * 4.0)); 
    if (rockBlend > 0) targetColor.lerp(colorRock, rockBlend);

    if (y > 150) {
        let snowBlend = Math.max(0, Math.min(1, (y - 150) / 80)); 
        let flatFactor = Math.max(0, Math.min(1, 1.0 - (slope * 2.8))); 
        let finalSnow = snowBlend * flatFactor;
        if (finalSnow > 0) targetColor.lerp(colorSnow, finalSnow);
    }
}

// THREE.JS SETUP
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderDist = 4; 
const chunkSize = 250; 
const chunkRes = 80;   
scene.fog = new THREE.Fog(0x87ceeb, chunkSize * (renderDist - 1.5), chunkSize * renderDist);

export const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 300, 0); 

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
sunLight.position.set(2000, 3000, 1000);
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x405060, 0.6);
scene.add(ambientLight);

const waterGeo = new THREE.PlaneGeometry(20000, 20000);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1e5a8f, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.8, depthWrite: false
});
const waterPlane = new THREE.Mesh(waterGeo, waterMat);
waterPlane.position.y = 2.0; 
scene.add(waterPlane);

// CHUNK MANAGER
export const chunks = new Map();
const chunkQueue = [];
const sharedTerrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: false
});

function buildChunk(cx, cz) {
    const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, chunkRes, chunkRes);
    geometry.rotateX(-Math.PI / 2);
    
    const pos = geometry.attributes.position;
    const normals = [];
    const colors = [];
    const tColor = new THREE.Color();
    
    const offsetX = cx * chunkSize;
    const offsetZ = cz * chunkSize;
    const eps = 1.0; 

    for(let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i) + offsetX;
        const vz = pos.getZ(i) + offsetZ;
        
        const vy = getHeight(vx, vz);
        pos.setY(i, vy);
        
        const hL = getHeight(vx - eps, vz);
        const hR = getHeight(vx + eps, vz);
        const hD = getHeight(vx, vz - eps);
        const hU = getHeight(vx, vz + eps);
        
        const nx = hL - hR, ny = 2.0 * eps, nz = hD - hU;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        const normal = { x: nx/len, y: ny/len, z: nz/len };
        normals.push(normal.x, normal.y, normal.z);
        
        getBiomeColor(vy, normal, tColor);
        colors.push(tColor.r, tColor.g, tColor.b);
    }
    
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const mesh = new THREE.Mesh(geometry, sharedTerrainMaterial);
    mesh.position.set(offsetX, 0, offsetZ);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    return mesh;
}

function updateChunks() {
    const cx = Math.round(camera.position.x / chunkSize);
    const cz = Math.round(camera.position.z / chunkSize);
    const activeKeys = new Set();
    
    for(let x = -renderDist; x <= renderDist; x++) {
        for(let z = -renderDist; z <= renderDist; z++) {
            const tx = cx + x, tz = cz + z;
            const key = `${tx},${tz}`;
            activeKeys.add(key);
            
            if(!chunks.has(key) && !chunkQueue.some(q => q.key === key)) {
                chunkQueue.push({ key, tx, tz, distSq: x*x + z*z });
            }
        }
    }
    chunkQueue.sort((a, b) => a.distSq - b.distSq);
    
    for(let [key, mesh] of chunks.entries()) {
        if(!activeKeys.has(key)) {
            mesh.geometry.dispose();
            scene.remove(mesh);
            chunks.delete(key);
        }
    }

    if(chunkQueue.length > 0) {
        const q = chunkQueue.shift();
        if(Math.abs(q.tx - Math.round(camera.position.x/chunkSize)) <= renderDist && 
           Math.abs(q.tz - Math.round(camera.position.z/chunkSize)) <= renderDist) {
            chunks.set(q.key, buildChunk(q.tx, q.tz));
        }
    }
}

// CUSTOM FLY CONTROLLER (WASD + Mouse)
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
let yaw = 0, pitch = 0;

document.addEventListener('pointerlockchange', () => {
    // Reset inputs when tabbed out
    if (document.pointerLockElement !== document.body) {
        for(let k in keys) keys[k] = false;
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitch));
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

function updateMovement(delta) {
    if (document.pointerLockElement !== document.body) return;

    let speed = 250.0 * delta; 
    if (keys.shift) speed *= 5.0; 

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
    
    const currentGroundHeight = getHeight(camera.position.x, camera.position.z);
    if (camera.position.y < currentGroundHeight + 5) {
        camera.position.y = currentGroundHeight + 5;
    }
}

// Window Scaling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Single Tick Updater for the Map
export function updateMap(delta) {
    updateMovement(delta);
    updateChunks();
    waterPlane.position.x = camera.position.x;
    waterPlane.position.z = camera.position.z;
}