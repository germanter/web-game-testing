///// ui/debug/debugController.js /////
import { SYSTEM, UI_BIOME } from '../../src/global.js';

//
// THE ONLY UI EXPORT GATE
// ──────────────────────────────────────────────────────────────────────────────
// ALL DOM elements are created and owned here.
// No other file is allowed to touch document.body for UI directly.
// Other modules (objPlanter, initMap) call functions here to set up their UI.
// ──────────────────────────────────────────────────────────────────────────────

// ─── INTERNAL ELEMENT REFS ───────────────────────────────────────────────────
const _el = {};

// ─── STYLE SHEET ─────────────────────────────────────────────────────────────
function _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* ── Debug Overlay ────────────────────────────────────────────── */
        #dbg-instructions {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(10, 15, 20, 0.88);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            color: #fff; cursor: pointer; z-index: 100;
            transition: opacity 0.3s;
        }
        #dbg-instructions h1 {
            font-size: 3rem; margin-bottom: 0.5rem;
            background: -webkit-linear-gradient(45deg, #4ade80, #3b82f6);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        #dbg-instructions p { font-size: 1.1rem; color: #cbd5e1; margin: 0.3rem 0; text-align: center; }
        .dbg-controls-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 10px 40px;
            margin-top: 25px; background: rgba(0,0,0,0.4);
            padding: 18px 36px; border-radius: 12px; border: 1px solid #334155;
        }
        .dbg-controls-grid div { display: flex; justify-content: space-between; width: 210px; }
        .dbg-key {
            background: #1e293b; padding: 2px 8px; border-radius: 4px;
            color: #38bdf8; font-weight: bold; border: 1px solid #475569;
        }
        #dbg-hud {
            position: absolute; top: 15px; left: 15px;
            color: rgba(255,255,255,0.9); pointer-events: none;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.9); z-index: 5;
            font-size: 13px; background: rgba(0,0,0,0.45);
            padding: 10px 14px; border-radius: 8px; line-height: 1.6;
        }
        #dbg-crosshair {
            position: absolute; top: 50%; left: 50%;
            width: 12px; height: 12px;
            transform: translate(-50%, -50%);
            pointer-events: none; z-index: 5; transition: filter 0.2s;
        }
        #dbg-crosshair::before, #dbg-crosshair::after {
            content: ''; position: absolute; background: rgba(255,255,255,0.65);
        }
        #dbg-crosshair::before { top: 5px; left: 0; width: 12px; height: 2px; }
        #dbg-crosshair::after  { top: 0; left: 5px; width: 2px; height: 12px; }

        /* ── Planter Panel ─────────────────────────────────────────────── */
        #planter-panel {
            position: absolute; top: 20px; right: 20px;
            width: 240px; max-height: 90vh; overflow-y: auto;
            background: rgba(18, 22, 28, 0.92);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 6px 28px rgba(0,0,0,0.7);
            border-radius: 12px; padding: 14px 16px;
            box-sizing: border-box; z-index: 20;
            display: none; /* shown only in planter mode */
            color: #ddd; font-size: 13px;
        }
        #planter-panel h3 {
            margin: 0 0 10px 0; font-size: 15px;
            color: #ffb84d; text-align: center; letter-spacing: 0.5px;
        }
        .pp-section-title {
            font-size: 10px; text-transform: uppercase; color: #778;
            margin: 12px 0 5px 0; border-bottom: 1px solid #2a2f3a;
            padding-bottom: 3px; letter-spacing: 0.6px;
        }
        .pp-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        .pp-btn {
            flex: 1; min-width: 60px; padding: 8px 6px;
            background: #1e2530; border: 1px solid #3a4050;
            color: #ccd; border-radius: 6px; cursor: pointer;
            font-size: 12px; font-weight: 500; text-align: center;
            transition: all 0.15s; white-space: nowrap;
        }
        .pp-btn:hover { background: #2a3040; border-color: #556; transform: translateY(-1px); }
        .pp-btn:active { transform: scale(0.96); }
        .pp-btn.active-tf  { background: #ffb84d; color: #1a1a1a; border-color: #ffb84d; }
        .pp-btn.active-inv { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .pp-btn.btn-delete { border-left: 3px solid #ef4444; }
        .pp-btn.btn-delete:hover { background: #2d1a1a; }
        .pp-btn.btn-mode-toggle { border-left: 3px solid #4ade80; width: 100%; }
        .pp-btn.btn-mode-toggle.planter-active {
            background: #4ade80; color: #111; border-color: #4ade80;
        }
        #pp-selected-info {
            margin-top: 8px; padding: 7px 10px;
            background: rgba(255,255,255,0.04); border-radius: 6px;
            border: 1px solid #2a3040; font-size: 11px; color: #99a;
            min-height: 26px;
        }
        /* Fly-mode hint shown at bottom-right when NOT in planter mode */
        #planter-hint {
            position: absolute; bottom: 20px; right: 20px;
            background: rgba(0,0,0,0.55); color: #667;
            padding: 8px 14px; border-radius: 8px;
            font-size: 12px; pointer-events: none; z-index: 5;
        }
    `;
    document.head.appendChild(style);
}

// ─── INIT ALL UI ─────────────────────────────────────────────────────────────
// Called once from initMap.js. Creates everything.
export function initAllUI(worldSeed) {
    _injectStyles();

    if (SYSTEM.DEBUG) {
        _createDebugHUD(worldSeed);
        _createCrosshair();
        _createInstructions();
        _createPlanterHint();
    }

    // Planter panel always exists (even in production you'd have some build UI)
    _createPlanterPanel();
}

// ─── DEBUG HUD ────────────────────────────────────────────────────────────────
function _createDebugHUD(worldSeed) {
    const hud = document.createElement('div');
    hud.id = 'dbg-hud';
    hud.innerHTML = `
        <div id="dbg-seed" style="color:#38bdf8;font-weight:bold;margin-bottom:3px;">
            World Seed: "${worldSeed}"
        </div>
        <div id="dbg-stats">Chunks: 0 | Pos: 0, 0, 0</div>
        <div id="dbg-biome" style="color:#4ade80;margin-top:3px;">Biome: Calculating…</div>
    `;
    document.body.appendChild(hud);
    _el.hud   = hud;
    _el.stats = hud.querySelector('#dbg-stats');
    _el.biome = hud.querySelector('#dbg-biome');
}

function _createCrosshair() {
    const ch = document.createElement('div');
    ch.id = 'dbg-crosshair';
    document.body.appendChild(ch);
    _el.crosshair = ch;
}

function _createPlanterHint() {
    const hint = document.createElement('div');
    hint.id = 'planter-hint';
    hint.innerHTML = `<b>[Tab]</b> Enter Planter Mode`;
    document.body.appendChild(hint);
    _el.planterHint = hint;
}

// ─── POINTER LOCK INSTRUCTIONS OVERLAY ───────────────────────────────────────
function _createInstructions() {
    const el = document.createElement('div');
    el.id = 'dbg-instructions';
    el.innerHTML = `
        <h1>World Builder</h1>
        <p>Click anywhere to start flying</p>
        <div class="dbg-controls-grid">
            <div><span>Look Around</span>    <span class="dbg-key">Mouse</span></div>
            <div><span>Move Fwd / Back</span><span class="dbg-key">W / S</span></div>
            <div><span>Strafe L / R</span>   <span class="dbg-key">A / D</span></div>
            <div><span>Ascend / Descend</span><span class="dbg-key">E / Q</span></div>
            <div><span>Sprint</span>         <span class="dbg-key">Shift</span></div>
            <div><span>Planter Mode</span>   <span class="dbg-key">Tab</span></div>
        </div>
        <p style="margin-top:20px;color:#475569;font-size:0.9rem;">Press Tab to open the object planter without locking pointer</p>
    `;
    document.body.appendChild(el);
    _el.instructions = el;
}

// Called from initMap.js – wires pointer lock to the overlay
export function setupPointerLockUI(canLockFn) {
    if (!_el.instructions) return;

    _el.instructions.addEventListener('click', () => {
        if (!canLockFn || canLockFn()) {
            document.body.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            _el.instructions.style.opacity = '0';
            setTimeout(() => { _el.instructions.style.display = 'none'; }, 300);
        } else {
            // Only show the overlay if this unlock was NOT caused by entering
            // planter mode. canLockFn() returns false while planter is active.
            if (!canLockFn || canLockFn()) {
                _el.instructions.style.display = 'flex';
                setTimeout(() => { _el.instructions.style.opacity = '1'; }, 10);
            }
        }
    });
}

// ─── PLANTER PANEL ────────────────────────────────────────────────────────────
// _planterCallbacks is set by initPlanterUI() when objPlanter initialises
let _planterCbs = {};
let _currentTfMode = 'translate';
let _activeInvBtn  = null;

function _createPlanterPanel() {
    const panel = document.createElement('div');
    panel.id = 'planter-panel';
    panel.innerHTML = `
        <h3>🛠 Object Planter</h3>

        <div class="pp-section-title">Mode</div>
        <div class="pp-row">
            <button id="pp-mode-toggle" class="pp-btn btn-mode-toggle">🚀 Fly Mode (Tab)</button>
        </div>

        <div class="pp-section-title">Transform</div>
        <div class="pp-row">
            <button id="pp-tf-translate" class="pp-btn active-tf" title="Move object [T]">↔ Move</button>
            <button id="pp-tf-rotate"    class="pp-btn"           title="Rotate object [R]">↻ Rotate</button>
            <button id="pp-tf-scale"     class="pp-btn"           title="Scale object [S]">⤡ Scale</button>
        </div>
        <div class="pp-row">
            <button id="pp-delete" class="pp-btn btn-delete" title="Delete selected [Del]">🗑 Delete</button>
        </div>

        <div id="pp-selected-info">No object selected</div>

        <div class="pp-section-title">Inventory</div>
        <div id="pp-inventory" class="pp-row"></div>
    `;
    document.body.appendChild(panel);
    _el.planterPanel = panel;

    // Bind static buttons (callbacks injected later by initPlanterUI)
    panel.querySelector('#pp-mode-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        _planterCbs.onToggle?.();
    });
    panel.querySelector('#pp-tf-translate').addEventListener('click', (e) => {
        e.stopPropagation(); _setTfMode('translate');
    });
    panel.querySelector('#pp-tf-rotate').addEventListener('click', (e) => {
        e.stopPropagation(); _setTfMode('rotate');
    });
    panel.querySelector('#pp-tf-scale').addEventListener('click', (e) => {
        e.stopPropagation(); _setTfMode('scale');
    });
    panel.querySelector('#pp-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        _planterCbs.onDelete?.();
    });
}

function _setTfMode(mode) {
    _currentTfMode = mode;
    const map = { translate: '#pp-tf-translate', rotate: '#pp-tf-rotate', scale: '#pp-tf-scale' };
    ['translate','rotate','scale'].forEach(m => {
        _el.planterPanel.querySelector(map[m]).classList.toggle('active-tf', m === mode);
    });
    _planterCbs.onTransformMode?.(mode);
}

// Called by objPlanter.initPlanter() — wires live callbacks and builds inventory
export function initPlanterUI(callbacks, objectRegistry) {
    _planterCbs = callbacks;

    // Build inventory buttons from registry
    const container = _el.planterPanel.querySelector('#pp-inventory');
    container.innerHTML = '';

    // Group by category
    const categories = new Map();
    for (const [id, def] of objectRegistry) {
        if (!categories.has(def.category)) categories.set(def.category, []);
        categories.get(def.category).push(def);
    }

    for (const [cat, defs] of categories) {
        const title = document.createElement('div');
        title.className = 'pp-section-title';
        title.style.width = '100%';
        title.textContent = cat;
        container.parentNode.insertBefore(title, container);

        defs.forEach(def => {
            const btn = document.createElement('button');
            btn.className = 'pp-btn';
            btn.title = def.name;
            btn.textContent = `${def.icon} ${def.name}`;
            btn.style.width = '100%';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Toggle active highlight
                if (_activeInvBtn) _activeInvBtn.classList.remove('active-inv');
                _activeInvBtn = btn;
                btn.classList.add('active-inv');
                _planterCbs.onSpawn?.(def.id);
            });
            container.appendChild(btn);
        });
    }
}

// ─── PUBLIC UPDATE FUNCTIONS (called from objPlanter / initMap) ───────────────

export function onPlanterModeChanged(isActive) {
    if (_el.planterPanel) {
        _el.planterPanel.style.display = isActive ? 'block' : 'none';
    }
    if (_el.crosshair) {
        _el.crosshair.style.display = isActive ? 'none' : 'block';
    }
    if (_el.planterHint) {
        _el.planterHint.style.display = isActive ? 'none' : 'block';
    }
    const btn = document.getElementById('pp-mode-toggle');
    if (btn) {
        if (isActive) {
            btn.textContent = '🌍 Fly Mode (Tab)';
            btn.classList.add('planter-active');
        } else {
            btn.textContent = '🚀 Enter Planter (Tab)';
            btn.classList.remove('planter-active');
        }
    }

    // --- FIX: Manage pointer lock state seamlessly ---
    if (!isActive) {
        // Re-lock the mouse to document body when returning to fly mode
        document.body.requestPointerLock();
    } else {
        // Ensure the mouse is unlocked when opening the planter panel
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
}

export function onObjectSelected(mesh, def) {
    const el = document.getElementById('pp-selected-info');
    if (!el) return;
    const name = def ? `${def.icon} ${def.name}` : mesh.userData.objectTypeId || 'Unknown';
    const p = mesh.position;
    el.innerHTML = `
        <b style="color:#dde">${name}</b><br>
        <span style="color:#667">
            x:${p.x.toFixed(0)} y:${p.y.toFixed(0)} z:${p.z.toFixed(0)}
        </span>
    `;
}

export function onObjectDeselected() {
    const el = document.getElementById('pp-selected-info');
    if (el) el.textContent = 'No object selected';
    if (_activeInvBtn) {
        _activeInvBtn.classList.remove('active-inv');
        _activeInvBtn = null;
    }
}

// Called each frame to update position while dragging
export function updateSelectedInfo(mesh) {
    if (!mesh) return;
    const el = document.getElementById('pp-selected-info');
    if (!el) return;
    const p = mesh.position;
    const existingName = el.querySelector('b');
    if (existingName) {
        el.querySelector('span').textContent =
            `x:${p.x.toFixed(0)} y:${p.y.toFixed(0)} z:${p.z.toFixed(0)}`;
    }
}

export function updateDebugStats(statsEl, chunksSize, camera) {
    if (!statsEl) return;
    const px = Math.floor(camera.position.x);
    const py = Math.floor(camera.position.y);
    const pz = Math.floor(camera.position.z);
    statsEl.innerText = `Chunks: ${chunksSize} | Pos: ${px}, ${py}, ${pz}`;
}

export function updateBiomeUI(biomeEl, macroValue) {
    if (!biomeEl) return;
    let biomeStr, bColor;
    if      (macroValue < UI_BIOME.plainsMax)      { biomeStr = UI_BIOME.plainsName;      bColor = UI_BIOME.plainsColor; }
    else if (macroValue < UI_BIOME.plainsHillsMax) { biomeStr = UI_BIOME.plainsHillsName; bColor = UI_BIOME.plainsHillsColor; }
    else if (macroValue < UI_BIOME.hillsMax)       { biomeStr = UI_BIOME.hillsName;       bColor = UI_BIOME.hillsColor; }
    else if (macroValue < UI_BIOME.hillsMountMax)  { biomeStr = UI_BIOME.hillsMountName;  bColor = UI_BIOME.hillsMountColor; }
    else                                           { biomeStr = UI_BIOME.mountainsName;   bColor = UI_BIOME.mountainsColor; }
    biomeEl.innerHTML =
        `Biome: <span style="color:${bColor};font-weight:bold;">${biomeStr} (${macroValue.toFixed(2)})</span>`;
}

export function updateCrosshairBuildMode(isBuildMode) {
    if (_el.crosshair) {
        _el.crosshair.style.filter = isBuildMode ? 'hue-rotate(140deg)' : 'none';
    }
}

export function showSaveNotification() {
    // Temporary banner – doesn't hijack instructions overlay
    let banner = document.getElementById('save-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'save-banner';
        Object.assign(banner.style, {
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(74,222,128,0.15)', border: '1px solid #4ade80',
            color: '#4ade80', padding: '14px 30px', borderRadius: '10px',
            fontSize: '20px', fontWeight: 'bold', zIndex: '50',
            pointerEvents: 'none',
        });
        document.body.appendChild(banner);
    }
    banner.textContent = '✓ Map Saved!';
    banner.style.opacity = '1';
    clearTimeout(banner._t);
    banner._t = setTimeout(() => { banner.style.opacity = '0'; }, 1500);
}

// Expose element references for modules that need them (read-only via getter)
export function getStatsEl()  { return _el.stats; }
export function getBiomeEl()  { return _el.biome; }