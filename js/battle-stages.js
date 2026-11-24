import { music } from './music.js';

const definitions = [
    ['highway', 'Highway', 'assets/images/highway_long.png', 'highway'],
    ['emerald-zone', 'Emerald Zone', 'assets/Fondos/Emerald Zone.png', 'angelIsland'],
    ['altar', 'Altar Emerald', 'assets/story/sonic/altar-vacio.png', 'angelIsland'],
    ['eggman-entry', 'Instalaciones de Eggman', 'assets/Fondos/instalaciones de Eggman.png', 'eggmanBase'],
    ['death-egg', 'Death Egg Arena', 'assets/Fondos/Death Egg Arena.png', 'metalBattle'],
    ['museum', 'Museo', 'assets/Fondos/Museo.png', 'museum'],
    ['wily', 'Laboratorio de Wily', 'assets/Fondos/DoctorWilyLab.png', 'wily_intro']
];

export const battleStages = definitions.map(([id, label, src, track]) => {
    const image = new Image();
    image.src = src;
    const floor=id==='emerald-zone'?634:id==='altar'?652:id==='death-egg'?607:undefined;
    const platforms=id==='death-egg'?[
        {x:245,end:680,y:321},{x:1880,end:2315,y:321},
        {x:0,end:280,y:402},{x:2280,end:2560,y:402}
    ]:[];
    return { id, label, image, track, floor, platforms };
});

let activePicker;
let previousPad = { x: 0, y: 0, action: false, back: false };

export function chooseBattleStage(game, start) {
    const dialog = document.createElement('dialog');
    dialog.className = 'stage-picker';
    dialog.setAttribute('aria-label', 'Elegir escenario');
    const heading = document.createElement('h2');
    heading.textContent = 'Elegir escenario';
    const grid = document.createElement('div');
    grid.className = 'stage-picker-grid';
    const items = battleStages.map(stage => {
        const button = document.createElement('button');
        button.type = 'button';
        const image = stage.image.cloneNode();
        image.alt = '';
        button.append(image, stage.label);
        button.addEventListener('focus', () => music.play(stage.track));
        button.onclick = () => { game.battleStage = stage; dialog.close(); start(); };
        grid.append(button);
        return button;
    });
    const back = document.createElement('button');
    back.textContent = 'Volver';
    back.onclick = () => dialog.close();
    dialog.addEventListener('close', () => {
        if (game.gameState === 'select') {
            game.characterSelection.p1Confirmed = false;
            game.characterSelection.p2Confirmed = false;
            music.stop();
        }
        activePicker = undefined;
        dialog.remove();
    });
    dialog.addEventListener('keydown', event => {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
        if (delta == null) return;
        event.preventDefault();
        event.stopPropagation();
        items[(items.indexOf(document.activeElement) + delta + items.length) % items.length].focus();
    });
    for (const event of ['keydown','keyup']) dialog.addEventListener(event, input => input.stopPropagation());
    dialog.append(heading, grid, back);
    document.body.append(dialog);
    dialog.showModal();
    activePicker = { items, dialog };
    items.find((_, i) => battleStages[i].id === game.battleStage?.id)?.focus();
}

export function pollStagePad() {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
    if (!pad) return;
    const axis = v => Math.abs(v ?? 0) > .45 ? Math.sign(v) : 0;
    const x=Number(Boolean(pad.buttons[15]?.pressed))-Number(Boolean(pad.buttons[14]?.pressed))||axis(pad.axes[0]);
    const y=Number(Boolean(pad.buttons[13]?.pressed))-Number(Boolean(pad.buttons[12]?.pressed))||axis(pad.axes[1]);
    const action=Boolean(pad.buttons[0]?.pressed), back=Boolean(pad.buttons[1]?.pressed);
    if (activePicker) {
        const { items, dialog }=activePicker;
        const delta=(x!==previousPad.x?x:0)+(y!==previousPad.y?y*3:0);
        if (delta) items[(items.indexOf(document.activeElement)+delta+items.length)%items.length].focus();
        if (action&&!previousPad.action&&items.includes(document.activeElement)) document.activeElement.click();
        if (back&&!previousPad.back&&dialog.open) dialog.close();
    }
    previousPad={x,y,action,back};
}
