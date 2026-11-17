import { configureCombatant } from './combat-system.js';
// ========================================
// CLASE ESPIO
// ========================================

import { Fighter } from './fighter.js';
import { ctx, game } from './state.js';
import { espioSprite, espioSprite2, espioSprite3 } from './assets.js';
import { getCellCoords } from './utils.js';

export class Espio extends Fighter {
    constructor(x, y, controls) {
        super(x, y, '#0055ff', controls, true);
        configureCombatant(this, 'espio', 'ESPIO');
        this.supportsSpin = true;
        this.setSpinProfile('espio');
        this.isSprite = true;
        this.spriteImg = espioSprite;
        this.spriteImg2 = espioSprite2;
        this.setSpinProfile('espio');
    }

    getTongueCells() {
        if (this.tongueType === "forward") {
            if (this.tonguePhase === "pose" || this.tonguePhase === "retract") {
                return [{ frameNum: 3, offsetCol: 0, offsetRow: 0, isDamageCell: false }];
            }
            return [
                { frameNum: 4, offsetCol: 0, offsetRow: 0, isDamageCell: false },
                { frameNum: 5, offsetCol: 1, offsetRow: 0, isDamageCell: true },
                { frameNum: 6, offsetCol: 2, offsetRow: 0, isDamageCell: true }
            ];
        } else {
            if (this.tonguePhase === "pose" || this.tonguePhase === "retract") {
                return [{ frameNum: 0, offsetCol: 0, offsetRow: 0, isDamageCell: false }];
            }
            return [
                { frameNum: 1, offsetCol: 0, offsetRow: -1, isDamageCell: true },
                { frameNum: 2, offsetCol: 1, offsetRow: -1, isDamageCell: true },
                { frameNum: 9, offsetCol: 0, offsetRow: 0, isDamageCell: false },
                { frameNum: 10, offsetCol: 1, offsetRow: 0, isDamageCell: true }
            ];
        }
    }

    draw(opponentX) {
        ctx.save();
        const cameraX = game.cameraX;
        const facingLeft = (this.x > opponentX);
        const drawX = this.x - cameraX;

        if (this.isVulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        if (this.isTongueAttacking && espioSprite3.complete && espioSprite3.naturalWidth !== 0) {
            const sheetW = espioSprite3.naturalWidth;
            const sheetH = espioSprite3.naturalHeight;
            const cols = 8;
            const rows = 6;
            const cellW = this.width;
            const cellH = this.height;
            const baseX = this.x - cameraX;
            const baseY = this.feetY - cellH;
            const cells = this.getTongueCells();
            this.lastTongueRects = [];

            const tongueFacingLeft = (this.tongueDirection < 0);

            cells.forEach((cell) => {
                const c = getCellCoords(cell.frameNum, sheetW, sheetH, cols, rows);
                let dx;
                if (tongueFacingLeft) {
                    dx = baseX + (-cell.offsetCol - 1) * cellW;
                } else {
                    dx = baseX + cell.offsetCol * cellW;
                }
                const dy = baseY + cell.offsetRow * cellH;

                this.lastTongueRects.push({
                    x: dx, y: dy, w: cellW, h: cellH,
                    frameNum: cell.frameNum,
                    isDamageCell: cell.isDamageCell,
                    sx: c.sx, sy: c.sy, sw: c.sw, sh: c.sh,
                    facingLeft: tongueFacingLeft
                });

                if (tongueFacingLeft) {
                    ctx.save();
                    ctx.translate(dx + cellW, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(espioSprite3, c.sx, c.sy, c.sw, c.sh, 0, dy, cellW, cellH);
                    ctx.restore();
                } else {
                    ctx.drawImage(espioSprite3, c.sx, c.sy, c.sw, c.sh, dx, dy, cellW, cellH);
                }
            });

            ctx.restore();
            this.drawHealthBar();
            return;
        }

        if (this.isJabActive && espioSprite3.complete) {
            const frameNum = 19;
            const c = getCellCoords(frameNum, espioSprite3.naturalWidth, espioSprite3.naturalHeight, 8, 6);
            this.drawSingleCell(espioSprite3, c, drawX, this.y, facingLeft);
            ctx.restore();
            this.drawHealthBar();
            return;
        }

        if (this.isKickLightActive && espioSprite3.complete) {
            const frameNum = 20;
            const c = getCellCoords(frameNum, espioSprite3.naturalWidth, espioSprite3.naturalHeight, 8, 6);
            this.drawSingleCell(espioSprite3, c, drawX, this.y, facingLeft);
            ctx.restore();
            this.drawHealthBar();
            return;
        }

        if (this.isHeavyActive && espioSprite3.complete) {
            const frameMap = { 1: 12, 2: 13, 3: 14, 4: 15 };
            const frameNum = frameMap[this.heavyFrame];
            const c = getCellCoords(frameNum, espioSprite3.naturalWidth, espioSprite3.naturalHeight, 8, 6);
            this.drawSingleCell(espioSprite3, c, drawX, this.y, facingLeft);
            ctx.restore();
            this.drawHealthBar();
            return;
        }

        if (this.isKickHeavyActive && espioSprite3.complete) {
            let frameNum;
            if (this.kickHeavyPhase === 1) {
                const idx = Math.min(3, Math.floor(this.kickHeavyTimer / 5));
                frameNum = 23 + idx;
            } else if (this.kickHeavyPhase === 2) {
                const idx = Math.min(3, Math.floor(this.kickHeavyTimer / 5));
                frameNum = 27 + idx;
            } else {
                const idx = Math.min(1, Math.floor(this.kickHeavyTimer / 5));
                frameNum = 31 + idx;
            }
            const c = getCellCoords(frameNum, espioSprite3.naturalWidth, espioSprite3.naturalHeight, 8, 6);
            this.drawSingleCell(espioSprite3, c, drawX, this.y, facingLeft);
            ctx.restore();
            this.drawHealthBar();
            return;
        }

        let frameNumber;
        let sx, sy, sw, sh;
        let renderWidth = this.width;
        let renderHeight = this.height;
        let renderY = this.y;
        let currentImageToUse = this.spriteImg;

        if (this.isSpinDashActive || this.isSpinning) {
            if (this.spriteImg2 && this.spriteImg2.complete && this.spriteImg2.naturalWidth !== 0) {
                currentImageToUse = this.spriteImg2;
            }
            const spinFrames = [1, 2, 3];
            frameNumber = spinFrames[Math.floor(this.spinAnimFrame) % spinFrames.length];
            const c = getCellCoords(frameNumber - 1, currentImageToUse.naturalWidth, currentImageToUse.naturalHeight, 8, 6);
            sx = c.sx; sy = c.sy; sw = c.sw; sh = c.sh;
            renderHeight = 140;
            renderY = this.getCurrentY();
        }
        else {
            const columns = 8;
            const rows = 6;

            if (this.isCrouching) {
                const c = getCellCoords((4 * columns) + 7, currentImageToUse.naturalWidth, currentImageToUse.naturalHeight, columns, rows);
                sx = c.sx; sy = c.sy; sw = c.sw; sh = c.sh;
            }
            else if (this.isThrowingShuriken) {
                const c = getCellCoords((4 * columns) + 6, currentImageToUse.naturalWidth, currentImageToUse.naturalHeight, columns, rows);
                sx = c.sx; sy = c.sy; sw = c.sw; sh = c.sh;
            }
            else if (this.isThrowingKunai) {
                const c = getCellCoords(40, currentImageToUse.naturalWidth, currentImageToUse.naturalHeight, columns, rows);
                sx = c.sx; sy = c.sy; sw = c.sw; sh = c.sh;
            }
            else {
                if (this.isDashing) {
                    frameNumber = this.dashFrames[this.dashFrame];
                } else if (!this.isGrounded) {
                    frameNumber = (this.vy < 0) ? this.jumpUpFrame : this.jumpDownFrame;
                } else if (this.isGuarding && this.keys[this.controls.crouch]) {
                    frameNumber = this.guardFrames[Math.floor(this.animFrame) % this.guardFrames.length];
                } else if (this.isMovingAway(opponentX)) {
                    frameNumber = this.guardFrames[Math.floor(this.animFrame) % this.guardFrames.length];
                } else if (this.vx !== 0) {
                    if (this.walkReverse) {
                        const total = this.walkFrames.length;
                        const idx = total - 1 - (Math.floor(this.animFrame) % total);
                        frameNumber = this.walkFrames[idx];
                    } else {
                        frameNumber = this.walkFrames[Math.floor(this.animFrame) % this.walkFrames.length];
                    }
                } else {
                    frameNumber = this.idleFrames[Math.floor(this.animFrame) % this.idleFrames.length];
                }
                const c = getCellCoords(frameNumber - 1, currentImageToUse.naturalWidth, currentImageToUse.naturalHeight, columns, rows);
                sx = c.sx; sy = c.sy; sw = c.sw; sh = c.sh;
            }
        }

        if (facingLeft && !this.isSpinDashActive) {
            ctx.save();
            ctx.translate(drawX + renderWidth, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(currentImageToUse, sx, sy, sw, sh, 0, renderY, renderWidth, renderHeight);
            ctx.restore();
        } else if (this.isSpinDashActive && this.spinDirection < 0) {
            ctx.save();
            ctx.translate(drawX + renderWidth, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(currentImageToUse, sx, sy, sw, sh, 0, renderY, renderWidth, renderHeight);
            ctx.restore();
        } else {
            ctx.drawImage(currentImageToUse, sx, sy, sw, sh, drawX, renderY, renderWidth, renderHeight);
        }

        ctx.restore();
        this.drawHealthBar();
    }

    drawSingleCell(img, c, drawX, renderY, facingLeft) {
        if (facingLeft) {
            ctx.save();
            ctx.translate(drawX + this.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, renderY, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, drawX, renderY, this.width, this.height);
        }
    }

    drawHealthBar() {
        const cameraX = game.cameraX;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - cameraX, this.y - 20, this.width, 10);
        ctx.fillStyle = 'lime';
        ctx.fillRect(this.x - cameraX, this.y - 20, this.width * (this.health / this.maxHealth), 10);
    }
}