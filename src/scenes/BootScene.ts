import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    // 載入字型後再進入遊戲
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '載入中…', {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: '28px',
      color: '#FFD700',
    }).setOrigin(0.5);

    // 預熱字型（強迫瀏覽器載入中文字型）
    const warmup = this.add.text(-200, -200, '牆石壁地土廊勇鬼魔獸王斬燃冰藥劍寶梯', {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", monospace',
      fontSize: '24px',
    });

    // 等一幀確保字型渲染
    this.time.delayedCall(100, () => {
      warmup.destroy();
      text.destroy();
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    });
  }
}
