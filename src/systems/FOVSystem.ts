import * as ROT from 'rot-js';
import { TileMap, FovState } from '@/dungeon/TileMap';
import { FOV_RADIUS } from '@/config';

export class FOVSystem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fov: any;
  private map: TileMap;

  constructor(map: TileMap) {
    this.map = map;
    this.fov = new ROT.FOV.PreciseShadowcasting(
      (x: number, y: number) => this.map.isTransparent(x, y),
      { topology: 8 }
    );
  }

  /** 更新以 (cx, cy) 為中心的視野，回傳所有有變化的格子座標 */
  update(cx: number, cy: number): { x: number; y: number }[] {
    const changed: { x: number; y: number }[] = [];

    // 先將所有 VISIBLE 降為 DIMMED（只掃附近範圍）
    const r = FOV_RADIUS + 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx, ny = cy + dy;
        const cell = this.map.get(nx, ny);
        if (cell && cell.fov === FovState.VISIBLE) {
          cell.fov = FovState.DIMMED;
          changed.push({ x: nx, y: ny });
        }
      }
    }

    // 計算新視野
    this.fov.compute(cx, cy, FOV_RADIUS, (x: number, y: number) => {
      const cell = this.map.get(x, y);
      if (cell) {
        const wasVisible = cell.fov === FovState.VISIBLE;
        cell.fov = FovState.VISIBLE;
        if (!wasVisible) changed.push({ x, y });
      }
    });

    return changed;
  }
}
