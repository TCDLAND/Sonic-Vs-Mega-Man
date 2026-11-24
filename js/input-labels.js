import { game } from './state.js';

export const inputDevices = { p1: 'keyboard', p2: 'keyboard' };

export function setInputDevice(side, device) {
    if (inputDevices[side] === device) return;
    inputDevices[side] = device;
    window.dispatchEvent(new Event('input-device-change'));
}

export function xboxCommand(command) {
    const keys = {
        J:'X', I:'Y', M:'A', K:'B', Q:'RB', E:'View', Aux1:'RB', Aux2:'View',
        Espacio:'RT', WASD:'cruceta o sticks', 'Botón Jet':'RT'
    };
    return command.replace(/\bBotón Jet\b|\b(?:WASD|Aux1|Aux2|Espacio|[JIMKQE])\b/g, key => keys[key]);
}

export function usingXbox(side = 'p1') {
    return inputDevices[game.mode === 'online' && game.onlineRole === 'guest' ? 'p1' : side] === 'xbox';
}
