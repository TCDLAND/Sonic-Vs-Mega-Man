// ========================================
// CLASE PROYECTIL (kunai y shuriken de Espio)
// ========================================

import { ctx } from './state.js';
import { worldWidth } from './config.js';

export class Projectile {
    constructor(x, y, direction, images, width = 150, height = 150, speed = 14, damage = 10, isAnimatedShuriken = false, type = 'kunai', owner = null) {
        this.x = x;
        this.y = y + 70;
        this.width = width;
        this.height = height;
        this.vx = direction * speed;
        this.type = type;
        this.projectileForce = type === 'shuriken' ? 7 : type === 'kunai' ? 3 : 1;
        this.owner = owner;
        this.direction = direction;

        this.isAnimatedShuriken = isAnimatedShuriken;
        this.images = Array.isArray(images) ? images : [images];
        this.currentImgIndex = 0;
        this.animTimer = 0;
        this.animSpeed = 0.4;

        this.active = true;
        this.damage = damage;

        this.rotation = 0;
        this.rotationSpeed = direction * 0.3;
    }

    update() {
        this.x += this.vx;

        if (this.isAnimatedShuriken && this.images.length > 1) {
            this.animTimer += this.animSpeed;
            if (this.animTimer >= 1) {
                this.animTimer = 0;
                this.currentImgIndex++;
                if (this.currentImgIndex >= this.images.length) this.currentImgIndex = 3;
            }
            if (this.currentImgIndex >= 3) this.rotation += this.rotationSpeed;
            else this.rotation = 0;
        } else {
            this.rotation += this.rotationSpeed;
        }

        if (this.x < 0 || this.x > worldWidth) this.active = false;
    }

    draw(cameraX) {
        const currentImg = this.images[this.currentImgIndex] || this.images[0];
        if (!currentImg || !currentImg.complete) return;

        let projDrawX = this.x - cameraX;

        ctx.save();
        ctx.translate(projDrawX + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        if (this.direction < 0) {
            ctx.scale(-1, 1);
        }

        ctx.drawImage(
            currentImg,
            -this.width / 2,
            -this.height / 2,
            this.width,
            this.height
        );

        ctx.restore();
    }
}