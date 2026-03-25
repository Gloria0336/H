import Phaser from 'phaser';
import { TILE_SIZE, COLORS } from '@/config';
import { TileMap, FovState } from '@/dungeon/TileMap';
import { TileType } from '@/dungeon/tiles';

// 每個格子對應一個 Phaser.GameObjects.Text
// 只建立視口內的 Text 物件，超出範圍的隱藏

export interface RendererOptions {
  scene: Phaser.Scene;
  map: TileMap;
  viewCols: number;
  viewRows: number;
  offsetY?: number;   // 頂部 HUD 偏移（px）
}

export class ChineseRenderer {
  private scene: Phaser.Scene;
  private map: TileMap;
  private viewCols: number;
  private viewRows: number;
  private offsetY: number;

  // 視口格子的 Text 物件池（固定 viewCols × viewRows 個）
  private pool: Phaser.GameObjects.Text[][] = [];

  // 當前視口左上角（地圖格座標）
  private viewX = 0;
  private viewY = 0;

  // 標記需要重繪的格子（地圖座標）
  private dirty = new Set<string>();

  constructor(opts: RendererOptions) {
    this.scene = opts.scene;
    this.map = opts.map;
    this.viewCols = opts.viewCols;
    this.viewRows = opts.viewRows;
    this.offsetY = opts.offsetY ?? 0;

    this.buildPool();
  }

  private buildPool() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: `${TILE_SIZE}px`,
      color: '#ffffff',
      resolution: window.devicePixelRatio || 1,
    };

    for (let row = 0; row < this.viewRows; row++) {
      this.pool[row] = [];
      for (let col = 0; col < this.viewCols; col++) {
        const txt = this.scene.add.text(
          col * TILE_SIZE,
          this.offsetY + row * TILE_SIZE,
          '　',
          style
        );
        txt.setOrigin(0, 0);
        txt.setDepth(0);
        this.pool[row][col] = txt;
      }
    }
  }

  /** 將地圖座標轉換為顏色 */
  private cellColor(mapX: number, mapY: number): number {
    const cell = this.map.get(mapX, mapY);
    if (!cell || cell.fov === FovState.DARK) return 0x000000;
    if (cell.fov === FovState.DIMMED) return COLORS.DIMMED;

    switch (cell.type) {
      case TileType.WALL:  return COLORS.WALL;
      case TileType.FLOOR: return COLORS.FLOOR;
      case TileType.DOOR:  return COLORS.DOOR;
      case TileType.CHEST: return COLORS.CHEST;
      case TileType.EXIT:  return COLORS.EXIT;
      default:             return COLORS.FLOOR;
    }
  }

  /** 更新視口位置並重繪所有格子 */
  setView(mapX: number, mapY: number) {
    this.viewX = mapX;
    this.viewY = mapY;
    this.redrawAll();
  }

  /** 重繪整個視口 */
  redrawAll() {
    for (let row = 0; row < this.viewRows; row++) {
      for (let col = 0; col < this.viewCols; col++) {
        this.redrawCell(col, row);
      }
    }
    this.dirty.clear();
  }

  /** 只重繪有變化的格子 */
  redrawDirty() {
    this.dirty.forEach(key => {
      const [mx, my] = key.split(',').map(Number);
      const col = mx - this.viewX;
      const row = my - this.viewY;
      if (col >= 0 && col < this.viewCols && row >= 0 && row < this.viewRows) {
        this.redrawCell(col, row);
      }
    });
    this.dirty.clear();
  }

  markDirty(mapX: number, mapY: number) {
    this.dirty.add(`${mapX},${mapY}`);
  }

  markDirtyBatch(cells: { x: number; y: number }[]) {
    cells.forEach(c => this.dirty.add(`${c.x},${c.y}`));
  }

  private redrawCell(col: number, row: number) {
    const mx = this.viewX + col;
    const my = this.viewY + row;
    const cell = this.map.get(mx, my);
    const txt = this.pool[row][col];

    if (!cell || cell.fov === FovState.DARK) {
      txt.setText('　');
      txt.setColor('#000000');
      return;
    }

    txt.setText(cell.char);
    const color = this.cellColor(mx, my);
    txt.setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
  }

  destroy() {
    this.pool.forEach(row => row.forEach(t => t.destroy()));
    this.pool = [];
  }
}
