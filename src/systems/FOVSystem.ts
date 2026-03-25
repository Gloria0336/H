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

  /** 更新以 (cx, cy) 為中心的視野，回傳所有有變化的格子座標
   *  @param radius 可選視野半徑（預設 FOV_RADIUS）；在廊中傳入較小值 */
  update(cx: number, cy: number, radius: number = FOV_RADIUS): { x: number; y: number }[] {
    const changed: { x: number; y: number }[] = [];

    // 清除時固定用最大半徑，確保上一幀的 VISIBLE 都被清掉
    const clearR = FOV_RADIUS + 2;
    for (let dy = -clearR; dy <= clearR; dy++) {
      for (let dx = -clearR; dx <= clearR; dx++) {
        const nx = cx + dx, ny = cy + dy;
        const cell = this.map.get(nx, ny);
        if (cell && cell.fov === FovState.VISIBLE) {
          cell.fov = FovState.DIMMED;
          changed.push({ x: nx, y: ny });
        }
      }
    }

    // 計算新視野（使用傳入的 radius）
    this.fov.compute(cx, cy, radius, (x: number, y: number) => {
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
