///// src/objPlanter.js /////
//
// OBJECT PLANTER — Core Logic
// ──────────────────────────────────────────────────────────────────────────────
// Everything for placing and manipulating objects in the world lives here:
//   • Fly ↔ Planter mode toggling
//   • TransformControls (translate / rotate / scale gizmo)
//   • Object selection via raycasting
//   • Spawn from OBJECT_REGISTRY inventory
//   • Delete selected object
//   • Runtime ↔ save-data sync
//
// UI is NEVER touched directly here — all feedback goes through DebugController.
// ──────────────────────────────────────────────────────────────────────────────

import { scene, chunks }              from './map/mainMap.js';
import { camera, setPlanterModeFlag }  from './camera/debugCamera.js';
import * as DC                         from '../ui/debug/debugController.js';
import { OBJECT_REGISTRY, createObjectMesh } from '../assets/objects.js';
import { data }                        from '../config.js';

// ─── STATE ───────────────────────────────────────────────────────────────────
let _active       = false;   // true = planter mode, false = fly mode
let _tc           = null;    // THREE.TransformControls instance
let _selected     = null;    // currently selected THREE.Mesh
let _isDragging   = false;   // TransformControls gizmo drag in progress
let _tfMode       = 'translate';
let _clipboard    = null;    // memory for Ctrl+C / Ctrl+X

// Track the next available UUID (ensures IDs are endless and unique)
export let uuidHandler = 1;

// Object tracking: mesh → save-data entry (live reference to data[] element)
const _meshToEntry = new Map();

// Raycaster (for click-selection and terrain placement)
const _raycaster = new THREE.Raycaster();
const _mouse     = new THREE.Vector2();

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initPlanter(rendererDomElement) {
    // ── TransformControls setup (mirrors 3dArena.html pattern) ────────────────
    _tc = new THREE.TransformControls(camera, rendererDomElement);
    _tc.setSize(0.8);
    _tc.setSpace('world');

    // Critical: while dragging the gizmo we block pointer events that would
    // accidentally deselect or re-pick objects
    _tc.addEventListener('dragging-changed', (e) => { _isDragging = e.value; });

    // Keep save data synced every frame while user drags gizmo
    _tc.addEventListener('objectChange', () => {
        if (_selected) _syncToData(_selected);
        DC.updateSelectedInfo(_selected);
    });

    scene.add(_tc);

    // ── Wire planter UI through DebugController ───────────────────────────────
    DC.initPlanterUI(
        {
            onToggle:         togglePlanterMode,
            onTransformMode:  setTransformMode,
            onDelete:         deleteSelected,
            onSpawn:          spawnFromInventory,
        },
        OBJECT_REGISTRY
    );

    // ── Global input listeners ─────────────────────────────────────────────────
    document.addEventListener('pointerdown', _onPointerDown);
    document.addEventListener('keydown',     _onKeyDown);
}

// ─── LOAD SAVED OBJECTS ───────────────────────────────────────────────────────
export function loadSavedObjects() { 
    data.forEach(async (entry) => { 
        // Update the UUID handler to always be +1 higher than the highest existing object
        if (entry.uuid && entry.uuid >= uuidHandler) {
            uuidHandler = entry.uuid + 1;
        }

        const mesh = await createObjectMesh(entry.type || 'basic_block'); 
        if (!mesh) return; 

        mesh.position.set(entry.x ?? 0, entry.y ?? 0, entry.z ?? 0); 
        if (entry.rx != null) mesh.rotation.set(entry.rx, entry.ry, entry.rz); 
        if (entry.sx != null) mesh.scale.set(entry.sx, entry.sy, entry.sz); 
        
        scene.add(mesh); 
        _meshToEntry.set(mesh, entry); 
    }); 
}

// ─── MODE TOGGLE ──────────────────────────────────────────────────────────────
export function togglePlanterMode() {
    _active = !_active;

    if (_active) {
        if (document.pointerLockElement) document.exitPointerLock();
        setPlanterModeFlag(true);
    } else {
        _deselect();
        setPlanterModeFlag(false);
    }

    DC.onPlanterModeChanged(_active);
}

export function isPlanterActive() { return _active; }

// ─── TRANSFORM MODE ───────────────────────────────────────────────────────────
export function setTransformMode(mode) {
    _tfMode = mode;
    if (_tc) _tc.setMode(mode);
}

// ─── SPAWN FROM INVENTORY ─────────────────────────────────────────────────────
export async function spawnFromInventory(typeId) { 
    if (!_active) return; // safety guard

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const spawnDist = 400; 
    const spawnX = camera.position.x + forward.x * spawnDist;
    const spawnZ = camera.position.z + forward.z * spawnDist;

    // Grab terrain height before await so we don't drift if camera moves
    const terrainY = _getTerrainHeightAt(spawnX, spawnZ);

    // Await the new async loader
    const mesh = await createObjectMesh(typeId);
    if (!mesh) return;

    mesh.position.set(spawnX, terrainY + 2, spawnZ);
    scene.add(mesh);

    // Generate the incremental UUID and pull current input Tag directly from UI
    const currentUUID = uuidHandler++;
    const currentTag = DC.getCurrentTag();

    // Register in save data
    const entry = {
        uuid: currentUUID,
        tag: currentTag,
        type: typeId,
        x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
        rx: 0, ry: 0, rz: 0,
        sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z,
    };
    data.push(entry);
    _meshToEntry.set(mesh, entry);

    _select(mesh);
}

// ─── PASTE FROM CLIPBOARD (CTRL+V) ────────────────────────────────────────────
async function pasteObject() {
    if (!_active || !_clipboard) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const spawnDist = 400; 
    const spawnX = camera.position.x + forward.x * spawnDist;
    const spawnZ = camera.position.z + forward.z * spawnDist;

    const terrainY = _getTerrainHeightAt(spawnX, spawnZ);

    const mesh = await createObjectMesh(_clipboard.type);
    if (!mesh) return;

    mesh.position.set(spawnX, terrainY + 2, spawnZ);
    
    // Apply copied rotations and scales
    if (_clipboard.rx != null) mesh.rotation.set(_clipboard.rx, _clipboard.ry, _clipboard.rz);
    if (_clipboard.sx != null) mesh.scale.set(_clipboard.sx, _clipboard.sy, _clipboard.sz);

    scene.add(mesh);

    const currentUUID = uuidHandler++;
    const currentTag = _clipboard.tag || null;

    const entry = {
        uuid: currentUUID,
        tag: currentTag,
        type: _clipboard.type,
        x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
        rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z,
        sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z,
    };
    data.push(entry);
    _meshToEntry.set(mesh, entry);

    _select(mesh);
}

// ─── SELECTION ────────────────────────────────────────────────────────────────
function _select(mesh) {
    _selected = mesh;
    _tc.attach(mesh);
    _tc.setMode(_tfMode);
    DC.onObjectSelected(mesh, OBJECT_REGISTRY.get(mesh.userData.objectTypeId));
}

function _deselect() {
    _selected = null;
    if (_tc) _tc.detach();
    DC.onObjectDeselected();
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export function deleteSelected() { 
    if (!_selected) return; 
    const mesh = _selected; 
    _deselect();

    scene.remove(mesh);

    const entry = _meshToEntry.get(mesh);
    if (entry) {
        const idx = data.indexOf(entry);
        if (idx !== -1) data.splice(idx, 1);
        _meshToEntry.delete(mesh);
    }

    mesh.traverse((node) => {
        if (node.isMesh) {
            if (node.geometry) node.geometry.dispose();
            if (node.material) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(m => m.dispose());
                } else {
                    node.material.dispose();
                }
            }
        }
    });
}

// ─── SYNC POSITION / ROTATION / SCALE → SAVE DATA ────────────────────────────
function _syncToData(mesh) {
    const entry = _meshToEntry.get(mesh);
    if (!entry) return;
    entry.x = mesh.position.x;
    entry.y = mesh.position.y;
    entry.z = mesh.position.z;
    entry.rx = mesh.rotation.x;
    entry.ry = mesh.rotation.y;
    entry.rz = mesh.rotation.z;
    entry.sx = mesh.scale.x;
    entry.sy = mesh.scale.y;
    entry.sz = mesh.scale.z;
}

// ─── POINTER DOWN ─────────────────────────────────────────────────────────────
function _onPointerDown(e) { 
    if (!_active) return;
    if (_isDragging) return; 
    if (e.target.closest('#planter-panel') || e.target.closest('button')) return;

    _mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);

    const placed = Array.from(_meshToEntry.keys());
    
    const hits = _raycaster.intersectObjects(placed, true); 
    if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj && !_meshToEntry.has(hitObj)) {
            hitObj = hitObj.parent;
        }
        
        if (hitObj) {
            _select(hitObj);
            return;
        }
    }

    const terrainMeshes = Array.from(chunks.values());
    const terrainHits   = _raycaster.intersectObjects(terrainMeshes, false);
    if (terrainHits.length > 0) {
        _deselect();
    }
}

// ─── KEY DOWN — shortcuts ─────────────────────────────────────────────────────
function _onKeyDown(e) {
    if (e.code === 'Tab') {
        e.preventDefault();
        togglePlanterMode();
        return;
    }

    if (!_active) return;

    // Notice we ignore keys if the user is typing in the Tag input field!
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    // Clipboard handlers
    if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyC') {
            if (_selected) {
                const entry = _meshToEntry.get(_selected);
                if (entry) _clipboard = JSON.parse(JSON.stringify(entry));
            }
            return;
        }
        if (e.code === 'KeyX') {
            if (_selected) {
                const entry = _meshToEntry.get(_selected);
                if (entry) _clipboard = JSON.parse(JSON.stringify(entry));
                deleteSelected();
            }
            return;
        }
        if (e.code === 'KeyV') {
            if (_clipboard) pasteObject();
            return;
        }
    }

    switch (e.code) {
        case 'KeyT':      setTransformMode('translate'); break;
        case 'KeyR':      setTransformMode('rotate');    break;
        case 'KeyS':      setTransformMode('scale');     break;
        case 'Delete':
        case 'Backspace': deleteSelected();              break;
        case 'Escape':    _deselect();                   break;

        case 'BracketRight': // ] → scale up 10%
            if (_selected) {
                _selected.scale.multiplyScalar(1.1);
                _syncToData(_selected);
                DC.updateSelectedInfo(_selected);
            }
            break;
        case 'BracketLeft': // [ → scale down 10%
            if (_selected) {
                _selected.scale.multiplyScalar(0.909);
                _syncToData(_selected);
                DC.updateSelectedInfo(_selected);
            }
            break;
    }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function _getTerrainHeightAt(x, z) {
    const origin = new THREE.Vector3(x, 2000, z);
    const dir    = new THREE.Vector3(0, -1, 0);
    _raycaster.set(origin, dir);
    const terrainMeshes = Array.from(chunks.values());
    const hits = _raycaster.intersectObjects(terrainMeshes, false);
    return hits.length > 0 ? hits[0].point.y : 0;
}