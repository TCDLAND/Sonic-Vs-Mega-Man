import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class Emerl extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'EMERL',color:'#e8c14a',hasSonicJump:true,speed:6.5}); configureCombatant(this, 'emerl', 'EMERL'); }
}
