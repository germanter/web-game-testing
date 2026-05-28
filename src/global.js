///// src/global.js /////

export const WORLD_SEED = "germanter-hysler-2000";

// ── SYSTEM ─────────────────────────────────────────────────────────────
export const SYSTEM = {
    // Master switch: Toggle false for production mode to disable overlays/HUD
    DEBUG: true, 
};

// ── CAMERA PARAMETERS ──────────────────────────────────────────────────
export const CAMERA = {
    fov: 60,                      // Field of View (degrees)
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

export const SCENE = {
    background: 0x9fa4a6,         // Muted, cold overcast gray sky
    fogColor: 0x9fa4a6,           // Fog matches the heavy, low-hanging overcast mist
    fogStartOffset: 1.5,          // REVERTED to your original layout offset
    sunColor: 0xeeeeee,           // Diffused, flat white light (no warm yellow sun)
    sunIntensity: 2.0,            // Lowered to mimic flat overcast day
    sunPos: { x: 2000, y: 3000, z: 1000 }, // REVERTED to your original sun position
    ambientColor: 0x5a5d64,       // Cold, slate-gray ambient bounce light
    ambientIntensity: 0.7,        // High ambient ratio to eliminate harsh shadows
};

// ── TERRAIN BIOME & WATER COLORS ───────────────────────────────────────
export const TERRAIN = {
    colorSand: 0x3d352e,          // Wet, muddy banks / puddle edges
    colorLowland: 0x2b241f,       // Deep, dark forest mud and decayed leaves
    colorHill: 0x423b32,          // Muted leaf-littered soil and damp earth
    colorRock: 0x3a3d40,          // Wet, cold stone gray
    colorSnow: 0xd2d7df,          // Dirty, slushy winter snow patches
    waterColor: 0x484b4f,         // Steel-gray, muddy puddle/river color
    waterOpacity: 0.85,           // REVERTED to your original opacity
    waterHeight: 2.0,             // REVERTED to your original height
};

// ── TREE GENERATOR PARAMETERS ──────────────────────────────────────────
export const TREE = {
    density: 0.00003,             // REVERTED to your original density
    minHeight: 60.0,              // REVERTED to your original scale
    maxHeight: 80.0,             // REVERTED to your original scale
    minElevation: 10.0,           // REVERTED to your original elevation
    maxElevation: 62.0,           // REVERTED to your original elevation
    maxSlope: 0.14,               // REVERTED to your original slope
    
    // Tree visual palette (Muted, bare, winter forest tones)
    colorTrunkDark: 0x1c1a18,     // Wet, near-black tree bark base
    colorTrunkLight: 0x383430,    // Weathered, ash-brown bark highlights
    colorFoliageCore: 0x222621,   // Dead, dark olive/decayed pine core
    colorFoliageOuterMin: 0x2d302a, // Dead/dormant winter needles minimum
    colorFoliageOuterMax: 0x3b3f37, // Highly desaturated, cold military green max
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

// These mathematically shape the noise maps, heights, and chances of biomes spawning.

export const TERRAIN_GEN = {
    // 1. MACRO NOISE (Determines the global layout / chance of biomes)
    macroScale: 0.00025,       // Zoom level of the biome map
    macroOctaves: 3,           // Detail passes for biome shapes
    macroPersistence: 0.5,     // How much each detail pass contributes
    macroLacunarity: 2.0,      // Frequency multiplier per detail pass

    // 2. PLAINS TERRAIN (Flat, low-lying areas)
    plainsScale: 0.001,
    plainsOctaves: 2,
    plainsPersistence: 0.5,
    plainsLacunarity: 2.0,
    plainsHeightMult: 12.0,    // Max height of plains
    plainsOffset: 0.5,         // Base elevation boost

    // 3. HILLS TERRAIN (Rolling, bumpy mid-elevations)
    hillsScale: 0.002,
    hillsOctaves: 4,
    hillsPersistence: 0.5,
    hillsLacunarity: 2.0,
    hillsHeightMult: 90.0,     // Max height of hills
    hillsExponent: 1.8,        // Pushes the valleys down and peaks up (shaping)

    // 4. MOUNTAINS TERRAIN (Sharp, ridged peaks)
    mountainsScale: 0.0025,
    mountainsOctaves: 6,       // High octaves for jagged rocky detail
    mountainsHeightMult: 450.0,// Extreme height multiplier for peaks
    mountainsOffset: 20.0,     // Pushes mountains down slightly to blend better

    // 5. MICRO NOISE (Tiny rocks, bumps, and variance across ALL terrain)
    microScale: 0.05,
    microOctaves: 2,
    microPersistence: 0.5,
    microLacunarity: 2.0,
    microHeightMult: 1.5,      // How tall the small bumps are

    // 6. BIOME BLENDING THRESHOLDS (Based on Macro noise 0.0 to 1.0)
    // Changing these alters the "chance" or "amount" of each biome
    plainsToHillsStart: 0.25,  // Below 0.25 is purely Plains
    plainsToHillsEnd: 0.45,    // At 0.45, it is purely Hills
    hillsToMountStart: 0.60,   // Below 0.60 is mostly Hills
    hillsToMountEnd: 0.80,     // Above 0.80 is purely Mountains

    // 7. GLOBAL OFFSET
    globalHeightOffset: 5.0    // Sinks the entire world down by this amount
};