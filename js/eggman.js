import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class Eggman extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'EGGMAN',color:'#d85a3b',hasSonicJump:false,speed:4.5}); this.width=150; this.height=170; this.y=this.feetY-this.height; configureCombatant(this, 'eggman', 'EGGMAN'); }
}
