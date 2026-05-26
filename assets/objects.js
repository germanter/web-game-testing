///// src/map/objects.js /////

// The Block Template
export const blockGeo = new THREE.BoxGeometry(160, 160, 160);
export const blockMat = new THREE.MeshStandardMaterial({ 
    color: 0xff3333, 
    roughness: 0.7 
});

// Spawns a physical block in the 3D world
export function spawnBlock(scene, placedBlocksArray, x, y, z) {
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.position.set(x, y + 2, z); // +2 so it sits ON the ground, not inside it
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    placedBlocksArray.push(block);
    return block;
}