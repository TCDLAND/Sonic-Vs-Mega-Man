import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class MegaManZero extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'MM ZERO',color:'#b62f45',hasSonicJump:false,speed:7}); configureCombatant(this, 'megaman-zero', 'MM ZERO'); }
}
