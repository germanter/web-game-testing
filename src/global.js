///// src/global.js /////

export const WORLD_SEED = "germanter-hysler-2000";

// ── SYSTEM ─────────────────────────────────────────────────────────────
export const SYSTEM = {
    // Master switch: Toggle false for production mode to disable overlays/HUD
    DEBUG: true, 
};

// ── CAMERA PARAMETERS ──────────────────────────────────────────────────
export const CAMERA = {
    fov: 85,                      // Field of View (degrees)
    nearPlane: 0.1,               // Closest rendering distance
    farPlane: 5000,               // Furthest rendering distance
    initialPos: { x: 0, y: 300, z: 0 }, // Starting position [x, y, z]
    baseSpeed: 250.0,             // Normal flying speed (units per second)
    sprintMultiplier: 5.0,        // Speed multiplier when holding Shift
    mouseSensitivity: 0.002,      // Mouse look sensitivity
    groundClearance: 5.0,         // Minimum height camera stays above ground
    minPitch: -Math.PI / 2 + 0.01,// Look down limit (radians)
    maxPitch:  Math.PI / 2 - 0.01,// Look up limit (radians)
};

// ── MAP GENERATION ─────────────────────────────────────────────────────
export const MAP = {
    renderDist: 4,                // Number of chunks rendered in each direction from camera
    chunkSize: 250,               // Physical size of one chunk (synced with tree generation)
    chunkRes: 70,                 // Vertex resolution per chunk
};

// ── SCENE ENVIRONMENT & LIGHTING ───────────────────────────────────────
export const SCENE = {
    background: 0x5c6570,         // Sky/Background color (Tactical Overcast / Battleship Gray)
    fogColor: 0x5c6570,           // Fog color (matches background perfectly)
    fogStartOffset: 1.5,          // Subtracted from renderDist for fog start distance
    sunColor: 0xfff5e6,           // Main directional light color
    sunIntensity: 1.3,            // Main directional light brightness
    sunPos: { x: 2000, y: 3000, z: 1000 }, // Position of the sun light
    ambientColor: 0x405060,       // Global ambient lighting color
    ambientIntensity: 0.6,        // Global ambient lighting brightness
};

// ── TERRAIN BIOME & WATER COLORS ───────────────────────────────────────
export const TERRAIN = {
    colorSand: 0xa69580,          // Beach/lowland sand (Bright Desert Beach style)
    colorLowland: 0x353d2d,       // Lush/forest lower elevations (Dark rich green)
    colorHill: 0x4a4736,          // Mossy/dry mid elevations
    colorRock: 0x2b2d30,          // Mountain rock (Clean dark gray)
    colorSnow: 0xcbd1d6,          // High altitude snow (Bright soft snow)
    waterColor: 0x1e5a8f,         // Ocean/water base color
    waterOpacity: 0.85,           // Water surface transparency
    waterHeight: 2.0,             // Universal flat plane height for water
};

// ── TREE GENERATOR PARAMETERS ──────────────────────────────────────────
export const TREE = {
    density: 0.00003,             // Base probability/frequency of trees spawning across the map
    minHeight: 50.0,              // Shortest tree scale (Tall, grand silhouette)
    maxHeight: 100.0,             // Tallest tree scale
    minElevation: 10.0,           // Lowest ground height for trees (safely stays above water)
    maxElevation: 62.0,           // Highest ground height for trees (stops before rocky mountain peaks)
    maxSlope: 0.14,               // Max terrain steepness for trees (prevents cliff side spawns)
    
    // Tree visual palette
    colorTrunkDark: 0x1a1614,     // Base gradient for bark (Weathered / dark organic brown)
    colorTrunkLight: 0x262220,    // Highlight gradient for bark
    colorFoliageCore: 0x131a14,   // Deep shadowed interior core of foliage 
    colorFoliageOuterMin: 0x2d362c, // Outer needle color minimum gradient
    colorFoliageOuterMax: 0x3a4239, // Outer needle color maximum gradient
};

// ── DEBUG UI BIOME THRESHOLDS & COLORS ─────────────────────────────────
export const UI_BIOME = {
    plainsMax: 0.25,      plainsColor: '#a3e635',      plainsName: 'Flat Plains',
    plainsHillsMax: 0.45, plainsHillsColor: '#84cc16', plainsHillsName: 'Plains/Hills Transition',
    hillsMax: 0.60,       hillsColor: '#eab308',       hillsName: 'Rolling Hills',
    hillsMountMax: 0.80,  hillsMountColor: '#f97316',  hillsMountName: 'Hills/Mountains Transition',
    mountainsColor: '#ef4444', mountainsName: 'High Alpine Mountains',
};