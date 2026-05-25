///// src/map/debugController.js /////

export function initDebugUI(worldSeed) {
    // Show the seed in the UI
    document.getElementById('seed-info').innerText = `World Seed: "${worldSeed}"`;
}

export function setupPointerLockUI(instructionsEl) {
    instructionsEl.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            instructionsEl.style.opacity = '0';
            setTimeout(() => instructionsEl.style.display = 'none', 300);
        } else {
            instructionsEl.style.display = 'flex';
            setTimeout(() => instructionsEl.style.opacity = '1', 10);
        }
    });
}

export function updateDebugStats(statsEl, chunksSize, camera) {
    const px = Math.floor(camera.position.x);
    const py = Math.floor(camera.position.y);
    const pz = Math.floor(camera.position.z);
    statsEl.innerText = `Chunks: ${chunksSize} | Pos: ${px}, ${py}, ${pz}`;
}

export function updateBiomeUI(biomeEl, macroValue) {
    let biomeStr = "";
    let bColor = "";
    
    if (macroValue < 0.25) { biomeStr = "Flat Plains"; bColor = "#a3e635"; }
    else if (macroValue < 0.45) { biomeStr = "Plains/Hills Transition"; bColor = "#84cc16"; }
    else if (macroValue < 0.60) { biomeStr = "Rolling Hills"; bColor = "#eab308"; }
    else if (macroValue < 0.80) { biomeStr = "Hills/Mountains Transition"; bColor = "#f97316"; }
    else { biomeStr = "High Alpine Mountains"; bColor = "#ef4444"; }
    
    biomeEl.innerHTML = `Current Biome Map: <span style="color: ${bColor}; font-weight:bold;">${biomeStr} (${macroValue.toFixed(2)})</span>`;
}

export function updateCrosshairBuildMode(isBuildMode) {
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.filter = isBuildMode ? 'hue-rotate(140deg)' : 'none';
    }
}

export function showSaveNotification(instructionsEl) {
    instructionsEl.innerText = "MAP SAVED!";
    instructionsEl.style.display = 'block';
    setTimeout(() => instructionsEl.style.display = 'none', 1000);
}