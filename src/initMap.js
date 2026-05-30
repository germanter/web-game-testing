///// src/initMap.js /////

import { data, camData }                             from '../config.js';
import { WORLD_SEED, SYSTEM, CAMERA_SYSTEM }         from './global.js';
import { scene, renderer, chunks, updateMap, getMacroBiomeValue, getHeight } from './map/mainMap.js';
import { camera, handleCameraResize, updateCameraView } from './camera/customCamera.js';
import { initControls, updateControls }              from './controls/mainControl.js';
import * as DC                                       from '../ui/debug/debugController.js';
import * as Planter                                  from './objPlanter.js';

// ── Boot sequence ──────────────────────────────────────────────────────────────
DC.initAllUI(WORLD_SEED);
DC.setupPointerLockUI(() => !Planter.isPlanterActive());
initControls();
Planter.initPlanter(renderer.domElement, saveMapToDisk);
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

export async function saveMapToDisk() {
    console.log('Saving map…');
    try {
        await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, camData }),
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

    let targetX = camera.position.x;
    let targetZ = camera.position.z;

    if (CAMERA_SYSTEM.ACTIVE_CAMERA_ID > 1 && camera.userData.mother) {
        const m = camera.userData.mother;
        targetX = m.position.x;
        targetZ = m.position.z;
    }

    updateControls(delta, getHeight(targetX, targetZ));
    updateCameraView();

    updateMap(camera);

    if (++frameCounter % 10 === 0 && SYSTEM.DEBUG) {
        DC.updateDebugStats(DC.getStatsEl(), chunks.size, camera);
        DC.updateBiomeUI(DC.getBiomeEl(), getMacroBiomeValue(camera.position.x, camera.position.z));
    }

    renderer.render(scene, camera);
}

animate();