import Phaser from 'phaser';
import { TILE_SIZE, COLORS } from '@/config';
import { TileMap } from '@/dungeon/TileMap';
import { ENTITY_VISUALS, EntityType } from '@/dungeon/tiles';

export interface EnemyConfig {
  type: EntityType;
  hp: number;
  atk: number;
  speed: number;        // 移動間隔（ms）
  detectRange: number;  // 偵測玩家距離（格）
}

export const ENEMY_CONFIGS: Record<EntityType, EnemyConfig> = {
  [EntityType.PLAYER]:      { type: EntityType.PLAYER,      hp: 0,   atk: 0,  speed: 500, detectRange: 0 },
  [EntityType.ENEMY_WEAK]:  { type: EntityType.ENEMY_WEAK,  hp: 20,  atk: 5,  speed: 700, detectRange: 6 },
  [EntityType.ENEMY_MID]:   { type: EntityType.ENEMY_MID,   hp: 40,  atk: 10, speed: 600, detectRange: 7 },
  [EntityType.ENEMY_ELITE]: { type: EntityType.ENEMY_ELITE, hp: 80,  atk: 18, speed: 500, detectRange: 8 },
  [EntityType.BOSS]:        { type: EntityType.BOSS,        hp: 200, atk: 30, speed: 400, detectRange: 12 },
};

export type EnemyState = 'patrol' | 'chase';

export class Enemy {
  mapX: number;
  mapY: number;
  hp: number;
  readonly config: EnemyConfig;
  readonly entityType: EntityType;

  private text: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  state: EnemyState = 'patrol';
  private moveTimer = 0;

  // 巡邏起點
  private patrolX: number;
  private patrolY: number;

  constructor(scene: Phaser.Scene, type: EntityType, mapX: number, mapY: number) {
    this.scene = scene;
    this.entityType = type;
    this.mapX = mapX;
    this.mapY = mapY;
    this.patrolX = mapX;
    this.patrolY = mapY;
    this.config = ENEMY_CONFIGS[type];
    this.hp = this.config.hp;

    const visual = ENTITY_VISUALS[type];
    const char = visual.chars[Math.floor(Math.random() * visual.chars.length)];
    const color = this.colorForType(type);

    this.text = scene.add.text(0, 0, char, {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: `${TILE_SIZE}px`,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      resolution: window.devicePixelRatio || 1,
    });
    this.text.setOrigin(0, 0);
    this.text.setDepth(9);
    this.text.setVisible(false);
  }

  private colorForType(t: EntityType): number {
    switch (t) {
      case EntityType.ENEMY_ELITE: return COLORS.ENEMY_ELITE;
      case EntityType.BOSS:        return COLORS.BOSS;
      default:                     return COLORS.ENEMY;
    }
  }

  /** 更新顯示（只顯示視口內且 FOV 可見的敵人）*/
  updateScreenPos(viewX: number, viewY: number, offsetY: number, inFov: boolean) {
    const col = this.mapX - viewX;
    const row = this.mapY - viewY;
    const inView = col >= 0 && row >= 0;

    if (inView && inFov) {
      this.text.setPosition(col * TILE_SIZE, offsetY + row * TILE_SIZE);
      this.text.setVisible(true);
    } else {
      this.text.setVisible(false);
    }
  }

  /** AI 更新（每幀呼叫，delta 單位 ms）*/
  update(
    delta: number,
    map: TileMap,
    playerX: number, playerY: number,
    onAttack: (enemy: Enemy) => void
  ) {
    this.moveTimer += delta;
    if (this.moveTimer < this.config.speed) return;
    this.moveTimer = 0;

    const dist = Math.abs(this.mapX - playerX) + Math.abs(this.mapY - playerY);

    if (dist <= this.config.detectRange) {
      this.state = 'chase';
    } else {
      this.state = 'patrol';
    }

    if (this.state === 'chase') {
      // 走向玩家
      const dx = Math.sign(playerX - this.mapX);
      const dy = Math.sign(playerY - this.mapY);

      if (dist === 1) {
        // 相鄰 → 攻擊
        onAttack(this);
      } else {
        // 嘗試水平或垂直移動
        if (dx !== 0 && map.isPassable(this.mapX + dx, this.mapY)) {
          this.mapX += dx;
        } else if (dy !== 0 && map.isPassable(this.mapX, this.mapY + dy)) {
          this.mapY += dy;
        }
      }
    } else {
      // 巡邏：隨機小範圍遊走
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      const [rdx, rdy] = dirs[Math.floor(Math.random() * dirs.length)];
      const nx = this.mapX + rdx;
      const ny = this.mapY + rdy;
      const patrolDist = Math.abs(nx - this.patrolX) + Math.abs(ny - this.patrolY);
      if (patrolDist <= 3 && map.isPassable(nx, ny)) {
        this.mapX = nx;
        this.mapY = ny;
      }
    }
  }

  takeDamage(amount: number) { this.hp -= amount; }
  isAlive(): boolean { return this.hp > 0; }

  destroy() { this.text.destroy(); }
}
