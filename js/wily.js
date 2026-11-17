import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class Wily extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'WILY',color:'#8b68b8',hasSonicJump:false,speed:4.5}); configureCombatant(this, 'wily', 'WILY'); }
}
