import { MAP_COLS, MAP_ROWS } from '@/config';
import { TileType } from './tiles';

// ─── FOV 狀態 ─────────────────────────────────────────────────
export const enum FovState {
  DARK     = 0,   // 未探索
  DIMMED   = 1,   // 已探索但不在視野
  VISIBLE  = 2,   // 當前視野內
}

// ─── 格子資料 ─────────────────────────────────────────────────
export interface Cell {
  type: TileType;
  char: string;       // 已確定的中文字符
  fov: FovState;
  passable: boolean;  // 是否可通行
  transparent: boolean; // 是否透明（FOV 用）
}

// ─── 地圖 ─────────────────────────────────────────────────────
export class TileMap {
  readonly cols: number;
  readonly rows: number;
  private cells: Cell[];

  constructor(cols = MAP_COLS, rows = MAP_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, () => ({
      type: TileType.EMPTY,
      char: '　',
      fov: FovState.DARK,
      passable: false,
      transparent: false,
    }));
  }

  idx(x: number, y: number): number {
    return y * this.cols + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  get(x: number, y: number): Cell | null {
    if (!this.inBounds(x, y)) return null;
    return this.cells[this.idx(x, y)];
  }

  set(x: number, y: number, data: Partial<Cell>): void {
    if (!this.inBounds(x, y)) return;
    Object.assign(this.cells[this.idx(x, y)], data);
  }

  setFov(x: number, y: number, state: FovState): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.idx(x, y)].fov = state;
  }

  isPassable(x: number, y: number): boolean {
    const cell = this.get(x, y);
    return cell ? cell.passable : false;
  }

  isTransparent(x: number, y: number): boolean {
    const cell = this.get(x, y);
    return cell ? cell.transparent : false;
  }
}
