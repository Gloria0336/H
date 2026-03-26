// ─── 格子類型 ──────────────────────────────────────────────────
export const enum TileType {
  EMPTY = 0,
  WALL = 1,
  FLOOR = 2,
  DOOR = 3,
  CHEST = 4,
  EXIT = 5,
  PILLAR = 6,  // 房間內獨立柱，不可穿越
  CORRIDOR = 7,  // 走廊過渡，可通行但阻擋視野
}

// ─── 格子視覺定義 ──────────────────────────────────────────────
export interface TileVisual {
  chars: string[];   // 隨機選取的中文字符
  color: number;     // 0xRRGGBB
}

export const TILE_VISUALS: Record<TileType, TileVisual> = {
  [TileType.EMPTY]: { chars: ['　'], color: 0x000000 },
  [TileType.WALL]: { chars: ['牆'], color: 0x555555 },
  [TileType.FLOOR]: { chars: ['　'], color: 0x000000 },  // 地板不顯示文字
  [TileType.DOOR]: { chars: ['門'], color: 0x8B4513 },
  [TileType.CHEST]: { chars: ['寶'], color: 0xFFD700 },
  [TileType.EXIT]: { chars: ['梯'], color: 0x00FF88 },
  [TileType.PILLAR]: { chars: ['柱'], color: 0x888888 },
  [TileType.CORRIDOR]: { chars: ['廊'], color: 0x1a1a1a },
};

// ─── 實體類型 ──────────────────────────────────────────────────
export const enum EntityType {
  PLAYER = 'player',
  ENEMY_WEAK = 'enemy_weak',
  ENEMY_MID = 'enemy_mid',
  ENEMY_ELITE = 'enemy_elite',
  BOSS = 'boss',
}

export interface EntityVisual {
  chars: string[];
  color: number;
}

export const ENTITY_VISUALS: Record<EntityType, EntityVisual> = {
  [EntityType.PLAYER]: { chars: ['人'], color: 0xFFD700 },
  [EntityType.ENEMY_WEAK]: { chars: ['鬼', '獸', '妖'], color: 0xFF4444 },
  [EntityType.ENEMY_MID]: { chars: ['魔', '將', '兵'], color: 0xFF6644 },
  [EntityType.ENEMY_ELITE]: { chars: ['龍', '將', '煞'], color: 0xFF8800 },
  [EntityType.BOSS]: { chars: ['王', '帝', '神'], color: 0xFF0088 },
};

// ─── 道具類型 ──────────────────────────────────────────────────
export const enum ItemType {
  WEAPON = 'weapon',
  POTION = 'potion',
  GOLD = 'gold',
}

export interface ItemVisual {
  chars: string[];
  color: number;
}

export const ITEM_VISUALS: Record<ItemType, ItemVisual> = {
  [ItemType.WEAPON]: { chars: ['劍', '弓', '杖', '斧'], color: 0xAAAAFF },
  [ItemType.POTION]: { chars: ['藥'], color: 0xFF88FF },
  [ItemType.GOLD]: { chars: ['金', '幣'], color: 0xFFCC00 },
};

// ─── 特效類型 ──────────────────────────────────────────────────
export const enum EffectType {
  HIT = 'hit',
  FIRE = 'fire',
  ICE = 'ice',
  SLASH = 'slash',
}

export interface EffectVisual {
  chars: string[];
  color: number;
}

export const EFFECT_VISUALS: Record<EffectType, EffectVisual> = {
  [EffectType.HIT]: { chars: ['擊', '撞', '痛'], color: 0xFFFFFF },
  [EffectType.FIRE]: { chars: ['燃', '炎', '火', '爆'], color: 0xFF6600 },
  [EffectType.ICE]: { chars: ['冰', '凍', '寒', '霜'], color: 0x88CCFF },
  [EffectType.SLASH]: { chars: ['斬', '刺', '裂', '砍'], color: 0xFFEEAA },
};

/** 從字符陣列隨機取一個（使用傳入的 RNG 以支援種子碼） */
export function pickChar(chars: string[], rng: () => number): string {
  return chars[Math.floor(rng() * chars.length)];
}
