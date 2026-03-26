import * as ROT from 'rot-js';
import { TileMap, FovState } from './TileMap';
import { TileType, TILE_VISUALS, pickChar } from './tiles';

function getFloorMapSize(floor: number): { cols: number; rows: number } {
  if (floor <= 3) return { cols: 30, rows: 30 };
  if (floor <= 6) return { cols: 50, rows: 50 };
  if (floor <= 9) return { cols: 80, rows: 80 };
  return { cols: 50, rows: 50 }; // floor 10
}

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
    const { cols, rows } = getFloorMapSize(this.floorNumber);
    const map = new TileMap(cols, rows);

    // Step 1：初始化全部為牆
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        map.set(x, y, {
          type:        TileType.WALL,
          char:        '牆',
          passable:    false,
          transparent: false,
          fov:         FovState.DARK,
        });
      }
    }

    // Step 2：在地圖上隨機放置指定數量的房間
    const target = FLOOR_ROOM_COUNTS[this.floorNumber] ?? 5;
    const rooms: Room[] = [];

    const MIN_W = 5, MAX_W = 10, MIN_H = 4, MAX_H = 8;
    const MAX_ATTEMPTS = 300;

    for (let i = 0; i < target; i++) {
      let placed = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
        const w = MIN_W + Math.floor(ROT.RNG.getUniform() * (MAX_W - MIN_W + 1));
        const h = MIN_H + Math.floor(ROT.RNG.getUniform() * (MAX_H - MIN_H + 1));
        const x = 1 + Math.floor(ROT.RNG.getUniform() * (cols - w - 2));
        const y = 1 + Math.floor(ROT.RNG.getUniform() * (rows - h - 2));

        // 與現有房間不可重疊（含 1 格邊距）
        const overlaps = rooms.some(r =>
          x <= r.x + r.w && x + w >= r.x &&
          y <= r.y + r.h && y + h >= r.y
        );
        if (overlaps) continue;

        const cx = x + Math.floor(w / 2);
        const cy = y + Math.floor(h / 2);
        rooms.push({ x, y, w, h, cx, cy });

        for (let ry = y; ry < y + h; ry++) {
          for (let rx = x; rx < x + w; rx++) {
            map.set(rx, ry, {
              type:        TileType.FLOOR,
              char:        '　',
              passable:    true,
              transparent: true,
              fov:         FovState.DARK,
            });
          }
        }
        placed = true;
      }
    }

    // Step 3：用 MST 連接所有房間（或使用者自訂邏輯）
    if (this.logic.connectRooms) {
      this.logic.connectRooms(rooms, map, () => ROT.RNG.getUniform());
    } else {
      this.connectRoomsWithMST(rooms, map);
    }

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
    const { cols, rows } = getFloorMapSize(this.floorNumber);
    const map = new TileMap(cols, rows);

    // 初始化全部為 WALL
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        map.set(x, y, {
          type: TileType.WALL, char: '牆',
          passable: false, transparent: false, fov: FovState.DARK,
        });
      }
    }

    // 20×15 的大廳置中
    const rw = 20, rh = 15;
    const rx = Math.floor((cols - rw) / 2);
    const ry = Math.floor((rows - rh) / 2);

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

  // ── MST 連接所有房間，再加 1-2 條 loop edge ─────────────────
  private connectRoomsWithMST(rooms: Room[], map: TileMap): void {
    if (rooms.length < 2) return;

    // Prim's 演算法（Manhattan 距離）
    const inMST = new Array(rooms.length).fill(false);
    const mstEdges: [number, number][] = [];
    inMST[0] = true;

    for (let step = 0; step < rooms.length - 1; step++) {
      let bestDist = Infinity, bestA = -1, bestB = -1;
      for (let a = 0; a < rooms.length; a++) {
        if (!inMST[a]) continue;
        for (let b = 0; b < rooms.length; b++) {
          if (inMST[b]) continue;
          const dist = Math.abs(rooms[a].cx - rooms[b].cx)
                     + Math.abs(rooms[a].cy - rooms[b].cy);
          if (dist < bestDist) { bestDist = dist; bestA = a; bestB = b; }
        }
      }
      inMST[bestB] = true;
      mstEdges.push([bestA, bestB]);
    }

    for (const [a, b] of mstEdges) {
      this.carveCorridorLShape(rooms[a], rooms[b], map);
    }

    // 收集非 MST 邊，隨機加 1-2 條 loop edge
    const mstSet = new Set(mstEdges.map(([a, b]) => `${Math.min(a,b)},${Math.max(a,b)}`));
    const extras: [number, number][] = [];
    for (let a = 0; a < rooms.length; a++) {
      for (let b = a + 1; b < rooms.length; b++) {
        if (!mstSet.has(`${a},${b}`)) extras.push([a, b]);
      }
    }

    // Fisher-Yates shuffle
    for (let i = extras.length - 1; i > 0; i--) {
      const j = Math.floor(ROT.RNG.getUniform() * (i + 1));
      [extras[i], extras[j]] = [extras[j], extras[i]];
    }

    const extraCount = extras.length === 0 ? 0 : (ROT.RNG.getUniform() < 0.5 ? 1 : 2);
    for (let i = 0; i < Math.min(extraCount, extras.length); i++) {
      this.carveCorridorLShape(rooms[extras[i][0]], rooms[extras[i][1]], map);
    }
  }

  // ── L 形走廊（水平→垂直 或 垂直→水平，隨機）────────────────
  private carveCorridorLShape(a: Room, b: Room, map: TileMap): void {
    const horizFirst = ROT.RNG.getUniform() < 0.5;
    const bendX = horizFirst ? b.cx : a.cx;
    const bendY = horizFirst ? a.cy : b.cy;
    this.carveLine(a.cx, a.cy, bendX, bendY, map);
    this.carveLine(bendX, bendY, b.cx, b.cy, map);
  }

  // ── 直線挖廊（只覆蓋 WALL，不覆蓋 FLOOR/DOOR/EXIT）────────
  private carveLine(x1: number, y1: number, x2: number, y2: number, map: TileMap): void {
    const dx = x1 === x2 ? 0 : (x2 > x1 ? 1 : -1);
    const dy = y1 === y2 ? 0 : (y2 > y1 ? 1 : -1);
    let x = x1, y = y1;
    while (true) {
      const cell = map.get(x, y);
      if (cell?.type === TileType.WALL) {
        map.set(x, y, {
          type:        TileType.CORRIDOR,
          char:        '廊',
          passable:    true,
          transparent: true,
          fov:         FovState.DARK,
        });
      }
      if (x === x2 && y === y2) break;
      x += dx;
      y += dy;
    }
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

  // ── 放置門（locked 房間：唯一入口一格寬，只放一個門）──────
  private placeDoors(rooms: Room[], map: TileMap) {
    rooms.filter(r => r.locked).forEach(r => {
      // 收集所有邊界 FLOOR 格且鄰接 CORRIDOR 的候選格
      const candidates: [number, number][] = [];
      for (let x = r.x; x < r.x + r.w; x++) {
        for (let y = r.y; y < r.y + r.h; y++) {
          const onEdge = x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1;
          if (!onEdge) continue;
          if (map.get(x, y)?.type !== TileType.FLOOR) continue;
          const touchesCorridor = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]
            .some(([nx,ny]) => map.get(nx, ny)?.type === TileType.CORRIDOR);
          if (touchesCorridor) candidates.push([x, y]);
        }
      }
      if (candidates.length === 0) return;

      // BFS：將相鄰候選格分組（走廊從同一段外牆進入算同一入口）
      const candidateSet = new Set(candidates.map(([x,y]) => `${x},${y}`));
      const visited = new Set<string>();
      const groups: [number, number][][] = [];
      for (const [sx, sy] of candidates) {
        const key = `${sx},${sy}`;
        if (visited.has(key)) continue;
        const group: [number, number][] = [];
        const queue: [number, number][] = [[sx, sy]];
        visited.add(key);
        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          group.push([cx, cy]);
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
            const nk = `${cx+dx},${cy+dy}`;
            if (!visited.has(nk) && candidateSet.has(nk)) {
              visited.add(nk);
              queue.push([cx+dx, cy+dy]);
            }
          }
        }
        groups.push(group);
      }

      // 只保留第一個入口群組；其餘候選格全部封牆
      const chosen = groups[0];
      const chosenSet = new Set(chosen.map(([x,y]) => `${x},${y}`));
      for (const [x, y] of candidates) {
        if (!chosenSet.has(`${x},${y}`)) {
          map.set(x, y, { type: TileType.WALL, char: '牆', passable: false, transparent: false, fov: FovState.DARK });
        }
      }

      // 選中群組：中間格放門，其餘格封牆 → 入口恰好一格寬
      const mid = Math.floor(chosen.length / 2);
      chosen.forEach(([x, y], i) => {
        if (i === mid) {
          map.set(x, y, { type: TileType.DOOR, char: '門', passable: false, transparent: false, fov: FovState.DARK });
        } else {
          map.set(x, y, { type: TileType.WALL, char: '牆', passable: false, transparent: false, fov: FovState.DARK });
        }
      });
    });
  }
}
