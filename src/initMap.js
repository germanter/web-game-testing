// Import your save data (adjust path if config.js is in a different folder)
import { data } from '../config.js'; 

// --- BUILD SYSTEM GLOBALS ---
let buildMode = false;
const raycaster = new THREE.Raycaster();
const centerPoint = new THREE.Vector2(0, 0); // Center of screen for crosshair
const placedBlocks = []; // Tracks blocks currently rendered

// The Block Template
const blockGeo = new THREE.BoxGeometry(4, 4, 4);
const blockMat = new THREE.MeshStandardMaterial({ 
    color: 0xff3333, 
    roughness: 0.7 
});


////////////////////////////
//////////////////////////// -- catch22
////////////////////////////
////////////////////////////
////////////////////////////



const WORLD_SEED = "germanter-hysler-2000"; 

// DJB2 String Hashing function
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); 
    }
    return hash >>> 0; // Force unsigned 32-bit integer
}

// Linear Congruential Generator (LCG)
let currentSeed = hashString(WORLD_SEED);
function seededRandom() {
    // POSIX standard LCG values
    currentSeed = (Math.imul(currentSeed, 1103515245) + 12345) >>> 0;
    return currentSeed / 4294967296; // Return float between 0.0 and 1.0
}

// Show the seed in the UI
document.getElementById('seed-info').innerText = `World Seed: "${WORLD_SEED}"`;

/**
 * 2. FAST 2D SIMPLEX NOISE IMPLEMENTATION (Seeded)
 */
const SimplexNoise = (function() {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    
    // Deterministic Permutation Table
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        p[i] = Math.floor(seededRandom() * 256); // Replaced Math.random() with seededRandom()
    }
    
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

/**
 * 3. TERRAIN MATH (Macro-Biome Masking System)
 */
function fbm(x, z, octaves, persistence, lacunarity) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        total += SimplexNoise(x * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue; 
}

function ridgedMultifractal(x, z, octaves) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let weight = 1.0;
    for(let i = 0; i < octaves; i++) {
        let n = SimplexNoise(x * frequency, z * frequency);
        n = 1.0 - Math.abs(n); 
        n = n * n; 
        n *= weight; 
        weight = Math.max(0.0, Math.min(1.0, n * 2.0));
        total += n * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return total; 
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
    let t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function getMacroBiomeValue(x, z) {
    let macro = fbm(x * 0.00025, z * 0.00025, 3, 0.5, 2.0);
    return (macro + 1.0) * 0.5; 
}

function getHeight(x, z) {
    const macro = getMacroBiomeValue(x, z);

    // --- A. Plains / Valleys ---
    let plains = fbm(x * 0.001, z * 0.001, 2, 0.5, 2.0);
    plains = (plains + 0.5) * 12.0; 

    // --- B. Rolling Hills ---
    let hills = fbm(x * 0.002, z * 0.002, 4, 0.5, 2.0);
    hills = (hills + 1.0) * 0.5; 
    hills = Math.pow(hills, 1.8) * 90.0; 

    // --- C. Sharp Mountains ---
    let mountains = ridgedMultifractal(x * 0.0025, z * 0.0025, 6);
    mountains = (mountains * 450.0) - 20.0; 

    // --- Seamless Blending Engine ---
    let plainsToHillsBlend = smoothstep(0.25, 0.45, macro);
    let terrainHeight = lerp(plains, hills, plainsToHillsBlend);

    let hillsToMountainsBlend = smoothstep(0.60, 0.80, macro);
    terrainHeight = lerp(terrainHeight, mountains, hillsToMountainsBlend);

    let micro = fbm(x * 0.05, z * 0.05, 2, 0.5, 2.0) * 1.5;

    return terrainHeight + micro - 5.0; 
}

/**
 * 4. BIOMES & PROCEDURAL VERTEX COLORING
 */
const colorSand    = new THREE.Color(0xd2b48c); // Warm Tan
const colorLowland = new THREE.Color(0x284715); // Deep Lush Green
const colorHill    = new THREE.Color(0x5c6631); // Olive/Ochre
const colorRock    = new THREE.Color(0x3d4045); // Dark Slate Grey
const colorSnow    = new THREE.Color(0xf0f4f8); // Crisp White

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
    if (rockBlend > 0) {
        targetColor.lerp(colorRock, rockBlend);
    }

    if (y > 150) {
        let snowBlend = Math.max(0, Math.min(1, (y - 150) / 80)); 
        let flatFactor = Math.max(0, Math.min(1, 1.0 - (slope * 2.8))); 
        
        let finalSnow = snowBlend * flatFactor;
        if (finalSnow > 0) {
            targetColor.lerp(colorSnow, finalSnow);
        }
    }
}

///////////////////////
// //////////////////
// --- SAVING AND LOADING LOGIC ---

// 1. Spawns a physical block in the 3D world
function spawnBlock(x, y, z) {
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.position.set(x, y + 2, z); // +2 so it sits ON the ground, not inside it
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    placedBlocks.push(block);
}

// 2. Loads the map from config.js on startup
function loadSavedMap() {
    console.log("Loading blocks from save data...", data);
    data.forEach(blockData => {
        spawnBlock(blockData.x, blockData.y, blockData.z);
    });
}

// 3. Triggers the Python POST request
async function saveMapToDisk() {
    console.log("Saving Map Data to Server...", data);
    try {
        await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log("Save successful!");
        // Optional flash effect on UI to show it saved
        document.getElementById('instructions').innerText = "MAP SAVED!";
        document.getElementById('instructions').style.display = 'block';
        setTimeout(() => document.getElementById('instructions').style.display = 'none', 1000);
    } catch (err) {
        console.error("Failed to save map:", err);
    }
}
/////////////////// - catch22
///////////////////////////

/**
 * 5. THREE.JS SETUP
 */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderDist = 4; 
const chunkSize = 250; 
const chunkRes = 80;   
scene.fog = new THREE.Fog(0x87ceeb, chunkSize * (renderDist - 1.5), chunkSize * renderDist);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 300, 0); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    color: 0x1e5a8f,
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
    metalness: 0.8,
    depthWrite: false
});
const waterPlane = new THREE.Mesh(waterGeo, waterMat);
waterPlane.position.y = 2.0; 
scene.add(waterPlane);

/**
 * 6. CHUNK MANAGER
 */
const chunks = new Map();
const chunkQueue = [];
const sharedTerrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: false
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
        
        const nx = hL - hR;
        const ny = 2.0 * eps;
        const nz = hD - hU;
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
            const tx = cx + x;
            const tz = cz + z;
            const key = `${tx},${tz}`;
            activeKeys.add(key);
            
            if(!chunks.has(key) && !chunkQueue.some(q => q.key === key)) {
                const distSq = x*x + z*z;
                chunkQueue.push({ key, tx, tz, distSq });
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
        const currentCx = Math.round(camera.position.x / chunkSize);
        const currentCz = Math.round(camera.position.z / chunkSize);
        if(Math.abs(q.tx - currentCx) <= renderDist && Math.abs(q.tz - currentCz) <= renderDist) {
            const mesh = buildChunk(q.tx, q.tz);
            chunks.set(q.key, mesh);
        }
    }
}

/**
 * 7. CUSTOM FLY CONTROLLER (WASD + Mouse)
 */
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
let yaw = 0;
let pitch = 0;
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        instructions.style.opacity = '0';
        setTimeout(() => instructions.style.display = 'none', 300);
    } else {
        instructions.style.display = 'flex';
        setTimeout(() => instructions.style.opacity = '1', 10);
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

/**
 * 8. MAIN LOOP & UI UPDATES
 */
const clock = new THREE.Clock();
const statsEl = document.getElementById('stats');
const biomeEl = document.getElementById('biome-info');
let frameCounter = 0; // Predictable frame counting to remove Math.random() in UI completely

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    updateMovement(delta);
    updateChunks();

    waterPlane.position.x = camera.position.x;
    waterPlane.position.z = camera.position.z;

    // Throttle UI predictably
    if(++frameCounter % 10 === 0) {
        const px = Math.floor(camera.position.x);
        const py = Math.floor(camera.position.y);
        const pz = Math.floor(camera.position.z);
        statsEl.innerText = `Chunks: ${chunks.size} | Pos: ${px}, ${py}, ${pz}`;
        
        let macro = getMacroBiomeValue(camera.position.x, camera.position.z);
        let biomeStr = "";
        let bColor = "";
        
        if (macro < 0.25) { biomeStr = "Flat Plains"; bColor = "#a3e635"; }
        else if (macro < 0.45) { biomeStr = "Plains/Hills Transition"; bColor = "#84cc16"; }
        else if (macro < 0.60) { biomeStr = "Rolling Hills"; bColor = "#eab308"; }
        else if (macro < 0.80) { biomeStr = "Hills/Mountains Transition"; bColor = "#f97316"; }
        else { biomeStr = "High Alpine Mountains"; bColor = "#ef4444"; }
        
        biomeEl.innerHTML = `Current Biome Map: <span style="color: ${bColor}; font-weight:bold;">${biomeStr} (${macro.toFixed(2)})</span>`;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

////////////////////////
/////////////////
// --- BUILD CONTROLS ---

// Keybinds for Build Mode (1) and Saving (P)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') {
        buildMode = !buildMode;
        console.log("Build Mode:", buildMode ? "ON" : "OFF");
        // Turn crosshair red so user knows they are holding a block
        document.getElementById('crosshair').style.filter = buildMode ? 'hue-rotate(140deg)' : 'none';
    }
    if (e.code === 'KeyP') {
        saveMapToDisk();
    }
});

// Raycast and Place Block on Click
document.addEventListener('mousedown', (e) => {
    // Only place a block if the mouse is locked (playing) and Build Mode is ON
    if (document.pointerLockElement === document.body && buildMode && e.button === 0) {
        
        // 1. Aim the raycaster from the camera through the crosshair
        raycaster.setFromCamera(centerPoint, camera);
        
        // 2. Get all currently loaded terrain chunks to check for collisions
        const activeTerrainMeshes = Array.from(chunks.values());
        
        // 3. Shoot the laser
        const intersects = raycaster.intersectObjects(activeTerrainMeshes);
        
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point; // Exact 3D coordinate of the dirt
            
            // Spawn it visually
            spawnBlock(hitPoint.x, hitPoint.y, hitPoint.z);
            
            // Push it to the data array for saving
            data.push({
                type: "basic_block",
                x: hitPoint.x,
                y: hitPoint.y,
                z: hitPoint.z
            });
        }
    }
});
loadSavedMap();
//////////////////
///////////////////////// - catch22

// Kickoff Application
animate();
