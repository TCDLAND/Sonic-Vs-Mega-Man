import { initBuster } from './buster-system.js';
import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class X extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'X',color:'#3aa6ff',hasSonicJump:false,speed:6}); initBuster(this, 'x'); configureCombatant(this, 'x', 'X'); }
}
