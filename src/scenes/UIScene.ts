import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, HUD_ROWS,
  UI_DEPTH, JOYSTICK_RADIUS, JOYSTICK_THUMB_RADIUS, COLORS,
} from '@/config';
import { GameScene } from './GameScene';

const HUD_H = HUD_ROWS * TILE_SIZE;       // 頂部 HUD 高度
const BTN_SIZE = 64;                       // 動作按鈕尺寸
const BTN_MARGIN = 20;

export class UIScene extends Phaser.Scene {
  // HUD 文字
  private txtFloor!: Phaser.GameObjects.Text;
  private txtHP!: Phaser.GameObjects.Text;
  private txtGold!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;

  // 搖桿相關
  private joystickBase!: Phaser.GameObjects.Text;
  private joystickThumb!: Phaser.GameObjects.Text;
  private joystickActive = false;
  private joystickPointerId = -1;
  private joystickOriginX = 0;
  private joystickOriginY = 0;

  // 動作按鈕
  private btnAttack!: Phaser.GameObjects.Text;
  private btnFire!: Phaser.GameObjects.Text;
  private btnIce!: Phaser.GameObjects.Text;
  private btnSlash!: Phaser.GameObjects.Text;

  private gameScene!: GameScene;

  constructor() { super({ key: 'UIScene' }); }

  create() {
    this.gameScene = this.scene.get('GameScene') as unknown as GameScene;
    this.buildHUD();
    this.buildJoystick();
    this.buildButtons();
    this.setupTouchEvents();
  }

  // ─── HUD ────────────────────────────────────────────────────
  private buildHUD() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: '16px',
      color: '#FFD700',
      resolution: window.devicePixelRatio || 1,
    };

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, GAME_WIDTH, HUD_H);
    bg.setDepth(UI_DEPTH);

    this.txtFloor = this.add.text(10, 6, '第 1 層', style).setDepth(UI_DEPTH + 1);
    this.txtHP    = this.add.text(10, 26, 'HP: 100/100', style).setDepth(UI_DEPTH + 1);
    this.txtGold  = this.add.text(GAME_WIDTH - 80, 6, '金:0', style).setDepth(UI_DEPTH + 1);

    this.hpBar = this.add.graphics().setDepth(UI_DEPTH + 1);
  }

  private drawHPBar(hp: number, maxHp: number) {
    const w = GAME_WIDTH - 20;
    const barW = Math.floor(w * (hp / maxHp));
    this.hpBar.clear();
    // 背景
    this.hpBar.fillStyle(0x333333, 1);
    this.hpBar.fillRect(10, HUD_H - 8, w, 5);
    // HP
    const pct = hp / maxHp;
    const color = pct > 0.5 ? 0x00CC44 : pct > 0.25 ? 0xFFAA00 : 0xFF2200;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(10, HUD_H - 8, barW, 5);
  }

  // ─── 虛擬搖桿 ─────────────────────────────────────────────
  private buildJoystick() {
    const cx = JOYSTICK_RADIUS + BTN_MARGIN;
    const cy = GAME_HEIGHT - JOYSTICK_RADIUS - BTN_MARGIN;

    // 底座（用大圓形文字模擬）
    this.joystickBase = this.add.text(cx, cy, '◎', {
      fontFamily: 'monospace',
      fontSize: `${JOYSTICK_RADIUS * 2}px`,
      color: 'rgba(255,255,255,0.15)',
      resolution: window.devicePixelRatio || 1,
    }).setOrigin(0.5).setDepth(UI_DEPTH);

    this.joystickThumb = this.add.text(cx, cy, '●', {
      fontFamily: 'monospace',
      fontSize: `${JOYSTICK_THUMB_RADIUS * 2}px`,
      color: 'rgba(255,255,255,0.5)',
      resolution: window.devicePixelRatio || 1,
    }).setOrigin(0.5).setDepth(UI_DEPTH + 1);

    this.joystickOriginX = cx;
    this.joystickOriginY = cy;
  }

  // ─── 動作按鈕 ─────────────────────────────────────────────
  private buildButtons() {
    const rightX = GAME_WIDTH - BTN_MARGIN - BTN_SIZE / 2;
    const bottomY = GAME_HEIGHT - BTN_MARGIN - BTN_SIZE / 2;
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: '24px',
      color: '#FFD700',
      backgroundColor: 'rgba(80,40,0,0.6)',
      padding: { x: 12, y: 8 },
      resolution: window.devicePixelRatio || 1,
    };

    const col2 = rightX - BTN_SIZE - BTN_MARGIN; // 左欄 x

    this.btnAttack = this.add.text(rightX, bottomY - BTN_SIZE - BTN_MARGIN, '攻', btnStyle)
      .setOrigin(0.5).setDepth(UI_DEPTH).setInteractive();

    this.btnFire = this.add.text(col2, bottomY - BTN_SIZE - BTN_MARGIN, '火', btnStyle)
      .setOrigin(0.5).setDepth(UI_DEPTH).setInteractive();

    this.btnIce = this.add.text(col2, bottomY, '冰', btnStyle)
      .setOrigin(0.5).setDepth(UI_DEPTH).setInteractive();

    this.btnSlash = this.add.text(rightX, bottomY, '斬', btnStyle)
      .setOrigin(0.5).setDepth(UI_DEPTH).setInteractive();

    this.btnAttack.on('pointerdown', () => this.gameScene.playerAttackFacing());
    this.btnFire.on('pointerdown',   () => this.gameScene.playerSkillFire());
    this.btnIce.on('pointerdown',    () => this.gameScene.playerSkillIce());
    this.btnSlash.on('pointerdown',  () => this.gameScene.playerSkillSlash());
  }

  // ─── 觸控搖桿邏輯 ─────────────────────────────────────────
  private setupTouchEvents() {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      // 只有左半邊觸發搖桿
      if (ptr.x < GAME_WIDTH / 2 && !this.joystickActive) {
        this.joystickActive = true;
        this.joystickPointerId = ptr.id;
        this.joystickOriginX = ptr.x;
        this.joystickOriginY = ptr.y;
        this.joystickBase.setPosition(ptr.x, ptr.y);
        this.joystickThumb.setPosition(ptr.x, ptr.y);
      }
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.joystickActive || ptr.id !== this.joystickPointerId) return;

      const dx = ptr.x - this.joystickOriginX;
      const dy = ptr.y - this.joystickOriginY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = JOYSTICK_RADIUS;

      const nx = dist > maxDist ? dx / dist : dx / maxDist;
      const ny = dist > maxDist ? dy / dist : dy / maxDist;

      // 更新 thumb 位置
      const thumbX = this.joystickOriginX + nx * Math.min(dist, maxDist);
      const thumbY = this.joystickOriginY + ny * Math.min(dist, maxDist);
      this.joystickThumb.setPosition(thumbX, thumbY);

      // 傳遞給 GameScene
      this.gameScene.joystickVec.x = nx;
      this.gameScene.joystickVec.y = ny;
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.joystickPointerId) return;
      this.joystickActive = false;
      this.joystickPointerId = -1;
      this.joystickThumb.setPosition(this.joystickOriginX, this.joystickOriginY);
      this.gameScene.joystickVec.x = 0;
      this.gameScene.joystickVec.y = 0;
    });
  }

  // ─── HUD 更新（由 GameScene 呼叫）─────────────────────────
  updateHUD(data: { hp: number; maxHp: number; floor: number; gold: number }) {
    this.txtFloor?.setText(`第 ${data.floor} 層`);
    this.txtHP?.setText(`HP: ${data.hp}/${data.maxHp}`);
    this.txtGold?.setText(`金:${data.gold}`);
    if (this.hpBar) this.drawHPBar(data.hp, data.maxHp);
  }
}
