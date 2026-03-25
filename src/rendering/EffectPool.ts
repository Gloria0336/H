import Phaser from 'phaser';
import { TILE_SIZE, UI_DEPTH } from '@/config';
import { EffectType, EFFECT_VISUALS } from '@/dungeon/tiles';

interface EffectObject {
  text: Phaser.GameObjects.Text;
  inUse: boolean;
}

export class EffectPool {
  private scene: Phaser.Scene;
  private pool: EffectObject[] = [];
  private poolSize = 32;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();
  }

  private build() {
    for (let i = 0; i < this.poolSize; i++) {
      const t = this.scene.add.text(0, 0, '', {
        fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
        fontSize: `${TILE_SIZE * 1.4}px`,
        color: '#ffffff',
        resolution: window.devicePixelRatio || 1,
      });
      t.setOrigin(0.5, 0.5);
      t.setDepth(UI_DEPTH - 1);
      t.setVisible(false);
      this.pool.push({ text: t, inUse: false });
    }
  }

  /** 在地圖座標 (mapX, mapY) 播放特效，需傳入當前視口左上角 (vx, vy) 及 offsetY */
  play(
    type: EffectType,
    mapX: number, mapY: number,
    vx: number, vy: number,
    offsetY = 0
  ) {
    const obj = this.pool.find(o => !o.inUse);
    if (!obj) return; // 池滿則跳過

    const visual = EFFECT_VISUALS[type];
    const char = visual.chars[Math.floor(Math.random() * visual.chars.length)];
    const color = Phaser.Display.Color.IntegerToColor(visual.color).rgba;

    const screenX = (mapX - vx) * TILE_SIZE + TILE_SIZE / 2;
    const screenY = offsetY + (mapY - vy) * TILE_SIZE + TILE_SIZE / 2;

    obj.inUse = true;
    obj.text.setText(char);
    obj.text.setColor(color);
    obj.text.setPosition(screenX, screenY);
    obj.text.setAlpha(1);
    obj.text.setScale(1);
    obj.text.setVisible(true);

    this.scene.tweens.add({
      targets: obj.text,
      y: screenY - TILE_SIZE * 1.5,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        obj.text.setVisible(false);
        obj.inUse = false;
      },
    });
  }

  destroy() {
    this.pool.forEach(o => o.text.destroy());
    this.pool = [];
  }
}
