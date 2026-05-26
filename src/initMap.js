///// src/initMap.js /////

// Import your save data
import { data } from '../config.js'; 

// Import modular systems
export const WORLD_SEED = "germanter-hysler-2000"; 
import { scene, renderer, chunks, updateMap, getMacroBiomeValue, getHeight } from './map/mainMap.js';
import { camera, initCameraControls, updateCameraMovement, handleCameraResize } from './camera/debugCamera.js';
import { spawnBlock } from '../assets/objects.js';
import * as DebugController from '../ui/debug/debugController.js';

// Application Globals
let buildMode = false;
const raycaster = new THREE.Raycaster();
const centerPoint = new THREE.Vector2(0, 0); // Center of screen for crosshair
const placedBlocks = []; // Tracks blocks currently rendered

// Setup UI
const instructions = document.getElementById('instructions');
const statsEl = document.getElementById('stats');
const biomeEl = document.getElementById('biome-info');

DebugController.initDebugUI(WORLD_SEED);
DebugController.setupPointerLockUI(instructions);
initCameraControls(); // Initialize Mouse/WASD Listeners

// Window Resizing Handlers
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    handleCameraResize(window.innerWidth, window.innerHeight);
});

// --- SAVING AND LOADING LOGIC ---
function loadSavedMap() {
    console.log("Loading blocks from save data...", data);
    data.forEach(blockData => {
        spawnBlock(scene, placedBlocks, blockData.x, blockData.y, blockData.z);
    });
}

async function saveMapToDisk() {
    console.log("Saving Map Data to Server...", data);
    try {
        await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log("Save successful!");
        DebugController.showSaveNotification(instructions);
    } catch (err) {
        console.error("Failed to save map:", err);
    }
}

// --- BUILD CONTROLS ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') {
        buildMode = !buildMode;
        console.log("Build Mode:", buildMode ? "ON" : "OFF");
        DebugController.updateCrosshairBuildMode(buildMode);
    }
    if (e.code === 'KeyP') {
        saveMapToDisk();
    }
});

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement === document.body && buildMode && e.button === 0) {
        raycaster.setFromCamera(centerPoint, camera);
        
        const activeTerrainMeshes = Array.from(chunks.values());
        const intersects = raycaster.intersectObjects(activeTerrainMeshes);
        
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point; 
            
            spawnBlock(scene, placedBlocks, hitPoint.x, hitPoint.y, hitPoint.z);
            
            data.push({
                type: "basic_block",
                x: hitPoint.x,
                y: hitPoint.y,
                z: hitPoint.z
            });
        }
    }
});

// --- MAIN APPLICATION LOOP ---
const clock = new THREE.Clock();
let frameCounter = 0; 

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // 1. Move Camera logic (passes terrain height for ground collision)
    const currentGroundHeight = getHeight(camera.position.x, camera.position.z);
    updateCameraMovement(delta, currentGroundHeight);

    // 2. Run Map Engine Logic (Chunks, Water alignment, etc)
    updateMap(camera);

    // 3. Throttle UI predictability updates
    if (++frameCounter % 10 === 0) {
        DebugController.updateDebugStats(statsEl, chunks.size, camera);
        let macro = getMacroBiomeValue(camera.position.x, camera.position.z);
        DebugController.updateBiomeUI(biomeEl, macro);
    }

    // Render Scene
    renderer.render(scene, camera);
}

// Kickoff
loadSavedMap();
animate();