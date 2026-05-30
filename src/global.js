///// src/global.js /////

export const WORLD_SEED = "germanter-hysler-2000";

// ── SYSTEM ─────────────────────────────────────────────────────────────
export const SYSTEM = {
    // Master switch: Toggle false for production mode to disable overlays/HUD
    DEBUG: true, 
};

export const CAMERA_SYSTEM = {
    ACTIVE_CAMERA_ID: 1// 7 1 = ghost fly cam. >1 = object-attached
};

export const CAMERA_HELPER = {
    boxSize: [6.0, 6.0, 10.0],       // Massive box blueprint 
    coneSize: [4.0, 6.0, 4],         // Giant direction cone
    defaultOffset: { x: 0, y: 15, z: 25 }, // Pushed way out so it doesn't swallow the mother object
    colorBox: 0x3b82f6,
    colorCone: 0xffb84d
};

// ── PHYSICS & COLLISION ────────────────────────────────────────────────
export const PHYSICS = {
    entityRadius: 1.5,                      // Base physical radius of the object traversing the world
};

// ── CAMERA PARAMETERS ──────────────────────────────────────────────────
export const CAMERA = {
    fov: 60,                      
    nearPlane: 0.1,               
    farPlane: 5000,               
    initialPos: { x: 0, y: 300, z: 0 }, 
    baseSpeed: 250.0,             
    sprintMultiplier: 5.0,        
    mouseSensitivity: 0.002,      
    groundClearance: 5.0,         
    minPitch: -Math.PI / 2 + 0.01,
    maxPitch:  Math.PI / 2 - 0.01,
};

// ── MAP GENERATION ─────────────────────────────────────────────────────
export const MAP = {
    renderDist: 4,                
    chunkSize: 250,               
    chunkRes: 70,                 
};

export const SCENE = {
    background: 0x9fa4a6,         
    fogColor: 0x9fa4a6,           
    fogStartOffset: 1.5,          
    sunColor: 0xeeeeee,           
    sunIntensity: 2.0,            
    sunPos: { x: 2000, y: 3000, z: 1000 }, 
    ambientColor: 0x5a5d64,       
    ambientIntensity: 0.7,        
};

// ── TERRAIN BIOME & WATER COLORS ───────────────────────────────────────
export const TERRAIN = {
    colorSand: 0x3d352e,          
    colorLowland: 0x2b241f,       
    colorHill: 0x423b32,          
    colorRock: 0x3a3d40,          
    colorSnow: 0xd2d7df,          
    waterColor: 0x484b4f,         
    waterOpacity: 0.85,           
    waterHeight: 2.0,             
};

// ── TREE GENERATOR PARAMETERS ──────────────────────────────────────────
export const TREE = {
    density: 0.00003,             
    minHeight: 60.0,              
    maxHeight: 80.0,             
    minElevation: 10.0,           
    maxElevation: 62.0,           
    maxSlope: 0.14,               
    
    // Tree visual palette (Muted, bare, winter forest tones)
    colorTrunkDark: 0x1c1a18,     
    colorTrunkLight: 0x383430,    
    colorFoliageCore: 0x222621,   
    colorFoliageOuterMin: 0x2d302a, 
    colorFoliageOuterMax: 0x3b3f37, 

    // Mathematical Physics Collider Setup
    COLLIDER_RADIUS_SCALE: 0.05,      // Scale for trunk cylinder base radius
    COLLIDER_HEIGHT_SCALE: 0.45,      // Percentage of total tree height that acts as solid trunk
    COLLIDER_CONE_RADIUS_SCALE: 0.32, // Maximum radius of the base of the foliage cone section
};

// ── DEBUG UI BIOME THRESHOLDS & COLORS ─────────────────────────────────
export const UI_BIOME = {
    plainsMax: 0.25,      plainsColor: '#a3e635',      plainsName: 'Flat Plains',
    plainsHillsMax: 0.45, plainsHillsColor: '#84cc16', plainsHillsName: 'Plains/Hills Transition',
    hillsMax: 0.60,       hillsColor: '#eab308',       hillsName: 'Rolling Hills',
    hillsMountMax: 0.80,  hillsMountColor: '#f97316',  hillsMountName: 'Hills/Mountains Transition',
    mountainsColor: '#ef4444', mountainsName: 'High Alpine Mountains',
};

// ── PROCEDURAL TERRAIN GENERATION PARAMETERS ───────────────────────────
export const TERRAIN_GEN = {
    macroScale: 0.00025,       
    macroOctaves: 3,           
    macroPersistence: 0.5,     
    macroLacunarity: 2.0,      

    plainsScale: 0.001,
    plainsOctaves: 2,
    plainsPersistence: 0.5,
    plainsLacunarity: 2.0,
    plainsHeightMult: 12.0,    
    plainsOffset: 0.5,         

    hillsScale: 0.002,
    hillsOctaves: 4,
    hillsPersistence: 0.5,
    hillsLacunarity: 2.0,
    hillsHeightMult: 90.0,     
    hillsExponent: 1.8,        

    mountainsScale: 0.0025,
    mountainsOctaves: 6,       
    mountainsHeightMult: 450.0,
    mountainsOffset: 20.0,     

    microScale: 0.05,
    microOctaves: 2,
    microPersistence: 0.5,
    microLacunarity: 2.0,
    microHeightMult: 1.5,      

    plainsToHillsStart: 0.25,  
    plainsToHillsEnd: 0.45,    
    hillsToMountStart: 0.60,   
    hillsToMountEnd: 0.80,     

    globalHeightOffset: 5.0    
};