import { initBuster } from './buster-system.js';
import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class ProtoMan extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'PROTO MAN',color:'#c83b48',hasSonicJump:false,speed:6}); initBuster(this, 'protoman'); configureCombatant(this, 'protoman', 'PROTO MAN'); }
}
