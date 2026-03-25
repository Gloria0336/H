// ─── 螢幕尺寸（iPhone 17 基準）─────────────────────────────────
export const GAME_WIDTH = 393;
export const GAME_HEIGHT = 852;

// ─── 地圖格子 ─────────────────────────────────────────────────
export const TILE_SIZE = 24;          // px，手機上中文字清晰可讀
export const MAP_COLS = 60;           // 地圖總欄數
export const MAP_ROWS = 60;           // 地圖總列數

// ─── 視口（可見格數）─────────────────────────────────────────
export const VIEW_COLS = Math.floor(GAME_WIDTH / TILE_SIZE);   // ~16
export const VIEW_ROWS = Math.floor(GAME_HEIGHT / TILE_SIZE);  // ~35（含 HUD 區域）
export const HUD_ROWS = 3;            // 頂部 HUD 佔用格數
export const DUNGEON_VIEW_ROWS = VIEW_ROWS - HUD_ROWS;         // 實際地圖可見列數

// ─── 玩家 ──────────────────────────────────────────────────────
export const PLAYER_SPEED = 150;      // px/s
export const PLAYER_MAX_HP = 100;

// ─── FOV ──────────────────────────────────────────────────────
export const FOV_RADIUS = 8;          // 視野半徑（格）
export const CORRIDOR_FOV_RADIUS = 5; // 在廊中的視野半徑

// ─── 顏色 ──────────────────────────────────────────────────────
export const COLORS = {
  WALL:        0x555555,
  FLOOR:       0x000000,
  CORRIDOR:    0x1a1a1a,
  PILLAR:      0x888888,
  DOOR:        0x8B4513,
  PLAYER:      0xFFD700,
  ENEMY:       0xFF4444,
  ENEMY_ELITE: 0xFF8800,
  BOSS:        0xFF0088,
  ITEM:        0xAAFFAA,
  CHEST:       0xFFD700,
  WEAPON:      0xAAAAFF,
  POTION:      0xFF88FF,
  EXIT:        0x00FF88,
  EFFECT_HIT:  0xFFFFFF,
  EFFECT_FIRE: 0xFF6600,
  EFFECT_ICE:  0x88CCFF,
  DIMMED:      0x444444,
} as const;

// ─── UI ────────────────────────────────────────────────────────
export const UI_DEPTH = 100;
export const JOYSTICK_RADIUS = 60;
export const JOYSTICK_THUMB_RADIUS = 28;
