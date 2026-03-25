import * as ROT from 'rot-js';
import { MAP_COLS, MAP_ROWS } from '@/config';
import { TileMap, FovState } from './TileMap';
import { TileType, TILE_VISUALS, pickChar } from './tiles';

// ─── 房間資料 ─────────────────────────────────────────────────
export interface Room {
  x: number; y: number;
  w: number; h: number;
  cx: number; cy: number;    // 中心點
  tag?: 'start' | 'boss' | 'treasure' | 'normal';
}

// ─── 空間串接邏輯介面（預留使用者擴充）─────────────────────────
export interface RoomTypeDef {
  tag: Room['tag'];
  minCount?: number;
  maxCount?: number;
  minW?: number; maxW?: number;
  minH?: number; maxH?: number;
}

export interface ConnectionLogicDef {
  roomTypes?: RoomTypeDef[];
  // 使用者後續補充的串接規則
  connectRooms?: (rooms: Room[], map: TileMap, rng: () => number) => void;
}

// ─── 地牢生成器 ───────────────────────────────────────────────
export class DungeonGenerator {
  private seed: number;
  private logic: ConnectionLogicDef;

  constructor(seed?: number, logic: ConnectionLogicDef = {}) {
    this.seed = seed ?? Math.floor(Math.random() * 0xFFFFFF);
    this.logic = logic;
  }

  getSeed(): number { return this.seed; }

  generate(): { map: TileMap; rooms: Room[]; playerStart: { x: number; y: number } } {
    // Step 1: 初始化種子 RNG
    ROT.RNG.setSeed(this.seed);

    const map = new TileMap(MAP_COLS, MAP_ROWS);

    // Step 2: 用 rot.js Digger（BSP）生成地圖
    const rotMap = new ROT.Map.Digger(MAP_COLS, MAP_ROWS, {
      roomWidth: [5, 12],
      roomHeight: [4, 10],
      dugPercentage: 0.35,
      timeLimit: 1000,
    });

    const floorCells = new Set<string>();

    rotMap.create((x, y, wall) => {
      if (!wall) {
        floorCells.add(`${x},${y}`);
        map.set(x, y, {
          type: TileType.FLOOR,
          char: pickChar(TILE_VISUALS[TileType.FLOOR].chars, () => ROT.RNG.getUniform()),
          passable: true,
          transparent: true,
          fov: FovState.DARK,
        });
      } else {
        map.set(x, y, {
          type: TileType.WALL,
          char: pickChar(TILE_VISUALS[TileType.WALL].chars, () => ROT.RNG.getUniform()),
          passable: false,
          transparent: false,
          fov: FovState.DARK,
        });
      }
    });

    // Step 3: 擷取房間資訊
    const rooms: Room[] = rotMap.getRooms().map(r => ({
      x: r.getLeft(), y: r.getTop(),
      w: r.getRight() - r.getLeft() + 1,
      h: r.getBottom() - r.getTop() + 1,
      cx: Math.floor((r.getLeft() + r.getRight()) / 2),
      cy: Math.floor((r.getTop() + r.getBottom()) / 2),
      tag: 'normal' as const,
    }));

    // 如果使用者提供自訂串接邏輯，執行它
    if (this.logic.connectRooms) {
      this.logic.connectRooms(rooms, map, () => ROT.RNG.getUniform());
    }

    // Step 4: 標記特殊房間
    if (rooms.length > 0) {
      rooms[0].tag = 'start';
      if (rooms.length > 1) rooms[rooms.length - 1].tag = 'boss';
      if (rooms.length > 2) rooms[Math.floor(rooms.length / 2)].tag = 'treasure';
    }

    // 寶藏房放置寶箱
    rooms.filter(r => r.tag === 'treasure').forEach(r => {
      map.set(r.cx, r.cy, {
        type: TileType.CHEST,
        char: pickChar(TILE_VISUALS[TileType.CHEST].chars, () => ROT.RNG.getUniform()),
        passable: false,
        transparent: true,
        fov: FovState.DARK,
      });
    });

    // Boss 房放置出口
    const bossRoom = rooms.find(r => r.tag === 'boss');
    if (bossRoom) {
      map.set(bossRoom.cx, bossRoom.cy + 1, {
        type: TileType.EXIT,
        char: pickChar(TILE_VISUALS[TileType.EXIT].chars, () => ROT.RNG.getUniform()),
        passable: true,
        transparent: true,
        fov: FovState.DARK,
      });
    }

    // Step 5: 玩家起點
    const startRoom = rooms[0];
    const playerStart = startRoom
      ? { x: startRoom.cx, y: startRoom.cy }
      : this.findFloor(map, floorCells);

    return { map, rooms, playerStart };
  }

  private findFloor(map: TileMap, floorCells: Set<string>): { x: number; y: number } {
    const key = floorCells.values().next().value ?? '1,1';
    const [x, y] = (key as string).split(',').map(Number);
    return { x, y };
  }
}
