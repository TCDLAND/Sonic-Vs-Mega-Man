import { padDevice, setInputDevice } from './input-labels.js';
import { game } from './state.js';
import { GAME_STATE } from './config.js';

const held = new Map();
const spinFaceHeld = new Set();
const keys = [
    { left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',attack:'KeyJ',heavy:'KeyI',
      light:'KeyM',kick:'KeyK',spin:'Space',aux1:'KeyQ',aux2:'KeyE',assist:'KeyU' },
    { left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',attack:'Comma',heavy:'Period',
      light:'Minus',kick:'Equal',spin:'Enter',aux1:'BracketLeft',aux2:'BracketRight',assist:'Quote' }
];

function emit(code,down,device) {
    const reserve = /^(p[12]):reserve:([01])$/.exec(code);
    const side = reserve?.[1] ?? (Object.values(keys[1]).includes(code) ? 'p2' : 'p1');
    if (down) setInputDevice(side,device);
    if (reserve) code = keys[Number(side==='p2')].assist;
    const event=new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true});
    Object.defineProperty(event,'gamepadInput',{value:true});
    if (reserve) Object.defineProperty(event,'assistSlot',{value:Number(reserve[2])});
    window.dispatchEvent(event);
}

export function pollXboxPads() {
    const pads=Array.from(navigator.getGamepads?.() ?? []).filter(pad=>pad?.mapping==='standard');
    const dialog=document.querySelector('dialog[open]');
    const nativePicker=dialog?.classList.contains('stage-picker');
    const story=[GAME_STATE.STORY,GAME_STATE.SONIC_WALK,GAME_STATE.ADVENTURE].includes(game.gameState);
    const pressed=new Map();
    if (!nativePicker && !story) pads.slice(0,game.mode==='online'||dialog||game.gameState===GAME_STATE.MODE?1:2).forEach((pad,i)=>{
        const device=padDevice(pad.id);
        const b=n=>Boolean(pad.buttons[n]?.pressed);
        const x=pad.axes[0]??0,y=pad.axes[1]??0,rx=pad.axes[2]??0,ry=pad.axes[3]??0;
        const directions=[b(14)||x<-.5||rx<-.5,b(15)||x>.5||rx>.5,b(12)||y<-.5||ry<-.5,b(13)||y>.5||ry>.5];
        if (dialog) {
            if (directions.some(Boolean)) pressed.set('dialog-navigation:'+directions.findIndex(Boolean),device);
            if (b(0)) pressed.set('dialog-confirm',device);
            if (b(1)) pressed.set('dialog-back',device);
            if (dialog.classList.contains('battle-pause')) {
                if (b(6)) pressed.set('dialog-roster:-1',device);
                if (b(7)) pressed.set('dialog-roster:1',device);
            }
            return;
        }
        const k=keys[i], battle=game.gameState===GAME_STATE.BATTLE;
        const side = game.mode==='online' && game.onlineRole==='guest' ? 'p2' : i===0 ? 'p1' : 'p2';
        const fighter = game[side];
        const down = directions[3] || battle&&b(11);
        const crouchAttack = battle && fighter?.supportsSpin && down && b(7) && b(0);
        if (!battle || !b(0)) spinFaceHeld.delete(pad.index);
        else if (fighter?.supportsSpin && fighter.isGrounded && down && !crouchAttack &&
            !held.has(k.light)) spinFaceHeld.add(pad.index);
        const spinFace = battle && spinFaceHeld.has(pad.index);
        const mapping=[[directions[0],k.left],[directions[1],k.right],[directions[2],k.up],
            [down,k.down],[battle&&b(5),k.aux1],[battle&&b(8),k.aux2],
            [battle&&((b(7)&&!(down&&fighter?.supportsSpin))||(spinFace&&down&&!crouchAttack)),k.spin],[battle&&b(4),`p${i+1}:reserve:0`],[battle&&b(6),`p${i+1}:reserve:1`],
            [battle?b(2):b(0),k.attack],[battle&&b(3),k.heavy],[battle&&b(0)&&(!spinFace||crouchAttack),k.light],
            [battle&&b(1),k.kick],[b(9)&&i===0,'Escape'],[!battle&&b(3)&&i===0,'KeyG']];
        for(const [on,code] of mapping) if (on) pressed.set(code,device);
    });
    for (const index of spinFaceHeld) if (!pads.some(pad=>pad.index===index)) spinFaceHeld.delete(index);
    for(const code of held.keys()) if(!pressed.has(code)) {
        if(!code.startsWith('dialog-')) emit(code,false);
        held.delete(code);
    }
    for(const [code,device] of pressed) {
        if(held.has(code)) continue;
        held.set(code,true);
        if(code.startsWith('dialog-')) setInputDevice('p1',device);
        if(code==='dialog-confirm') document.activeElement?.click();
        else if(code==='dialog-back') {
            const cancel=new Event('cancel',{cancelable:true});
            if(dialog.dispatchEvent(cancel)) dialog.close();
        } else if(code.startsWith('dialog-navigation:')) {
            const items=Array.from(dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));
            const current=items.indexOf(document.activeElement), direction=Number(code.at(-1));
            if(items.length) items[(current+(direction%2?1:-1)+items.length)%items.length].focus();
        } else if(code.startsWith('dialog-roster:')) {
            dialog.dispatchEvent(new CustomEvent('pause-roster-step',{detail:Number(code.split(':')[1])}));
        } else emit(code,true,device);
    }
}
