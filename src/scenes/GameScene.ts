import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, TILE_SIZE,
  VIEW_COLS, DUNGEON_VIEW_ROWS, HUD_ROWS,
  PLAYER_SPEED, FOV_RADIUS, CORRIDOR_FOV_RADIUS,
} from '@/config';
import { DungeonGenerator } from '@/dungeon/DungeonGenerator';
import { TileMap } from '@/dungeon/TileMap';
import { ChineseRenderer } from '@/rendering/ChineseRenderer';
import { EffectPool } from '@/rendering/EffectPool';
import { FOVSystem } from '@/systems/FOVSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { EntityType, TileType } from '@/dungeon/tiles';
import { Room } from '@/dungeon/DungeonGenerator';

const HUD_OFFSET_Y = HUD_ROWS * TILE_SIZE; // 頂部 HUD 占用的像素高度

export class GameScene extends Phaser.Scene {
  private map!: TileMap;
  private rooms!: Room[];
  private tileRenderer!: ChineseRenderer;
  private fov!: FOVSystem;
  private effects!: EffectPool;
  private combat!: CombatSystem;
  private player!: Player;
  private enemies: Enemy[] = [];

  // 視口左上角（地圖格座標）
  private viewX = 0;
  private viewY = 0;

  // 鍵盤方向
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  // 搖桿輸入（來自 UIScene）
  joystickVec: { x: number; y: number } = { x: 0, y: 0 };

  // 移動速度限流（避免過快）
  private moveAccum = 0;
  private readonly MOVE_INTERVAL = 1000 / PLAYER_SPEED * TILE_SIZE; // ms per tile

  // 當前樓層
  floor = 1;
  currentSeed = 0;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    this.generateFloor();
    this.setupInput();
  }

  private generateFloor(seed?: number) {
    // 清理上一層
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.tileRenderer?.destroy();
    this.effects?.destroy();

    const gen = new DungeonGenerator(this.floor, seed);
    this.currentSeed = gen.getSeed();
    const { map, rooms, playerStart } = gen.generate();
    this.map = map;
    this.rooms = rooms;

    // 渲染器
    this.tileRenderer = new ChineseRenderer({
      scene: this,
      map: this.map,
      viewCols: VIEW_COLS,
      viewRows: DUNGEON_VIEW_ROWS,
      offsetY: HUD_OFFSET_Y,
    });

    // 特效池
    this.effects = new EffectPool(this);
    // 戰鬥系統
    this.combat = new CombatSystem(this.effects);
    // FOV
    this.fov = new FOVSystem(this.map);

    // 玩家
    if (!this.player) {
      this.player = new Player(this, playerStart.x, playerStart.y);
    } else {
      this.player.mapX = playerStart.x;
      this.player.mapY = playerStart.y;
    }

    // 敵人（每個非起點非Boss房間放 1-2 個敵人）
    this.spawnEnemies();

    // 初始視口與 FOV
    this.centerViewOnPlayer();
    this.updateFOV();
    this.tileRenderer.redrawAll();
    this.player.updateScreenPos(this.viewX, this.viewY, HUD_OFFSET_Y);

    // 通知 UIScene 更新 HUD
    this.notifyUI();
  }

  private spawnEnemies() {
    this.rooms.forEach((room, i) => {
      if (room.tag === 'start' || room.tag === 'entrance' || room.tag === 'throne') return;

      const type = room.tag === 'boss'
        ? EntityType.BOSS
        : i % 3 === 0 ? EntityType.ENEMY_ELITE : EntityType.ENEMY_WEAK;

      const e = new Enemy(this, type, room.cx, room.cy);
      this.enemies.push(e);

      // 普通房間多加一個弱敵
      if (room.tag !== 'boss' && room.tag !== 'treasure') {
        const e2 = new Enemy(this, EntityType.ENEMY_WEAK, room.cx + 1, room.cy);
        this.enemies.push(e2);
      }
    });
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.input.keyboard.on('keydown-SPACE', () => this.playerAttackFacing());
      this.input.keyboard.on('keydown-Q',     () => this.playerSkill());
    }
  }

  update(_time: number, delta: number) {
    if (!this.player.isAlive()) return;

    this.moveAccum += delta;
    if (this.moveAccum >= this.MOVE_INTERVAL) {
      this.moveAccum = 0;
      this.handleMovement();
    }

    // 敵人 AI
    this.enemies.forEach(e => {
      if (!e.isAlive()) return;
      e.update(delta, this.map, this.player.mapX, this.player.mapY,
        (attacker) => {
          const result = this.combat.enemyAttack(attacker, this.player, this.viewX, this.viewY, HUD_OFFSET_Y);
          this.notifyUI();
          if (result.killed) this.onPlayerDead();
        }
      );
      e.updateScreenPos(this.viewX, this.viewY, HUD_OFFSET_Y,
        this.map.get(e.mapX, e.mapY)?.fov === 2 // FovState.VISIBLE
      );
    });

    // 清理死亡敵人
    const dead = this.enemies.filter(e => !e.isAlive());
    dead.forEach(e => e.destroy());
    this.enemies = this.enemies.filter(e => e.isAlive());
  }

  private handleMovement() {
    const jx = this.joystickVec.x;
    const jy = this.joystickVec.y;

    let dx = 0, dy = 0;

    // 搖桿（優先）
    if (Math.abs(jx) > 0.3 || Math.abs(jy) > 0.3) {
      if (Math.abs(jx) >= Math.abs(jy)) {
        dx = jx > 0 ? 1 : -1;
      } else {
        dy = jy > 0 ? 1 : -1;
      }
    } else if (this.cursors && this.wasd) {
      // 鍵盤
      if (this.cursors.left.isDown  || this.wasd.left.isDown)  dx = -1;
      if (this.cursors.right.isDown || this.wasd.right.isDown) dx =  1;
      if (this.cursors.up.isDown    || this.wasd.up.isDown)    dy = -1;
      if (this.cursors.down.isDown  || this.wasd.down.isDown)  dy =  1;
    }

    if (dx === 0 && dy === 0) return;

    const nx = this.player.mapX + dx;
    const ny = this.player.mapY + dy;

    // 檢查是否有敵人在目標格
    const targetEnemy = this.enemies.find(e => e.mapX === nx && e.mapY === ny && e.isAlive());
    if (targetEnemy) {
      const result = this.combat.playerAttack(this.player, targetEnemy, this.viewX, this.viewY, HUD_OFFSET_Y);
      if (result.killed) {
        targetEnemy.destroy();
        this.enemies = this.enemies.filter(e => e !== targetEnemy);
      }
      return;
    }

    // 移動
    if (this.player.tryMove(nx, ny, this.map)) {
      // 更新視口
      this.centerViewOnPlayer();
      // 廊內視野縮減
      const playerCell = this.map.get(this.player.mapX, this.player.mapY);
      const fovRadius  = playerCell?.type === TileType.CORRIDOR ? CORRIDOR_FOV_RADIUS : FOV_RADIUS;
      // 更新 FOV
      const changed = this.fov.update(this.player.mapX, this.player.mapY, fovRadius);
      this.tileRenderer.markDirtyBatch(changed);
      this.tileRenderer.redrawDirty();
      // 更新玩家顯示
      this.player.updateScreenPos(this.viewX, this.viewY, HUD_OFFSET_Y);

      // 檢查出口
      const cell = this.map.get(nx, ny);
      if (cell?.type === TileType.EXIT) {
        this.nextFloor();
      }

      this.notifyUI();
    }
  }

  private centerViewOnPlayer() {
    const halfCols = Math.floor(VIEW_COLS / 2);
    const halfRows = Math.floor(DUNGEON_VIEW_ROWS / 2);
    this.viewX = Math.max(0, Math.min(this.map.cols - VIEW_COLS, this.player.mapX - halfCols));
    this.viewY = Math.max(0, Math.min(this.map.rows - DUNGEON_VIEW_ROWS, this.player.mapY - halfRows));
    this.tileRenderer.setView(this.viewX, this.viewY);
  }

  private updateFOV() {
    const changed = this.fov.update(this.player.mapX, this.player.mapY, FOV_RADIUS);
    this.tileRenderer.markDirtyBatch(changed);
  }

  playerAttackFacing() {
    if (!this.player.isAlive()) return;
    const tx = this.player.mapX + (this.player.faceDx || 0);
    const ty = this.player.mapY + (this.player.faceDy || 1);
    const target = this.enemies.find(e => e.mapX === tx && e.mapY === ty && e.isAlive());
    if (target) {
      const result = this.combat.playerAttack(this.player, target, this.viewX, this.viewY, HUD_OFFSET_Y);
      if (result.killed) {
        target.destroy();
        this.enemies = this.enemies.filter(e => e !== target);
      }
    }
  }

  playerSkill() {
    if (!this.player.isAlive()) return;
    const results = this.combat.playerSkillFire(
      this.player, this.enemies, this.viewX, this.viewY, HUD_OFFSET_Y
    );
    results.forEach(({ enemy, result }) => {
      if (result.killed) {
        enemy.destroy();
        this.enemies = this.enemies.filter(e => e !== enemy);
      }
    });
  }

  private nextFloor() {
    if (this.floor >= 10) {
      this.onGameWin();
      return;
    }
    this.floor++;
    this.generateFloor();
  }

  private onGameWin() {
    console.log('勝利！通關第10層！');
    // TODO: 顯示勝利畫面
  }

  private onPlayerDead() {
    // TODO: 遊戲結束畫面
    console.log('玩家死亡');
  }

  private notifyUI() {
    const uiScene = this.scene.get('UIScene') as { updateHUD?: (data: object) => void } | null;
    uiScene?.updateHUD?.({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      floor: this.floor,
      gold: this.player.gold,
      seed: this.currentSeed,
    });
  }

  getGameWidth()  { return GAME_WIDTH;  }
  getGameHeight() { return GAME_HEIGHT; }
}
