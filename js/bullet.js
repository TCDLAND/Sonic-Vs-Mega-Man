// ========================================
// CLASE BASS BULLET (proyectil del buster)
// ========================================

import { ctx } from './state.js';
import { worldWidth } from './config.js';
import { drawRobotShot } from './robot-sprites.js';

export class BassBullet {
    constructor(x, y, vx, vy, direction, owner, shootType = 'shootHor') {
        this.x = x;
        this.y = y;
        this.width = 43 * (owner.characterScale || 1);
        this.height = 43 * (owner.characterScale || 1);
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

    draw(cameraX) {
        drawRobotShot(ctx, this.frameState === 2 ? 'bassB' : 'bassA',
            this.x - cameraX, this.y, this.width, this.height, Math.atan2(this.vy, this.vx));
    }
}
