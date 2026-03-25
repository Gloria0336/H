import * as ROT from 'rot-js';
import { MAP_COLS, MAP_ROWS } from '@/config';
import { TileMap, FovState } from './TileMap';
import { TileType, TILE_VISUALS, pickChar } from './tiles';

// ─── 房間資料 ─────────────────────────────────────────────────
export interface Room {
  x: number; y: number;
  w: number; h: number;
  cx: number; cy: number;    // 中心點
  tag?: 'entrance' | 'throne' | 'boss' | 'treasure' | 'normal' | 'start';
  locked?: boolean;
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
  connectRooms?: (rooms: Room[], map: TileMap, rng: () => number) => void;
}

// ─── 每層目標房間數 ────────────────────────────────────────────
const FLOOR_ROOM_COUNTS: Record<number, number> = {
  1: 3, 2: 3,
  3: 5, 4: 5, 5: 5,
  6: 8, 7: 8, 8: 8,
  9: 9,
  10: 1,
};

// ─── 地牢生成器 ───────────────────────────────────────────────
export class DungeonGenerator {
  private floorNumber: number;
  private seed: number;
  private logic: ConnectionLogicDef;

  constructor(floorNumber = 1, seed?: number, logic: ConnectionLogicDef = {}) {
    this.floorNumber = floorNumber;
    this.seed = seed ?? Math.floor(Math.random() * 0xFFFFFF);
    this.logic = logic;
  }

  getSeed(): number { return this.seed; }

  generate(): { map: TileMap; rooms: Room[]; playerStart: { x: number; y: number } } {
    ROT.RNG.setSeed(this.seed);

    // ── 第 10 層：手動建王座廳 ──────────────────────────────────
    if (this.floorNumber === 10) {
      return this.buildThroneFloor();
    }

    // ── 一般地層生成 ────────────────────────────────────────────
    const map = new TileMap(MAP_COLS, MAP_ROWS);

    const rotMap = new ROT.Map.Digger(MAP_COLS, MAP_ROWS, {
      roomWidth:     [5, 12],
      roomHeight:    [4, 10],
      dugPercentage: 0.40,
      timeLimit:     1000,
    });

    rotMap.create((x, y, wall) => {
      if (!wall) {
        map.set(x, y, {
          type:        TileType.FLOOR,
          char:        '　',
          passable:    true,
          transparent: true,
          fov:         FovState.DARK,
        });
      } else {
        map.set(x, y, {
          type:        TileType.WALL,
          char:        '牆',
          passable:    false,
          transparent: false,
          fov:         FovState.DARK,
        });
      }
    });

    // ── 擷取並裁剪房間 ──────────────────────────────────────────
    const target = FLOOR_ROOM_COUNTS[this.floorNumber] ?? 5;
    const rawRooms = rotMap.getRooms();
    const keptRaw  = rawRooms.slice(0, target);

    // ── 標記房間內格子（用以區分 FLOOR vs CORRIDOR）─────────────
    const roomCells = new Set<string>();
    keptRaw.forEach(r => {
      for (let y = r.getTop(); y <= r.getBottom(); y++)
        for (let x = r.getLeft(); x <= r.getRight(); x++)
          roomCells.add(`${x},${y}`);
    });

    // ── FLOOR → CORRIDOR（非房間內的通道）──────────────────────
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const cell = map.get(x, y);
        if (cell?.type === TileType.FLOOR && !roomCells.has(`${x},${y}`)) {
          map.set(x, y, {
            type:        TileType.CORRIDOR,
            char:        '廊',
            passable:    true,
            transparent: false,
            fov:         FovState.DARK,
          });
        }
      }
    }

    // ── 轉換為 Room[] ────────────────────────────────────────────
    const rooms: Room[] = keptRaw.map(r => ({
      x:  r.getLeft(),
      y:  r.getTop(),
      w:  r.getRight()  - r.getLeft() + 1,
      h:  r.getBottom() - r.getTop()  + 1,
      cx: Math.floor((r.getLeft() + r.getRight())  / 2),
      cy: Math.floor((r.getTop()  + r.getBottom()) / 2),
    }));

    // ── 標記特殊房間 ─────────────────────────────────────────────
    if (rooms.length > 0) {
      rooms[0].tag = this.floorNumber === 1 ? 'entrance' : 'start';
    }
    if (rooms.length > 1) {
      rooms[rooms.length - 1].tag = 'boss';
    }
    if (rooms.length > 2) {
      const midIdx = Math.floor(rooms.length / 2);
      rooms[midIdx].tag   = 'treasure';
      rooms[midIdx].locked = true;
    }
    rooms.forEach(r => { if (!r.tag) r.tag = 'normal'; });

    // ── 使用者自訂串接邏輯 ────────────────────────────────────────
    if (this.logic.connectRooms) {
      this.logic.connectRooms(rooms, map, () => ROT.RNG.getUniform());
    }

    // ── 放置柱（大房間）─────────────────────────────────────────
    this.placePillars(rooms, map);

    // ── 放置門（treasure room 邊界接廊處）────────────────────────
    this.placeDoors(rooms, map);

    // ── 放置寶箱 ─────────────────────────────────────────────────
    rooms.filter(r => r.tag === 'treasure').forEach(r => {
      map.set(r.cx, r.cy, {
        type:        TileType.CHEST,
        char:        '寶',
        passable:    false,
        transparent: true,
        fov:         FovState.DARK,
      });
    });

    // ── 放置出口 ─────────────────────────────────────────────────
    const bossRoom = rooms.find(r => r.tag === 'boss');
    if (bossRoom) {
      map.set(bossRoom.cx, bossRoom.cy + 1, {
        type:        TileType.EXIT,
        char:        pickChar(TILE_VISUALS[TileType.EXIT].chars, () => ROT.RNG.getUniform()),
        passable:    true,
        transparent: true,
        fov:         FovState.DARK,
      });
    }

    // ── 玩家起點 ─────────────────────────────────────────────────
    const startRoom  = rooms[0];
    const playerStart = startRoom
      ? { x: startRoom.cx, y: startRoom.cy }
      : { x: 1, y: 1 };

    return { map, rooms, playerStart };
  }

  // ── 第 10 層王座廳（手動建）────────────────────────────────────
  private buildThroneFloor(): { map: TileMap; rooms: Room[]; playerStart: { x: number; y: number } } {
    const map = new TileMap(MAP_COLS, MAP_ROWS);

    // 初始化全部為 WALL
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        map.set(x, y, {
          type: TileType.WALL, char: '牆',
          passable: false, transparent: false, fov: FovState.DARK,
        });
      }
    }

    // 20×15 的大廳置中
    const rw = 20, rh = 15;
    const rx = Math.floor((MAP_COLS - rw) / 2);
    const ry = Math.floor((MAP_ROWS - rh) / 2);

    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        map.set(x, y, {
          type: TileType.FLOOR, char: '　',
          passable: true, transparent: true, fov: FovState.DARK,
        });
      }
    }

    const cx = rx + Math.floor(rw / 2);
    const cy = ry + Math.floor(rh / 2);

    // 放置出口
    map.set(cx, cy, {
      type: TileType.EXIT, char: '梯',
      passable: true, transparent: true, fov: FovState.DARK,
    });

    // 四根柱子
    const pillarPositions = [[-3, -2], [3, -2], [-3, 2], [3, 2]];
    pillarPositions.forEach(([dx, dy]) => {
      map.set(cx + dx, cy + dy, {
        type: TileType.PILLAR, char: '柱',
        passable: false, transparent: false, fov: FovState.DARK,
      });
    });

    const throneRoom: Room = {
      x: rx, y: ry, w: rw, h: rh, cx, cy, tag: 'throne',
    };

    return {
      map,
      rooms: [throneRoom],
      playerStart: { x: cx, y: cy - 4 },
    };
  }

  // ── 放置柱 ─────────────────────────────────────────────────────
  private placePillars(rooms: Room[], map: TileMap) {
    rooms.forEach(r => {
      if (r.tag === 'treasure' || r.tag === 'boss') return;
      if (r.w <= 6 || r.h <= 5) return;

      const offsets = [[-2, -1], [2, -1], [-2, 1], [2, 1]];
      offsets.forEach(([dx, dy]) => {
        const px = r.cx + dx;
        const py = r.cy + dy;
        // 確認在房間內（非邊界）且為 FLOOR
        if (px > r.x && px < r.x + r.w - 1 && py > r.y && py < r.y + r.h - 1) {
          const cell = map.get(px, py);
          if (cell?.type === TileType.FLOOR) {
            map.set(px, py, {
              type:        TileType.PILLAR,
              char:        '柱',
              passable:    false,
              transparent: false,
              fov:         FovState.DARK,
            });
          }
        }
      });
    });
  }

  // ── 放置門（locked 房間邊界接廊處）────────────────────────────
  private placeDoors(rooms: Room[], map: TileMap) {
    rooms.filter(r => r.locked).forEach(r => {
      for (let x = r.x; x < r.x + r.w; x++) {
        for (let y = r.y; y < r.y + r.h; y++) {
          const onEdge = (x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1);
          if (!onEdge) continue;
          const cell = map.get(x, y);
          if (cell?.type !== TileType.FLOOR) continue;

          // 鄰接到 CORRIDOR 才放門
          const neighbours = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
          const touchesCorridor = neighbours.some(([nx,ny]) => map.get(nx, ny)?.type === TileType.CORRIDOR);
          if (touchesCorridor) {
            map.set(x, y, {
              type:        TileType.DOOR,
              char:        '門',
              passable:    false,
              transparent: false,
              fov:         FovState.DARK,
            });
          }
        }
      }
    });
  }
}
