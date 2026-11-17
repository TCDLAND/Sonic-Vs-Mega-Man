// ========================================
// CLASE BASS BULLET (proyectil del buster)
// ========================================

import { ctx } from './state.js';
import { worldWidth } from './config.js';
import { getCellCoords } from './utils.js';
import { bassSprite3 } from './assets.js';

export class BassBullet {
    constructor(x, y, vx, vy, direction, owner, shootType = 'shootHor') {
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = 100;
        this.vx = vx;
        this.vy = vy;
        this.direction = direction;
        this.owner = owner;
        this.damage = 3;
        this.active = true;
        this.shootType = shootType;
        this.type = 'bassBullet';
        this.projectileForce = 1;

        this.frameState = 0;
        this.frameTimer = 0;
        this.frameChangeInterval = 6;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.frameTimer++;

        if (this.frameState === 0) {
            if (this.frameTimer >= 1) {
                this.frameState = 1;
                this.frameTimer = 0;
            }
        } else {
            if (this.frameTimer >= this.frameChangeInterval) {
                this.frameState = (this.frameState === 1) ? 2 : 1;
                this.frameTimer = 0;
            }
        }

        if (this.x < -400 || this.x > worldWidth + 400) this.active = false;
        if (this.y < -400 || this.y > 1000) this.active = false;
    }

    getFrameNum() {
        if (this.frameState === 0) return 28;
        if (this.frameState === 1) return 29;
        return 30;
    }

    draw(cameraX) {
        if (!bassSprite3.complete || bassSprite3.naturalWidth === 0) return;

        const frameNum = this.getFrameNum();
        const c = getCellCoords(frameNum, bassSprite3.naturalWidth, bassSprite3.naturalHeight, 8, 6);
        const drawX = this.x - cameraX;

        ctx.save();

        if (this.shootType === "shootArriba") {
            ctx.translate(drawX + this.width / 2, this.y + this.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(bassSprite3, c.sx, c.sy, c.sw, c.sh, -this.width / 2, -this.height / 2, this.width, this.height);
        } else if (this.shootType === "shootDiaArriba") {
            ctx.translate(drawX + this.width / 2, this.y + this.height / 2);
            const angle = this.direction > 0 ? -Math.PI / 4 : Math.PI / 4;
            ctx.rotate(angle);
            if (this.direction < 0) ctx.scale(-1, 1);
            ctx.drawImage(bassSprite3, c.sx, c.sy, c.sw, c.sh, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            if (this.direction < 0) {
                ctx.translate(drawX + this.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(bassSprite3, c.sx, c.sy, c.sw, c.sh, 0, this.y, this.width, this.height);
            } else {
                ctx.drawImage(bassSprite3, c.sx, c.sy, c.sw, c.sh, drawX, this.y, this.width, this.height);
            }
        }

        ctx.restore();
    }
}