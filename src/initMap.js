///// src/initMap.js /////

import { data }                       from '../config.js';
import { WORLD_SEED }                  from './global.js';
import { scene, renderer, chunks, updateMap, getMacroBiomeValue, getHeight } from './map/mainMap.js';
import { camera, initCameraControls, updateCameraMovement, handleCameraResize } from './camera/debugCamera.js';
import * as DC                         from '../ui/debug/debugController.js';
import * as Planter                    from './objPlanter.js';

// ── Boot sequence ──────────────────────────────────────────────────────────────

// 1. Create ALL UI through debugController (our only UI gate)
DC.initAllUI(WORLD_SEED);

// 2. Wire pointer lock overlay — won't lock when planter mode is active
DC.setupPointerLockUI(() => !Planter.isPlanterActive());

// 3. Init camera WASD/mouse-look listeners
initCameraControls();

// 4. Init object planter (TransformControls + inventory UI)
Planter.initPlanter(renderer.domElement);

// 5. Load any previously saved objects
Planter.loadSavedObjects();

// ── Window resize ──────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    handleCameraResize(window.innerWidth, window.innerHeight);
});

// ── Save to server (P key) ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') saveMapToDisk();
});

async function saveMapToDisk() {
    console.log('Saving map…', data);
    try {
        await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        console.log('Save successful!');
        DC.showSaveNotification();
    } catch (err) {
        console.error('Failed to save map:', err);
    }
}

// ── Main animation loop ────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let frameCounter = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Camera movement (auto-paused in planter mode by debugCamera)
    updateCameraMovement(delta, getHeight(camera.position.x, camera.position.z));

    // Chunk streaming + water
    updateMap(camera);

    // Throttled debug UI updates (every 10 frames)
    if (++frameCounter % 10 === 0 && DC.DEBUG) {
        DC.updateDebugStats(DC.getStatsEl(), chunks.size, camera);
        DC.updateBiomeUI(DC.getBiomeEl(), getMacroBiomeValue(camera.position.x, camera.position.z));
    }

    renderer.render(scene, camera);
}

animate();