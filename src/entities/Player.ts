import Phaser from 'phaser';
import { TILE_SIZE, PLAYER_SPEED, PLAYER_MAX_HP, COLORS } from '@/config';
import { TileMap } from '@/dungeon/TileMap';
import { ENTITY_VISUALS, EntityType } from '@/dungeon/tiles';

export class Player {
  // 地圖格座標（整數）
  mapX: number;
  mapY: number;

  // 像素座標（在視口內的顯示位置）
  pixelX: number;
  pixelY: number;

  hp: number;
  maxHp: number;
  level: number = 1;
  gold: number = 0;

  // Phaser Text 物件
  private text: Phaser.GameObjects.Text;
  private dirIndicator: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  // 朝向（用於攻擊判定）
  faceDx: number = 0;
  faceDy: number = 1;

  constructor(scene: Phaser.Scene, mapX: number, mapY: number) {
    this.scene = scene;
    this.mapX = mapX;
    this.mapY = mapY;
    this.pixelX = 0;
    this.pixelY = 0;
    this.hp = PLAYER_MAX_HP;
    this.maxHp = PLAYER_MAX_HP;

    const visual = ENTITY_VISUALS[EntityType.PLAYER];
    this.text = scene.add.text(0, 0, visual.chars[0], {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: `${TILE_SIZE}px`,
      color: Phaser.Display.Color.IntegerToColor(COLORS.PLAYER).rgba,
      resolution: window.devicePixelRatio || 1,
    });
    this.text.setOrigin(0, 0);
    this.text.setDepth(10);

    this.dirIndicator = scene.add.text(0, 0, '▼', {
      fontFamily: 'monospace',
      fontSize: `${Math.floor(TILE_SIZE * 0.7)}px`,
      color: '#00FFFF',
      resolution: window.devicePixelRatio || 1,
    });
    this.dirIndicator.setOrigin(0.5, 0.5);
    this.dirIndicator.setDepth(11);
  }

  /** 更新顯示位置（根據視口偏移計算螢幕座標）*/
  updateScreenPos(viewX: number, viewY: number, offsetY: number) {
    this.pixelX = (this.mapX - viewX) * TILE_SIZE;
    this.pixelY = offsetY + (this.mapY - viewY) * TILE_SIZE;
    this.text.setPosition(this.pixelX, this.pixelY);

    // 方向指示器：顯示於朝向格中心
    const arrowChar = this.faceDy < 0 ? '▲' : this.faceDy > 0 ? '▼' : this.faceDx < 0 ? '◀' : '▶';
    this.dirIndicator.setText(arrowChar);
    this.dirIndicator.setPosition(
      (this.mapX - viewX + this.faceDx) * TILE_SIZE + TILE_SIZE * 0.5,
      offsetY + (this.mapY - viewY + this.faceDy) * TILE_SIZE + TILE_SIZE * 0.5,
    );
  }

  /** 嘗試移動到地圖格 (nx, ny)，回傳是否成功 */
  tryMove(nx: number, ny: number, map: TileMap): boolean {
    const dx = nx - this.mapX;
    const dy = ny - this.mapY;
    if (dx !== 0 || dy !== 0) {
      this.faceDx = Math.sign(dx);
      this.faceDy = Math.sign(dy);
    }

    if (!map.isPassable(nx, ny)) return false;
    this.mapX = nx;
    this.mapY = ny;
    return true;
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isAlive(): boolean { return this.hp > 0; }

  destroy() { this.text.destroy(); this.dirIndicator.destroy(); }
}
