import { Fighter } from './fighter.js';
import { ctx, game } from './state.js';
import { getBusterLevel } from './buster-system.js';

export class PrototypeFighter extends Fighter {
    constructor(x, y, controls, options = {}) {
        super(x, y, options.color || '#ffffff', controls, options.hasSonicJump ?? true);
        this.characterName = options.name || 'PROTOTYPE';
        this.prototypeColor = options.color || '#ffffff';
        this.supportsSpin = Boolean(options.spinProfile);
        if (options.spinProfile) this.setSpinProfile(options.spinProfile);
        if (Number.isFinite(options.speed)) {
            this.speed = options.speed;
            this.dashSpeed = this.speed * 4;
        }
    }

    draw(opponentX) {
        const x = this.x - game.cameraX;
        const y = this.getCurrentY();
        const h = this.getCurrentHeight();
        const facingRight = opponentX > this.x;

        ctx.save();
        ctx.fillStyle = this.prototypeColor;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(x, y, this.width, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, this.width, h);

        // Frente del prototipo para leer orientación sin sprites.
        ctx.fillStyle = '#ffffff';
        const markerX = facingRight ? x + this.width - 16 : x + 6;
        ctx.fillRect(markerX, y + 20, 10, 24);

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(this.characterName, x + this.width / 2, y - 28);
        ctx.font = '14px monospace';
        ctx.fillText(`HP ${Math.ceil(this.health)}`, x + this.width / 2, y - 10);

        if (this.hasBuster && this.busterCharging) {
            ctx.font = 'bold 15px monospace';
            ctx.fillText(`BUSTER Nv.${getBusterLevel(this)}`, x + this.width / 2, y + h / 2 - 28);
        }

        if (this.wallSliding) {
            ctx.font = '12px monospace';
            ctx.fillText('WALL', x + this.width / 2, y + h / 2 - 8);
        }

        if (this.supportsSpin && (this.isSpinning || this.isSpinDashActive)) {
            ctx.font = 'bold 18px monospace';
            ctx.fillText(`SPIN Nv.${this.spinChargeLevel}`, x + this.width / 2, y + h / 2);
            if (this.spinMaxImpact) {
                ctx.font = '12px monospace';
                ctx.fillText('IMPACTO MAX', x + this.width / 2, y + h / 2 + 22);
            }
        }
        ctx.restore();
    }
}
