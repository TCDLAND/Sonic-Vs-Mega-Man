import { setInputDevice } from './input-labels.js';
import { game } from './state.js';
import { GAME_STATE } from './config.js';

const held = new Map();
const keys = [
    { left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',attack:'KeyJ',heavy:'KeyI',
      light:'KeyM',kick:'KeyK',spin:'Space',aux1:'KeyQ',aux2:'KeyE',assist:'KeyU' },
    { left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',attack:'Comma',heavy:'Period',
      light:'Minus',kick:'Equal',spin:'Enter',aux1:'BracketLeft',aux2:'BracketRight',assist:'Quote' }
];

function emit(code,down) {
    const reserve = /^(p[12]):reserve:([01])$/.exec(code);
    const side = reserve?.[1] ?? (Object.values(keys[1]).includes(code) ? 'p2' : 'p1');
    if (down) setInputDevice(side,'xbox');
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
    const pressed=new Set();
    if (!nativePicker && !story) pads.slice(0,game.mode==='online'||dialog||game.gameState===GAME_STATE.MODE?1:2).forEach((pad,i)=>{
        const b=n=>Boolean(pad.buttons[n]?.pressed);
        const x=pad.axes[0]??0,y=pad.axes[1]??0,rx=pad.axes[2]??0,ry=pad.axes[3]??0;
        const directions=[b(14)||x<-.5||rx<-.5,b(15)||x>.5||rx>.5,b(12)||y<-.5||ry<-.5,b(13)||y>.5||ry>.5];
        if (dialog) {
            if (directions.some(Boolean)) pressed.add('dialog-navigation:'+directions.findIndex(Boolean));
            if (b(0)) pressed.add('dialog-confirm');
            if (b(1)) pressed.add('dialog-back');
            return;
        }
        const k=keys[i], battle=game.gameState===GAME_STATE.BATTLE;
        const mapping=[[directions[0],k.left],[directions[1],k.right],[directions[2],k.up],
            [directions[3],k.down],[battle&&b(5),k.aux1],[battle&&b(8),k.aux2],
            [battle&&b(7),k.spin],[battle&&b(4),`p${i+1}:reserve:0`],[battle&&b(6),`p${i+1}:reserve:1`],
            [battle?b(2):b(0),k.attack],[battle&&b(3),k.heavy],[battle&&b(0),k.light],
            [battle&&b(1),k.kick],[battle&&b(11),k.down],[b(9)&&i===0,'Escape'],[!battle&&b(3)&&i===0,'KeyG']];
        for(const [on,code] of mapping) if (on) pressed.add(code);
    });
    for(const code of held.keys()) if(!pressed.has(code)) {
        if(!code.startsWith('dialog-')) emit(code,false);
        held.delete(code);
    }
    for(const code of pressed) {
        if(held.has(code)) continue;
        held.set(code,true);
        if(code.startsWith('dialog-')) setInputDevice('p1','xbox');
        if(code==='dialog-confirm') document.activeElement?.click();
        else if(code==='dialog-back') {
            const cancel=new Event('cancel',{cancelable:true});
            if(dialog.dispatchEvent(cancel)) dialog.close();
        } else if(code.startsWith('dialog-navigation:')) {
            const items=Array.from(dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));
            const current=items.indexOf(document.activeElement), direction=Number(code.at(-1));
            if(items.length) items[(current+(direction%2?1:-1)+items.length)%items.length].focus();
        } else emit(code,true);
    }
}
