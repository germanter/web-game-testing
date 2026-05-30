///// src/objPlanter.js /////
import { scene, chunks }              from './map/mainMap.js';
import { camera }                      from './camera/customCamera.js';
import { setPlanterModeFlag }          from './controls/mainControl.js';
import * as DC                         from '../ui/debug/debugController.js';
import { OBJECT_REGISTRY, createObjectMesh } from '../assets/objects.js';
import { data, camData }               from '../config.js';
import { openColModModal }             from '../ui/debug/colmodModal.js';
import { CAMERA_HELPER }               from './global.js';
import { cloneColliderArray, ensureEntryColliders, rebuildColliderNodes } from './collision/collisionColliderForPlanted.js';

let _active       = false;   
let _tc           = null;    
let _selected     = null;    
let _isDragging   = false;   
let _tfMode       = 'translate';
let _clipboard    = null;    
let _saveMapToDisk = null;
let _colmodOpen = false;

export let uuidHandler = 1;
let _camIdHandler = 2; // ID 1 is reserved for ghost fly cam

const _selectionGroup = new THREE.Group();
const _meshToEntry = new Map();
const _raycaster = new THREE.Raycaster();
const _mouse     = new THREE.Vector2();

let _activeCamHelpers = new Map();
let _selectedCamHelper = null;
let _camTfMode = 'translate';

export function initPlanter(rendererDomElement, saveMapToDisk) {
    _saveMapToDisk = saveMapToDisk;
    scene.add(_selectionGroup); 

    _tc = new THREE.TransformControls(camera, rendererDomElement);
    _tc.setSize(0.8);
    _tc.setSpace('world');

    _tc.addEventListener('dragging-changed', (e) => { _isDragging = e.value; });

    _tc.addEventListener('objectChange', () => {
        if (DC.isCamViewActive()) {
            if (_selectedCamHelper) {
                const cId = _selectedCamHelper.userData.camId;
                const cData = camData.find(c => c.id === cId);
                if (cData) {
                    cData.lx = _selectedCamHelper.position.x;
                    cData.ly = _selectedCamHelper.position.y;
                    cData.lz = _selectedCamHelper.position.z;
                    cData.rx = _selectedCamHelper.rotation.x;
                    cData.ry = _selectedCamHelper.rotation.y;
                    cData.rz = _selectedCamHelper.rotation.z;
                }
            }
        } else {
            if (_selected === _selectionGroup) {
                _selectionGroup.children.forEach(m => _syncToData(m));
            } else if (_selected) {
                _syncToData(_selected);
            }
            DC.updateSelectedInfo(_selected);
        }
    });

    scene.add(_tc);

    DC.initPlanterUI(
        {
            onToggle:         togglePlanterMode,
            onTransformMode:  setTransformMode,
            onDelete:         deleteSelected,
            onSpawn:          spawnFromInventory,
            onGetTags:        getDistinctTags,
            onSelectTag:      selectByTag,
            onUpdateTag:      updateSelectionTag,
            onOpenColMod:     openColModForSelection,
            onAddCamera:      addCameraToSelected,
            onSelectCamera:   selectCameraHelper,
            onSetCamTfMode:   setCamTransformMode,
            onDeleteCamera:   deleteSelectedCamera,
            onCamViewToggled: toggleCamView
        },
        OBJECT_REGISTRY
    );

    document.addEventListener('pointerdown', _onPointerDown);
    document.addEventListener('keydown',     _onKeyDown);
}

export function loadSavedObjects() { 
    data.forEach(async (entry) => { 
        if (entry.uuid && entry.uuid >= uuidHandler) {
            uuidHandler = entry.uuid + 1;
        }

        const mesh = await createObjectMesh(entry.type || 'basic_block'); 
        if (!mesh) return; 

        mesh.userData.uuid = entry.uuid; 
        mesh.position.set(entry.x ?? 0, entry.y ?? 0, entry.z ?? 0); 
        if (entry.rx != null) mesh.rotation.set(entry.rx, entry.ry, entry.rz); 
        if (entry.sx != null) mesh.scale.set(entry.sx, entry.sy, entry.sz); 
        
        scene.add(mesh); 
        _meshToEntry.set(mesh, entry); 
        _prepareColliderDataAndNodes(mesh, entry);
    }); 

    camData.forEach(c => {
        if (c.id >= _camIdHandler) _camIdHandler = c.id + 1;
    });
}

export function togglePlanterMode() {
    _active = !_active;
    _clipboard = null;
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

export function setTransformMode(mode) {
    _tfMode = mode;
    if (_tc) _tc.setMode(mode);
}

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
    if (meshes.length > 0) _selectGroup(meshes);
    else _deselect();
}

export function updateSelectionTag(newTag) {
    if (!_selected) return;
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

export async function spawnFromInventory(typeId) { 
    if (!_active) return; 

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const spawnDist = 400; 
    const spawnX = camera.position.x + forward.x * spawnDist;
    const spawnZ = camera.position.z + forward.z * spawnDist;
    const terrainY = _getTerrainHeightAt(spawnX, spawnZ);

    const mesh = await createObjectMesh(typeId);
    if (!mesh) return;

    mesh.position.set(spawnX, terrainY + 2, spawnZ);
    scene.add(mesh);

    const currentUUID = uuidHandler++;
    mesh.userData.uuid = currentUUID; 
    const currentTag = DC.getCurrentTag();

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
    _prepareColliderDataAndNodes(mesh, entry);

    _select(mesh);
}

export async function openColModForSelection() {
    if (!_active || !_selected || _selected === _selectionGroup || _colmodOpen) return;
    const entry = _meshToEntry.get(_selected);
    if (!entry) return;

    _clipboard = null;
    _colmodOpen = true;
    if (_tc) _tc.detach();

    openColModModal({
        sourceMesh: _selected,
        entry,
        objectDef: OBJECT_REGISTRY.get(entry.type || _selected.userData.objectTypeId),
        onSave: async (colliders) => {
            entry.colliders = cloneColliderArray(colliders);
            rebuildColliderNodes(_selected, entry.colliders);
            await _saveMapToDisk?.();
        },
        onClose: () => {
            _colmodOpen = false;
            _clipboard = null;
            if (_selected && _tc) {
                _tc.attach(_selected);
                _tc.setMode(_tfMode);
            }
        }
    });
}

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
        if (cData.rx != null) mesh.rotation.set(cData.rx, cData.ry, cData.rz);
        if (cData.sx != null) mesh.scale.set(cData.sx, cData.sy, cData.sz);

        scene.add(mesh);
        const newUUID = uuidHandler++;
        mesh.userData.uuid = newUUID;

        const entry = {
            uuid: newUUID,
            tag: cData.tag || null,
            type: cData.type,
            x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
            rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z,
            sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z,
            colliders: cloneColliderArray(cData.colliders),
        };
        data.push(entry);
        _meshToEntry.set(mesh, entry);
        _prepareColliderDataAndNodes(mesh, entry);
        _select(mesh);
    } else if (_clipboard.type === 'group') {
        const box = new THREE.Box3();
        _clipboard.items.forEach(item => { box.expandByPoint(new THREE.Vector3(item.x, item.y, item.z)); });
        const oldCenter = new THREE.Vector3();
        box.getCenter(oldCenter);
        const offset = new THREE.Vector3().subVectors(spawnCenter, oldCenter);
        const pastedMeshes = [];

        for (const cData of _clipboard.items) {
            const mesh = await createObjectMesh(cData.type);
            if (!mesh) continue;

            mesh.position.set(cData.x, cData.y, cData.z).add(offset);
            if (cData.rx != null) mesh.rotation.set(cData.rx, cData.ry, cData.rz);
            if (cData.sx != null) mesh.scale.set(cData.sx, cData.sy, cData.sz);

            scene.add(mesh);
            const newUUID = uuidHandler++;
            mesh.userData.uuid = newUUID;

            const entry = {
                uuid: newUUID,
                tag: cData.tag || null,
                type: cData.type,
                x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
                rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z,
                sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z,
                colliders: cloneColliderArray(cData.colliders),
            };
            data.push(entry);
            _meshToEntry.set(mesh, entry);
            _prepareColliderDataAndNodes(mesh, entry);
            pastedMeshes.push(mesh);
        }
        if (pastedMeshes.length > 0) _selectGroup(pastedMeshes);
    }
}

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
        while (_selectionGroup.children.length > 0) scene.attach(_selectionGroup.children[0]);
    }
    _selected = null;
    if (_tc) _tc.detach();
    DC.onObjectDeselected();
}

export function deleteSelected() { 
    if (!_selected) return; 

    const meshesToDelete = _selected === _selectionGroup ? [..._selectionGroup.children] : [_selected];
    _deselect(); 

    meshesToDelete.forEach(mesh => {
        scene.remove(mesh);
        const entry = _meshToEntry.get(mesh);
        if (entry) {
            for (let i = camData.length - 1; i >= 0; i--) {
                if (camData[i].parentId === entry.uuid) camData.splice(i, 1);
            }
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

function _syncToData(mesh) {
    const entry = _meshToEntry.get(mesh);
    if (!entry) return;
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

function _onPointerDown(e) { 
    if (!_active || _colmodOpen || _isDragging) return; 
    if (e.target.closest('#planter-panel') || e.target.closest('button')) return;
    if (DC.isCamViewActive()) return; // THE LOCKDOWN

    _mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);

    const placed = Array.from(_meshToEntry.keys());
    const hits = _raycaster.intersectObjects(placed, true); 
    if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj && !_meshToEntry.has(hitObj)) hitObj = hitObj.parent;
        if (hitObj) {
            _select(hitObj);
            return;
        }
    }

    const terrainMeshes = Array.from(chunks.values());
    const terrainHits   = _raycaster.intersectObjects(terrainMeshes, false);
    if (terrainHits.length > 0) _deselect();
}

function _onKeyDown(e) {
    if (_colmodOpen) return;
    if (e.code === 'Tab') { e.preventDefault(); togglePlanterMode(); return; }
    if (!_active) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyC') {
            if (_selected === _selectionGroup) {
                _clipboard = { type: 'group', items: _selectionGroup.children.map(m => JSON.parse(JSON.stringify(_meshToEntry.get(m)))) };
            } else if (_selected) {
                _clipboard = { type: 'single', item: JSON.parse(JSON.stringify(_meshToEntry.get(_selected))) };
            }
            return;
        }
        if (e.code === 'KeyX') {
            if (_selected === _selectionGroup) {
                _clipboard = { type: 'group', items: _selectionGroup.children.map(m => JSON.parse(JSON.stringify(_meshToEntry.get(m)))) };
                deleteSelected();
            } else if (_selected) {
                _clipboard = { type: 'single', item: JSON.parse(JSON.stringify(_meshToEntry.get(_selected))) };
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
        case 'KeyT':      
            if (DC.isCamViewActive()) setCamTransformMode('translate');
            else setTransformMode('translate');
            break;
        case 'KeyR':      
            if (DC.isCamViewActive()) setCamTransformMode('rotate');
            else setTransformMode('rotate');    
            break;
        case 'KeyS':      
            if (DC.isCamViewActive()) return; 
            setTransformMode('scale');     
            break;
        case 'Delete':
        case 'Backspace': 
            if (DC.isCamViewActive()) deleteSelectedCamera();
            else deleteSelected();              
            break;
        case 'Escape':    
            if (DC.isCamViewActive()) {
                _selectedCamHelper = null;
                _tc.detach();
                DC.renderCamList(getCamerasForSelected(), null, selectCameraHelper);
            } else {
                _deselect();                   
            }
            break;
        case 'BracketRight': 
            if (DC.isCamViewActive()) return; 
            if (_selected) {
                _selected.scale.multiplyScalar(1.1);
                if (_selected === _selectionGroup) _selectionGroup.children.forEach(m => _syncToData(m));
                else _syncToData(_selected);
                DC.updateSelectedInfo(_selected);
            }
            break;
        case 'BracketLeft': 
            if (DC.isCamViewActive()) return; 
            if (_selected) {
                _selected.scale.multiplyScalar(0.909);
                if (_selected === _selectionGroup) _selectionGroup.children.forEach(m => _syncToData(m));
                else _syncToData(_selected);
                DC.updateSelectedInfo(_selected);
            }
            break;
    }
}

// ─── CAM TAB LOGIC ────────────────────────────────────────────────────────────
function _createCameraHelper() {
    const group = new THREE.Group();
    group.userData.isCameraHelper = true;
    
    const boxGeo = new THREE.BoxGeometry(...CAMERA_HELPER.boxSize);
    const boxMat = new THREE.MeshBasicMaterial({ color: CAMERA_HELPER.colorBox, wireframe: true });
    const box = new THREE.Mesh(boxGeo, boxMat);
    group.add(box);

    const coneGeo = new THREE.ConeGeometry(...CAMERA_HELPER.coneSize);
    const coneMat = new THREE.MeshBasicMaterial({ color: CAMERA_HELPER.colorCone, wireframe: true });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = -CAMERA_HELPER.boxSize[2]/2 - CAMERA_HELPER.coneSize[2]/2;
    group.add(cone);

    return group;
}

function getCamerasForSelected() {
    if (!_selected || _selected === _selectionGroup) return [];
    const entry = _meshToEntry.get(_selected);
    if (!entry) return [];
    return camData.filter(c => c.parentId === entry.uuid);
}

export function toggleCamView(isActive) {
    if (isActive) {
        _tc.detach();
        const cams = getCamerasForSelected();
        cams.forEach(c => {
            const helper = _createCameraHelper();
            helper.userData.camId = c.id;
            _selected.add(helper); 
            helper.position.set(c.lx, c.ly, c.lz);
            helper.rotation.set(c.rx, c.ry, c.rz);
            _activeCamHelpers.set(c.id, helper);
        });
        DC.renderCamList(cams, null, selectCameraHelper);
    } else {
        _activeCamHelpers.forEach(h => {
            if (h.parent) h.parent.remove(h);
        });
        _activeCamHelpers.clear();
        _selectedCamHelper = null;
        if (_selected) {
            _tc.attach(_selected);
            _tc.setMode(_tfMode);
        } else {
            _tc.detach();
        }
    }
}

export function addCameraToSelected() {
    if (!_selected || _selected === _selectionGroup) return;
    const entry = _meshToEntry.get(_selected);
    if (!entry) return;

    const newId = _camIdHandler++; 
    const cData = {
        id: newId,
        parentId: entry.uuid,
        lx: CAMERA_HELPER.defaultOffset.x,
        ly: CAMERA_HELPER.defaultOffset.y,
        lz: CAMERA_HELPER.defaultOffset.z,
        rx: 0, ry: 0, rz: 0
    };
    camData.push(cData);

    const helper = _createCameraHelper();
    helper.userData.camId = cData.id;
    _selected.add(helper);
    helper.position.set(cData.lx, cData.ly, cData.lz);
    helper.rotation.set(cData.rx, cData.ry, cData.rz);
    
    _activeCamHelpers.set(cData.id, helper);
    DC.renderCamList(getCamerasForSelected(), cData.id, selectCameraHelper);
    selectCameraHelper(cData.id);
}

export function selectCameraHelper(id) {
    const helper = _activeCamHelpers.get(id);
    if (helper) {
        _selectedCamHelper = helper;
        _tc.attach(helper);
        _tc.setMode(_camTfMode);
        DC.renderCamList(getCamerasForSelected(), id, selectCameraHelper);
    }
}

export function setCamTransformMode(mode) {
    _camTfMode = mode;
    if (_tc && _selectedCamHelper) _tc.setMode(mode);
    DC.updateCamTfUI(mode);
}

export function deleteSelectedCamera() {
    if (!_selectedCamHelper) return;
    const id = _selectedCamHelper.userData.camId;
    
    const idx = camData.findIndex(c => c.id === id);
    if (idx !== -1) camData.splice(idx, 1);
    
    if (_selectedCamHelper.parent) _selectedCamHelper.parent.remove(_selectedCamHelper);
    _activeCamHelpers.delete(id);
    
    _selectedCamHelper = null;
    _tc.detach();
    DC.renderCamList(getCamerasForSelected(), null, selectCameraHelper);
}

function _getTerrainHeightAt(x, z) {
    const origin = new THREE.Vector3(x, 2000, z);
    const dir    = new THREE.Vector3(0, -1, 0);
    _raycaster.set(origin, dir);
    const terrainMeshes = Array.from(chunks.values());
    const hits = _raycaster.intersectObjects(terrainMeshes, false);
    return hits.length > 0 ? hits[0].point.y : 0;
}

function _prepareColliderDataAndNodes(mesh, entry) {
    const def = OBJECT_REGISTRY.get(entry.type || mesh.userData.objectTypeId);
    ensureEntryColliders(entry, mesh, def);
    rebuildColliderNodes(mesh, entry.colliders);
}