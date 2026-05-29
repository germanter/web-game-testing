///// ui/debug/colmodModal.js /////

import {
    applyColliderTransform,
    cloneColliderArray,
    createBoundingBoxColliderForObject,
    serializeColliderObject,
} from '../../src/collision/collisionColliderForPlanted.js';

const SHAPE_COLORS = {
    box: 0x22d3ee,
    sphere: 0xa3e635,
    cylinder: 0xf59e0b,
};

let _activeModal = null;

export function openColModModal({ sourceMesh, entry, objectDef, onSave, onClose }) {
    if (_activeModal) _activeModal.close(false);
    _activeModal = new ColModModal({ sourceMesh, entry, objectDef, onSave, onClose });
    _activeModal.open();
}

class ColModModal {
    constructor({ sourceMesh, entry, objectDef, onSave, onClose }) {
        this.sourceMesh = sourceMesh;
        this.entry = entry;
        this.objectDef = objectDef;
        this.onSave = onSave;
        this.onClose = onClose;

        this.overlay = null;
        this.viewport = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.objectRoot = null;
        this.transformControls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.colliderMeshes = [];
        this.selectedCollider = null;
        this.clipboard = null;
        this.animationId = null;
        this.isDraggingGizmo = false;
        this.orbit = {
            yaw: Math.PI * 0.25,
            pitch: Math.PI * 0.22,
            distance: 600,
            target: new THREE.Vector3(),
            pointerDown: false,
            button: 0,
            lastX: 0,
            lastY: 0,
        };
        this.saved = false;

        this._onResize = this._onResize.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    open() {
        this._buildDom();
        this._buildScene();
        this._loadObjectClone();
        this._loadInitialColliders();
        this._frameCamera();
        this._bindEvents();
        this._animate();
    }

    close(wasSaved) {
        this.saved = !!wasSaved;
        this.clipboard = null;

        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('keydown', this._onKeyDown, true);
        this.viewport?.removeEventListener('pointerdown', this._onPointerDown);
        this.viewport?.removeEventListener('pointermove', this._onPointerMove);
        this.viewport?.removeEventListener('pointerup', this._onPointerUp);
        this.viewport?.removeEventListener('pointerleave', this._onPointerUp);
        this.viewport?.removeEventListener('wheel', this._onWheel);

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.transformControls?.detach();
        this.renderer?.dispose();
        this.scene?.traverse((node) => {
            if (!node.isMesh) return;
            node.geometry?.dispose?.();
            if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
            else node.material?.dispose?.();
        });
        this.overlay?.remove();

        _activeModal = null;
        this.onClose?.(this.saved);
    }

    _buildDom() {
        if (!document.getElementById('colmod-style')) {
            const style = document.createElement('style');
            style.id = 'colmod-style';
            style.textContent = `
                #colmod-overlay {
                    position: fixed; inset: 0; z-index: 1000;
                    display: grid; grid-template-rows: auto 1fr;
                    background: rgba(4, 8, 12, 0.96); color: #dbeafe;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                #colmod-toolbar {
                    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    padding: 10px 12px; background: #101820; border-bottom: 1px solid #263442;
                }
                #colmod-title { font-size: 13px; font-weight: 700; color: #f8fafc; margin-right: 10px; }
                .colmod-btn {
                    min-width: 42px; height: 32px; padding: 0 10px;
                    background: #1d2835; color: #cbd5e1; border: 1px solid #35465a;
                    border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 650;
                }
                .colmod-btn:hover { background: #2a3949; border-color: #4f6278; }
                .colmod-btn.active { background: #22d3ee; color: #061018; border-color: #22d3ee; }
                .colmod-spacer { flex: 1; }
                #colmod-save { background: #16a34a; color: #04130a; border-color: #22c55e; }
                #colmod-close { min-width: 34px; background: #3a1820; color: #fecdd3; border-color: #7f1d1d; }
                #colmod-viewport { position: relative; overflow: hidden; min-height: 0; cursor: default; }
                #colmod-viewport canvas { display: block; width: 100%; height: 100%; }
                #colmod-status {
                    position: absolute; left: 12px; bottom: 12px; pointer-events: none;
                    background: rgba(8, 13, 18, 0.72); border: 1px solid rgba(148, 163, 184, 0.2);
                    color: #94a3b8; border-radius: 6px; padding: 7px 9px; font-size: 11px;
                }
            `;
            document.head.appendChild(style);
        }

        this.overlay = document.createElement('div');
        this.overlay.id = 'colmod-overlay';
        this.overlay.innerHTML = `
            <div id="colmod-toolbar">
                <div id="colmod-title">COLMOD</div>
                <button class="colmod-btn" data-add="box">Box</button>
                <button class="colmod-btn" data-add="sphere">Sphere</button>
                <button class="colmod-btn" data-add="cylinder">Cylinder</button>
                <button class="colmod-btn" data-mode="translate">Move</button>
                <button class="colmod-btn" data-mode="rotate">Rotate</button>
                <button class="colmod-btn" data-mode="scale">Scale</button>
                <button class="colmod-btn" data-action="delete">Delete</button>
                <button class="colmod-btn" data-action="copy">Copy</button>
                <button class="colmod-btn" data-action="cut">Cut</button>
                <button class="colmod-btn" data-action="paste">Paste</button>
                <div class="colmod-spacer"></div>
                <button id="colmod-save" class="colmod-btn">Save</button>
                <button id="colmod-close" class="colmod-btn">X</button>
            </div>
            <div id="colmod-viewport">
                <div id="colmod-status">Mouse wheel zooms. Drag empty space to orbit. Right-drag pans.</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.viewport = this.overlay.querySelector('#colmod-viewport');

        this.overlay.querySelectorAll('[data-add]').forEach((btn) => {
            btn.addEventListener('click', () => this._addCollider(btn.dataset.add));
        });
        this.overlay.querySelectorAll('[data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
        });
        this.overlay.querySelector('[data-action="delete"]').addEventListener('click', () => this._deleteSelected());
        this.overlay.querySelector('[data-action="copy"]').addEventListener('click', () => this._copySelected(false));
        this.overlay.querySelector('[data-action="cut"]').addEventListener('click', () => this._copySelected(true));
        this.overlay.querySelector('[data-action="paste"]').addEventListener('click', () => this._pasteCollider());
        this.overlay.querySelector('#colmod-save').addEventListener('click', () => this._save());
        this.overlay.querySelector('#colmod-close').addEventListener('click', () => this.close(false));
        this.overlay.querySelector('[data-mode="translate"]').classList.add('active');
    }

    _buildScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x070b10);
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.viewport.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.85));
        const key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(500, 800, 500);
        this.scene.add(key);
        this.scene.add(new THREE.GridHelper(1000, 20, 0x334155, 0x1f2937));

        this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.setSize(0.8);
        this.transformControls.setMode('translate');
        this.transformControls.addEventListener('dragging-changed', (e) => {
            this.isDraggingGizmo = e.value;
        });
        this.scene.add(this.transformControls);

        this._onResize();
    }

    _loadObjectClone() {
        this.objectRoot = this.sourceMesh.clone(true);
        this.objectRoot.position.set(0, 0, 0);
        this.objectRoot.rotation.set(0, 0, 0);
        this.objectRoot.scale.copy(this.sourceMesh.scale);
        this.objectRoot.userData = { ...this.sourceMesh.userData };

        const colliderChildren = [];
        this.objectRoot.children.forEach((child) => {
            if (child.userData?.isPlantedColliderNode) colliderChildren.push(child);
        });
        colliderChildren.forEach((child) => this.objectRoot.remove(child));

        this.objectRoot.traverse((node) => {
            if (!node.isMesh) return;
            node.visible = true;
            if (Array.isArray(node.material)) node.material = node.material.map((m) => m.clone());
            else node.material = node.material?.clone?.() || node.material;
        });

        this.scene.add(this.objectRoot);
    }

    _loadInitialColliders() {
        let colliders = cloneColliderArray(this.entry.colliders);
        if (colliders.length === 0 && this.objectDef?.createGeometry) {
            colliders = [createBoundingBoxColliderForObject(this.objectRoot)];
        }
        colliders.forEach((collider) => this._createColliderMesh(collider));
    }

    _createColliderMesh(collider) {
        const shape = collider.shape || 'box';
        const geometry = this._geometryForShape(shape);
        const material = new THREE.MeshBasicMaterial({
            color: SHAPE_COLORS[shape] || SHAPE_COLORS.box,
            wireframe: true,
            transparent: true,
            opacity: 0.72,
            depthTest: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 10;
        mesh.userData.colliderShape = shape;
        mesh.userData.colliderInternalId = this._makeInternalId();
        applyColliderTransform(mesh, collider);
        this.objectRoot.add(mesh);
        this.colliderMeshes.push(mesh);
        return mesh;
    }

    _geometryForShape(shape) {
        if (shape === 'sphere') return new THREE.SphereGeometry(0.5, 24, 14);
        if (shape === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true);
        return new THREE.BoxGeometry(1, 1, 1);
    }

    _addCollider(shape) {
        const bounds = createBoundingBoxColliderForObject(this.objectRoot);
        const base = Math.max(Math.min(bounds.sx, bounds.sy, bounds.sz) * 0.35, 1);
        const collider = {
            shape,
            x: 0, y: 0, z: 0,
            rx: 0, ry: 0, rz: 0,
            sx: base, sy: base, sz: base,
        };
        if (shape === 'cylinder') collider.sy = Math.max(base * 1.6, 10);
        const mesh = this._createColliderMesh(collider);
        this._selectCollider(mesh);
    }

    _selectCollider(mesh) {
        this.selectedCollider = mesh;
        this.transformControls.attach(mesh);
        this.colliderMeshes.forEach((m) => {
            m.material.opacity = m === mesh ? 1 : 0.42;
        });
    }

    _deleteSelected() {
        if (!this.selectedCollider) return;
        const mesh = this.selectedCollider;
        this.transformControls.detach();
        this.objectRoot.remove(mesh);
        this.colliderMeshes = this.colliderMeshes.filter((m) => m !== mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.selectedCollider = null;
    }

    _copySelected(cut) {
        if (!this.selectedCollider) return;
        this.clipboard = serializeColliderObject(this.selectedCollider, this.selectedCollider.userData.colliderShape);
        if (cut) this._deleteSelected();
    }

    _pasteCollider() {
        if (!this.clipboard) return;
        const collider = { ...this.clipboard, x: this.clipboard.x + 10, z: this.clipboard.z + 10 };
        const mesh = this._createColliderMesh(collider);
        mesh.userData.colliderInternalId = this._makeInternalId();
        this._selectCollider(mesh);
    }

    async _save() {
        const colliders = this.colliderMeshes.map((mesh) =>
            serializeColliderObject(mesh, mesh.userData.colliderShape)
        );
        await this.onSave?.(colliders);
        this.close(true);
    }

    _setMode(mode) {
        this.transformControls.setMode(mode);
        this.overlay.querySelectorAll('[data-mode]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    _bindEvents() {
        window.addEventListener('resize', this._onResize);
        document.addEventListener('keydown', this._onKeyDown, true);
        this.viewport.addEventListener('pointerdown', this._onPointerDown);
        this.viewport.addEventListener('pointermove', this._onPointerMove);
        this.viewport.addEventListener('pointerup', this._onPointerUp);
        this.viewport.addEventListener('pointerleave', this._onPointerUp);
        this.viewport.addEventListener('wheel', this._onWheel, { passive: false });
        this.viewport.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _onPointerDown(e) {
        if (e.target !== this.renderer.domElement) return;
        this.viewport.setPointerCapture?.(e.pointerId);
        this.orbit.pointerDown = true;
        this.orbit.button = e.button;
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;

        if (this.isDraggingGizmo) return;
        if (e.button !== 0) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.colliderMeshes, false);
        if (hits.length > 0) this._selectCollider(hits[0].object);
    }

    _onPointerMove(e) {
        if (!this.orbit.pointerDown || this.isDraggingGizmo) return;

        const dx = e.clientX - this.orbit.lastX;
        const dy = e.clientY - this.orbit.lastY;
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;

        if (this.orbit.button === 2) {
            const panScale = this.orbit.distance * 0.0014;
            const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
            this.orbit.target.addScaledVector(right, -dx * panScale);
            this.orbit.target.addScaledVector(up, dy * panScale);
        } else {
            this.orbit.yaw -= dx * 0.006;
            this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch - dy * 0.006, -1.3, 1.3);
        }
        this._updateCamera();
    }

    _onPointerUp(e) {
        this.orbit.pointerDown = false;
        this.viewport.releasePointerCapture?.(e.pointerId);
    }

    _onWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.12 : 0.88;
        this.orbit.distance = THREE.MathUtils.clamp(this.orbit.distance * factor, 5, 100000);
        this._updateCamera();
    }

    _onKeyDown(e) {
        e.stopPropagation();
        if (e.code === 'Escape') {
            e.preventDefault();
            this.close(false);
            return;
        }
        if (e.code === 'KeyP') {
            e.preventDefault();
            this._save();
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'KeyC') {
                e.preventDefault();
                this._copySelected(false);
            } else if (e.code === 'KeyX') {
                e.preventDefault();
                this._copySelected(true);
            } else if (e.code === 'KeyV') {
                e.preventDefault();
                this._pasteCollider();
            }
            return;
        }
        if (e.code === 'Delete' || e.code === 'Backspace') this._deleteSelected();
        if (e.code === 'KeyT') this._setMode('translate');
        if (e.code === 'KeyR') this._setMode('rotate');
        if (e.code === 'KeyS') this._setMode('scale');
    }

    _frameCamera() {
        const box = new THREE.Box3().setFromObject(this.objectRoot);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const radius = Math.max(size.length() * 0.5, 10);
        this.orbit.target.copy(center);
        this.orbit.distance = THREE.MathUtils.clamp(radius * 2.6, 30, 50000);
        this.camera.near = Math.max(this.orbit.distance / 10000, 0.01);
        this.camera.far = Math.max(this.orbit.distance * 100, 10000);
        this.camera.updateProjectionMatrix();
        this._updateCamera();
    }

    _updateCamera() {
        const cp = Math.cos(this.orbit.pitch);
        const offset = new THREE.Vector3(
            Math.sin(this.orbit.yaw) * cp,
            Math.sin(this.orbit.pitch),
            Math.cos(this.orbit.yaw) * cp
        ).multiplyScalar(this.orbit.distance);
        this.camera.position.copy(this.orbit.target).add(offset);
        this.camera.lookAt(this.orbit.target);
    }

    _onResize() {
        const rect = this.viewport.getBoundingClientRect();
        const width = Math.max(rect.width, 1);
        const height = Math.max(rect.height, 1);
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    _animate() {
        this.animationId = requestAnimationFrame(() => this._animate());
        this.renderer.render(this.scene, this.camera);
    }

    _makeInternalId() {
        return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    }
}
