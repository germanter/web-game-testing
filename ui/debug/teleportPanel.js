let _onTeleport = null;
let _getLocTagsData = null;
let _isOpen = false;

export function initTeleportPanel(onTeleportCb, getLocTagsDataCb) {
    _onTeleport = onTeleportCb;
    _getLocTagsData = getLocTagsDataCb;

    // Inject styles specifically for the teleport panel
    const style = document.createElement('style');
    style.textContent = `
        #tp-modal {
            display: none; position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(18, 22, 28, 0.95); padding: 20px;
            border-radius: 12px; z-index: 200; border: 1px solid #3b82f6;
            color: #fff; width: 320px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            font-family: sans-serif; backdrop-filter: blur(8px);
        }
        #tp-modal h3 { margin: 0; color: #4ade80; font-size: 18px; }
        #tp-close {
            background: transparent; border: none; color: #ef4444;
            cursor: pointer; font-size: 16px; font-weight: bold; transition: 0.1s;
        }
        #tp-close:hover { color: #f87171; transform: scale(1.1); }
        .tp-input-group { display: flex; gap: 10px; margin-top: 15px; }
        .tp-input-group label { display: flex; flex-direction: column; font-size: 12px; color: #94a3b8; }
        .tp-input-group input {
            width: 60px; background: #1e293b; border: 1px solid #334155;
            color: #fff; padding: 6px; border-radius: 6px; outline: none;
        }
        .tp-input-group input:focus { border-color: #3b82f6; }
        #tp-go {
            margin-top: 16px; padding: 0 15px; background: #3b82f6; font-weight: bold;
            border: none; color: #fff; border-radius: 6px; cursor: pointer; transition: 0.15s;
        }
        #tp-go:hover { background: #2563eb; }
        #tp-search {
            width: 100%; background: #1e293b; border: 1px solid #334155;
            color: #fff; padding: 8px; border-radius: 6px; box-sizing: border-box; outline: none;
        }
        #tp-search:focus { border-color: #4ade80; }
        #tp-results {
            max-height: 140px; overflow-y: auto; margin-top: 8px;
            display: flex; flex-direction: column; gap: 4px;
        }
        .tp-result-item {
            background: #1e2530; padding: 8px; border-radius: 6px;
            font-size: 12px; color: #cbd5e1; cursor: pointer; border: 1px solid transparent; transition: 0.1s;
        }
        .tp-result-item:hover { border-color: #4ade80; background: #2a3040; color: #fff; }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'tp-modal';
    modal.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>📍 Teleport</h3>
            <button id="tp-close" title="Close Panel">X</button>
        </div>
        <div class="tp-input-group">
            <label>X: <input id="tp-x" type="number" value="0"></label>
            <label>Y: <input id="tp-y" type="number" value="300"></label>
            <label>Z: <input id="tp-z" type="number" value="0"></label>
            <button id="tp-go">Go</button>
        </div>
        <hr style="border-color:#334155; margin:15px 0;">
        <div>
            <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:5px;">Location Tag Search (*-loc):</label>
            <input id="tp-search" type="text" placeholder="Search loc tags...">
            <div id="tp-results"></div>
        </div>
    `;
    document.body.appendChild(modal);

    // Manual Event Listeners
    document.getElementById('tp-close').addEventListener('click', closeTeleportPanel);
    
    document.getElementById('tp-go').addEventListener('click', () => {
        const x = parseFloat(document.getElementById('tp-x').value) || 0;
        const y = parseFloat(document.getElementById('tp-y').value) || 0;
        const z = parseFloat(document.getElementById('tp-z').value) || 0;
        if (_onTeleport) _onTeleport(x, y, z);
        closeTeleportPanel();
    });

    const searchInput = document.getElementById('tp-search');
    searchInput.addEventListener('input', (e) => {
        renderResults(e.target.value.trim().toLowerCase());
    });
}

function renderResults(filterText) {
    const resultsContainer = document.getElementById('tp-results');
    resultsContainer.innerHTML = '';
    if (!_getLocTagsData) return;

    const allLocs = _getLocTagsData();
    const filtered = filterText ? allLocs.filter(item => item.tag.toLowerCase().includes(filterText)) : allLocs;

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="color:#64748b; font-size:11px; padding:4px;">No matching -loc tags found.</div>';
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tp-result-item';
        div.textContent = item.tag;
        div.addEventListener('click', () => {
            // Support both config structures (px/py/pz or position.x/y/z) safely
            const tx = item.px !== undefined ? item.px : (item.x !== undefined ? item.x : (item.position?.x || 0));
            const tz = item.pz !== undefined ? item.pz : (item.z !== undefined ? item.z : (item.position?.z || 0));
            
            // Per requirements, strictly handwriting Y to 400
            if (_onTeleport) _onTeleport(tx, 400, tz); 
            closeTeleportPanel();
        });
        resultsContainer.appendChild(div);
    });
}

export function toggleTeleportPanel() {
    if (_isOpen) closeTeleportPanel();
    else openTeleportPanel();
}

export function openTeleportPanel() {
    _isOpen = true;
    const modal = document.getElementById('tp-modal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('tp-search').value = '';
        renderResults('');
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        setTimeout(() => document.getElementById('tp-search').focus(), 50);
    }
}

export function closeTeleportPanel() {
    _isOpen = false;
    const modal = document.getElementById('tp-modal');
    if (modal) modal.style.display = 'none';
}