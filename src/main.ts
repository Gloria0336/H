import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { BootScene } from '@/scenes/BootScene';
import { GameScene } from '@/scenes/GameScene';
import { UIScene } from '@/scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  parent: 'game-container',
  scene: [BootScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 4,   // 支援多點觸控
  },
  render: {
    antialias: false,    // 關閉反鋸齒，文字更銳利
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};

new Phaser.Game(config);
