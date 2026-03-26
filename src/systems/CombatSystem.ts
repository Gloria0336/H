import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { EffectPool } from '@/rendering/EffectPool';
import { EffectType } from '@/dungeon/tiles';
import { TileMap } from '@/dungeon/TileMap';

export interface CombatResult {
  damage: number;
  killed: boolean;
}

export class CombatSystem {
  private effects: EffectPool;

  // 玩家基礎攻擊力
  private playerAtk = 15;

  constructor(effects: EffectPool) {
    this.effects = effects;
  }

  /** 玩家攻擊敵人（bump 攻擊） */
  playerAttack(
    player: Player,
    enemy: Enemy,
    viewX: number, viewY: number, offsetY: number
  ): CombatResult {
    const damage = this.playerAtk + Math.floor(Math.random() * 6);
    enemy.takeDamage(damage);
    this.effects.play(EffectType.SLASH, enemy.mapX, enemy.mapY, viewX, viewY, offsetY);
    return { damage, killed: !enemy.isAlive() };
  }

  /** 敵人攻擊玩家 */
  enemyAttack(
    enemy: Enemy,
    player: Player,
    viewX: number, viewY: number, offsetY: number
  ): CombatResult {
    const damage = enemy.config.atk + Math.floor(Math.random() * 4);
    player.takeDamage(damage);
    this.effects.play(EffectType.HIT, player.mapX, player.mapY, viewX, viewY, offsetY);
    return { damage, killed: !player.isAlive() };
  }

  /** 攻擊按鈕：前方兩格（HIT 特效，命中第一個敵人即停） */
  playerAttackHit(
    player: Player,
    enemies: Enemy[],
    viewX: number, viewY: number, offsetY: number
  ): { enemy: Enemy; result: CombatResult }[] {
    const fdx = player.faceDx || 0;
    const fdy = player.faceDy || 1;
    const damage = this.playerAtk + Math.floor(Math.random() * 6);

    for (let d = 1; d <= 2; d++) {
      const tx = player.mapX + fdx * d;
      const ty = player.mapY + fdy * d;
      const enemy = enemies.find(e => e.mapX === tx && e.mapY === ty && e.isAlive());
      if (enemy) {
        enemy.takeDamage(damage);
        this.effects.play(EffectType.HIT, tx, ty, viewX, viewY, offsetY);
        return [{ enemy, result: { damage, killed: !enemy.isAlive() } }];
      }
    }
    return [];
  }

  /** 技能：火（直線攻擊直到碰到牆壁，命中第一個敵人） */
  playerSkillFire(
    player: Player,
    enemies: Enemy[],
    map: TileMap,
    viewX: number, viewY: number, offsetY: number
  ): { enemy: Enemy; result: CombatResult }[] {
    const fdx = player.faceDx || 0;
    const fdy = player.faceDy || 1;
    const skillDamage = this.playerAtk * 2;
    const maxRange = Math.max(map.cols, map.rows);

    for (let d = 1; d <= maxRange; d++) {
      const tx = player.mapX + fdx * d;
      const ty = player.mapY + fdy * d;
      const cell = map.get(tx, ty);
      if (!cell || !cell.passable) break; // 碰到牆停止

      const enemy = enemies.find(e => e.mapX === tx && e.mapY === ty && e.isAlive());
      if (enemy) {
        const damage = skillDamage + Math.floor(Math.random() * 10);
        enemy.takeDamage(damage);
        this.effects.play(EffectType.FIRE, tx, ty, viewX, viewY, offsetY);
        return [{ enemy, result: { damage, killed: !enemy.isAlive() } }];
      }
    }
    return [];
  }

  /** 技能：冰（前方 3 寬 × 3 深區域） */
  playerSkillIce(
    player: Player,
    enemies: Enemy[],
    viewX: number, viewY: number, offsetY: number
  ): { enemy: Enemy; result: CombatResult }[] {
    const results: { enemy: Enemy; result: CombatResult }[] = [];
    const fdx = player.faceDx || 0;
    const fdy = player.faceDy || 1;
    const perpDx = -fdy;
    const perpDy = fdx;
    const skillDamage = Math.floor(this.playerAtk * 1.5);

    for (let d = 1; d <= 3; d++) {
      for (let p = -1; p <= 1; p++) {
        const tx = player.mapX + fdx * d + perpDx * p;
        const ty = player.mapY + fdy * d + perpDy * p;
        const enemy = enemies.find(e => e.mapX === tx && e.mapY === ty && e.isAlive());
        if (enemy) {
          const damage = skillDamage + Math.floor(Math.random() * 8);
          enemy.takeDamage(damage);
          this.effects.play(EffectType.ICE, tx, ty, viewX, viewY, offsetY);
          results.push({ enemy, result: { damage, killed: !enemy.isAlive() } });
        }
      }
    }
    return results;
  }

  /** 技能：斬（前方 3 寬 × 2 深區域） */
  playerSkillSlash(
    player: Player,
    enemies: Enemy[],
    viewX: number, viewY: number, offsetY: number
  ): { enemy: Enemy; result: CombatResult }[] {
    const results: { enemy: Enemy; result: CombatResult }[] = [];
    const fdx = player.faceDx || 0;
    const fdy = player.faceDy || 1;
    const perpDx = -fdy;
    const perpDy = fdx;
    const skillDamage = Math.floor(this.playerAtk * 1.2);

    for (let d = 1; d <= 2; d++) {
      for (let p = -1; p <= 1; p++) {
        const tx = player.mapX + fdx * d + perpDx * p;
        const ty = player.mapY + fdy * d + perpDy * p;
        const enemy = enemies.find(e => e.mapX === tx && e.mapY === ty && e.isAlive());
        if (enemy) {
          const damage = skillDamage + Math.floor(Math.random() * 6);
          enemy.takeDamage(damage);
          this.effects.play(EffectType.SLASH, tx, ty, viewX, viewY, offsetY);
          results.push({ enemy, result: { damage, killed: !enemy.isAlive() } });
        }
      }
    }
    return results;
  }
}