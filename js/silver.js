import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
export class Silver extends PrototypeFighter {
  constructor(x,y,controls){ super(x,y,controls,{name:'SILVER',color:'#b9d8dd',spinProfile:'silver',speed:5.8}); configureCombatant(this, 'silver', 'SILVER'); }
}
