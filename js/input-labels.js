import { game } from './state.js';

export const inputDevices = { p1: 'keyboard', p2: 'keyboard' };

export function setInputDevice(side, device) {
    if (inputDevices[side] === device) return;
    inputDevices[side] = device;
    window.dispatchEvent(new Event('input-device-change'));
}

export function padDevice(id) {
    return /054c|dualsense|dualshock|playstation|wireless controller \(sony/i.test(id ?? '') && !/xbox/i.test(id) ? 'playstation' : 'xbox';
}

export function xboxCommand(command, side = 'p1') {
    const keys = {
        J:'X', I:'Y', M:'A', K:'B', Q:'RB', E:'View', Aux1:'RB', Aux2:'View',
        Espacio:'RT', WASD:'cruceta o sticks', 'Botón Jet':'RT'
    };
    if (deviceFor(side) === 'playstation') Object.assign(keys, {
        J:'□', I:'△', M:'✕', K:'○', Q:'R1', E:'Crear / Share',
        Aux1:'R1', Aux2:'Crear / Share', Espacio:'R2', 'Botón Jet':'R2'
    });
    return command.replace(/\bBotón Jet\b|\b(?:WASD|Aux1|Aux2|Espacio|[JIMKQE])\b/g, key => keys[key]);
}

export function deviceFor(side = 'p1') {
    return inputDevices[game.mode === 'online' && game.onlineRole === 'guest' ? 'p1' : side];
}

export function usingXbox(side = 'p1') {
    return deviceFor(side) !== 'keyboard';
}
