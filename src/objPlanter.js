///// src/objPlanter.js /////
//
// OBJECT PLANTER — Core Logic
// ──────────────────────────────────────────────────────────────────────────────
// Everything for placing and manipulating objects in the world lives here:
//   • Fly ↔ Planter mode toggling
//   • TransformControls (translate / rotate / scale gizmo)
//   • Object selection via raycasting
//   • Group multi-selection via Tag View 
//   • Spawn from OBJECT_REGISTRY inventory
//   • Delete selected object/group
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
let _selected     = null;    // currently selected THREE.Mesh OR THREE.Group
let _isDragging   = false;   // TransformControls gizmo drag in progress
let _tfMode       = 'translate';
let _clipboard    = null;    // memory for Ctrl+C / Ctrl+X ({ type: 'single'|'group', items: [] })

// Track the next available UUID (ensures IDs are endless and unique)
export let uuidHandler = 1;

// Multi-select grouping logic mechanism
const _selectionGroup = new THREE.Group();

// Object tracking: mesh → save-data entry (live reference to data[] element)
const _meshToEntry = new Map();

// Raycaster (for click-selection and terrain placement)
const _raycaster = new THREE.Raycaster();
const _mouse     = new THREE.Vector2();

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initPlanter(rendererDomElement) {
    scene.add(_selectionGroup); // Core group for multi-select transforms

    // ── TransformControls setup (mirrors 3dArena.html pattern) ────────────────
    _tc = new THREE.TransformControls(camera, rendererDomElement);
    _tc.setSize(0.8);
    _tc.setSpace('world');

    // Critical: while dragging the gizmo we block pointer events that would
    // accidentally deselect or re-pick objects
    _tc.addEventListener('dragging-changed', (e) => { _isDragging = e.value; });

    // Keep save data synced every frame while user drags gizmo
    _tc.addEventListener('objectChange', () => {
        if (_selected === _selectionGroup) {
            _selectionGroup.children.forEach(m => _syncToData(m));
        } else if (_selected) {
            _syncToData(_selected);
        }
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
            onGetTags:        getDistinctTags,
            onSelectTag:      selectByTag,
            onUpdateTag:      updateSelectionTag
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

// ─── TAGGING LOGIC ────────────────────────────────────────────────────────────

export function getDistinctTags() {
    const tags = new Set();
    for (const entry of _meshToEntry.values()) {
        if (entry.tag && entry.tag.trim() !== '') tags.add(entry.tag);
    }
    return Array.from(tags).sort();
}

export function selectByTag(tagName) {
    if (!_active) return;
    const meshes = [];
    for (const [mesh, entry] of _meshToEntry.entries()) {
        if (entry.tag === tagName) meshes.push(mesh);
    }
    if (meshes.length > 0) {
        _selectGroup(meshes);
    } else {
        _deselect();
    }
}

export function updateSelectionTag(newTag) {
    if (!_selected) return;
    
    // Assign tag to all children if it's a group, or single element
    if (_selected === _selectionGroup) {
        _selectionGroup.children.forEach(m => {
            const entry = _meshToEntry.get(m);
            if (entry) entry.tag = newTag;
        });
    } else {
        const entry = _meshToEntry.get(_selected);
        if (entry) entry.tag = newTag;
    }
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
    const spawnCenter = new THREE.Vector3(spawnX, terrainY + 2, spawnZ);

    if (_clipboard.type === 'single') {
        const cData = _clipboard.item;
        const mesh = await createObjectMesh(cData.type);
        if (!mesh) return;

        mesh.position.copy(spawnCenter);
        
        // Apply copied rotations and scales
        if (cData.rx != null) mesh.rotation.set(cData.rx, cData.ry, cData.rz);
        if (cData.sx != null) mesh.scale.set(cData.sx, cData.sy, cData.sz);

        scene.add(mesh);

        const entry = {
            uuid: uuidHandler++,
            tag: cData.tag || null,
            type: cData.type,
            x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
            rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z,
            sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z,
        };
        data.push(entry);
        _meshToEntry.set(mesh, entry);

        _select(mesh);

    } else if (_clipboard.type === 'group') {
        // Find geometric center of copied grouping array
        const box = new THREE.Box3();
        _clipboard.items.forEach(item => {
            box.expandByPoint(new THREE.Vector3(item.x, item.y, item.z));
        });
        const oldCenter = new THREE.Vector3();
        box.getCenter(oldCenter);
        
        // Offset to move everything synchronously to the newly viewed spawn coordinate
        const offset = new THREE.Vector3().subVectors(spawnCenter, oldCenter);
        const pastedMeshes = [];

        for (const cData of _clipboard.items) {
            const mesh = await createObjectMesh(cData.type);
            if (!mesh) continue;

            mesh.position.set(cData.x, cData.y, cData.z).add(offset);
            if (cData.rx != null) mesh.rotation.set(cData.rx, cData.ry, cData.rz);
            if (cData.sx != null) mesh.scale.set(cData.sx, cData.sy, cData.sz);

            scene.add(mesh);

            const entry = {
                uuid: uuidHandler++,
                tag: cData.tag || null,
                type: cData.type,
                x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
                rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z,
                sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z,
            };
            data.push(entry);
            _meshToEntry.set(mesh, entry);
            pastedMeshes.push(mesh);
        }

        if (pastedMeshes.length > 0) {
            _selectGroup(pastedMeshes);
        }
    }
}

// ─── SELECTION ────────────────────────────────────────────────────────────────
function _select(mesh) {
    _deselect();
    _selected = mesh;
    _tc.attach(mesh);
    _tc.setMode(_tfMode);
    DC.onObjectSelected(mesh, OBJECT_REGISTRY.get(mesh.userData.objectTypeId));
}

function _selectGroup(meshes) {
    _deselect();

    if (meshes.length === 1) {
        _select(meshes[0]);
        return;
    }

    // Align the gizmo group container directly at the center of target meshes
    const box = new THREE.Box3();
    meshes.forEach(m => box.expandByObject(m));
    const center = new THREE.Vector3();
    box.getCenter(center);

    _selectionGroup.position.copy(center);
    _selectionGroup.rotation.set(0, 0, 0);
    _selectionGroup.scale.set(1, 1, 1);

    meshes.forEach(m => _selectionGroup.attach(m));
    _selected = _selectionGroup;
    _tc.attach(_selectionGroup);
    _tc.setMode(_tfMode);
    
    DC.onGroupSelected(meshes.length);
}

function _deselect() {
    if (_selected === _selectionGroup) {
        // Return children to standard scene space smoothly, preserving exact world transform 
        while (_selectionGroup.children.length > 0) {
            scene.attach(_selectionGroup.children[0]);
        }
    }
    
    _selected = null;
    if (_tc) _tc.detach();
    DC.onObjectDeselected();
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export function deleteSelected() { 
    if (!_selected) return; 

    const meshesToDelete = _selected === _selectionGroup 
        ? [..._selectionGroup.children] 
        : [_selected];

    _deselect(); // safely detaches everything into scene before deletion

    meshesToDelete.forEach(mesh => {
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
                    if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
                    else node.material.dispose();
                }
            }
        });
    });
}

// ─── SYNC POSITION / ROTATION / SCALE → SAVE DATA ────────────────────────────
function _syncToData(mesh) {
    const entry = _meshToEntry.get(mesh);
    if (!entry) return;

    // Use getWorld extractions to be completely reliable when objects are inside groups
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    mesh.getWorldQuaternion(quat);
    mesh.getWorldScale(scale);
    
    const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

    entry.x = pos.x; 
    entry.y = pos.y; 
    entry.z = pos.z;
    entry.rx = euler.x; 
    entry.ry = euler.y; 
    entry.rz = euler.z;
    entry.sx = scale.x; 
    entry.sy = scale.y; 
    entry.sz = scale.z;
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
            if (_selected === _selectionGroup) {
                _clipboard = {
                    type: 'group',
                    items: _selectionGroup.children.map(m => JSON.parse(JSON.stringify(_meshToEntry.get(m))))
                };
            } else if (_selected) {
                _clipboard = {
                    type: 'single',
                    item: JSON.parse(JSON.stringify(_meshToEntry.get(_selected)))
                };
            }
            return;
        }
        if (e.code === 'KeyX') {
            if (_selected === _selectionGroup) {
                _clipboard = {
                    type: 'group',
                    items: _selectionGroup.children.map(m => JSON.parse(JSON.stringify(_meshToEntry.get(m))))
                };
                deleteSelected();
            } else if (_selected) {
                _clipboard = {
                    type: 'single',
                    item: JSON.parse(JSON.stringify(_meshToEntry.get(_selected)))
                };
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
                if (_selected === _selectionGroup) {
                    _selectionGroup.children.forEach(m => _syncToData(m));
                } else {
                    _syncToData(_selected);
                }
                DC.updateSelectedInfo(_selected);
            }
            break;
        case 'BracketLeft': // [ → scale down 10%
            if (_selected) {
                _selected.scale.multiplyScalar(0.909);
                if (_selected === _selectionGroup) {
                    _selectionGroup.children.forEach(m => _syncToData(m));
                } else {
                    _syncToData(_selected);
                }
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