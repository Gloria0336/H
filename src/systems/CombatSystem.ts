import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { EffectPool } from '@/rendering/EffectPool';
import { EffectType } from '@/dungeon/tiles';

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

  /** 玩家攻擊敵人 */
  playerAttack(
    player: Player,
    enemy: Enemy,
    viewX: number, viewY: number, offsetY: number
  ): CombatResult {
    const damage = this.playerAtk + Math.floor(Math.random() * 6);
    enemy.takeDamage(damage);

    // 特效
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

  /** 技能：範圍火焰攻擊（以玩家為中心，半徑2格）*/
  playerSkillFire(
    player: Player,
    enemies: Enemy[],
    viewX: number, viewY: number, offsetY: number
  ): { enemy: Enemy; result: CombatResult }[] {
    const results: { enemy: Enemy; result: CombatResult }[] = [];
    const radius = 2;
    const skillDamage = this.playerAtk * 2;

    enemies.forEach(e => {
      const dist = Math.abs(e.mapX - player.mapX) + Math.abs(e.mapY - player.mapY);
      if (dist <= radius) {
        const damage = skillDamage + Math.floor(Math.random() * 10);
        e.takeDamage(damage);
        this.effects.play(EffectType.FIRE, e.mapX, e.mapY, viewX, viewY, offsetY);
        results.push({ enemy: e, result: { damage, killed: !e.isAlive() } });
      }
    });

    return results;
  }
}
