import { AspectStorage } from "../helpers/aspect-storage.js";
import { DomAspectWidget } from "./dom-aspect-widget.mjs";
import { ManagerCanvasWidget } from "./manager-widget.mjs";

const WIDGET_WIDTH = 220;
const WIDGET_MIN_HEIGHT = 56;
const WIDGET_RADIUS = 10;
const WIDGET_PADDING = 10;
const HANDLE_SIZE = 12;
const HANDLE_HIT = 24;

function buildWidgetText(aspect, tags) {
    const showTags = game.settings.get("fatex-extras", "sceneDrawingShowTags") ?? true;
    const showInvokes = game.settings.get("fatex-extras", "sceneDrawingShowInvokes") ?? true;
    const showHostile = game.settings.get("fatex-extras", "sceneDrawingShowHostile") ?? true;
    const compactInvokes = game.settings.get("fatex-extras", "sceneDrawingCompactInvokes") ?? false;
    const tagsText = (showTags && tags.length > 0) ? `[${tags.map(t => t.label).join(" | ")}]` : "";
    let invokesLine = "";
    if (showInvokes || showHostile) {
        if (compactInvokes) {
            if (showInvokes && showHostile) {
                const f = aspect.invokes ? "+".repeat(aspect.invokes) : "";
                const h = aspect.hostileInvokes ? "-".repeat(aspect.hostileInvokes) : "";
                if (f && h) invokesLine = `${f} | ${h}`;
                else if (f) invokesLine = f;
                else if (h) invokesLine = h;
                else invokesLine = "";
            } else if (showInvokes) invokesLine = aspect.invokes ? "+".repeat(aspect.invokes) : "";
            else invokesLine = aspect.hostileInvokes ? "-".repeat(aspect.hostileInvokes) : "";
        } else {
            const invokesLabel = game.i18n.localize("FAx.Global.Invokes");
            const hostileLabel = game.i18n.localize("FAx.Global.HostileInvokes");
            if (showInvokes && showHostile) invokesLine = `${invokesLabel}: ${aspect.invokes || 0} | ${hostileLabel}: ${aspect.hostileInvokes || 0}`;
            else if (showInvokes) invokesLine = `${invokesLabel}: ${aspect.invokes || 0}`;
            else invokesLine = `${hostileLabel}: ${aspect.hostileInvokes || 0}`;
        }
    }
    const text = aspect.name + (tagsText ? "\n" + tagsText : "") + (invokesLine ? "\n" + invokesLine : "");
    return { text, tagsText, invokesLine };
}

function hexToNumber(hex) {

    if (!hex) return 0x4a4a4a;
    const str = String(hex).trim();
    try {

        const ColorCls = globalThis.Color ?? foundry?.utils?.Color;
        if (ColorCls?.fromString) {
            const c = ColorCls.fromString(str);
            if (c !== null && c !== undefined) {
                if (typeof c.toNumberValue === "function") return c.toNumberValue();
                if (typeof c.value === "number") return c.value;
                if (typeof c === "number") return c;
            }
        }
        if (foundry?.utils?.colorStringToHex) {
            const n = foundry.utils.colorStringToHex(str);
            if (n !== null && n !== undefined) return n;
        }
        if (typeof PIXI !== "undefined" && PIXI.utils?.string2hex) {
            return PIXI.utils.string2hex(str);
        }
        const m = str.replace("#","").trim();
        if (/^[0-9a-fA-F]{6}$/.test(m)) return parseInt(m, 16);
    } catch {}
    return 0x4a4a4a;
}

function _stripHtml(html) {
    if (!html) return "";
    if (foundry?.utils?.stripHTML) try { return foundry.utils.stripHTML(html); } catch {}
    try {
        const d = document.createElement("div");
        d.innerHTML = html;
        return d.textContent || d.innerText || "";
    } catch { return String(html).replace(/<[^>]*>/g, ""); }
}

export class AspectWidget extends PIXI.Container {
    constructor(placement, aspect, tags) {
        super();
        this.placementId = placement.id;
        this.aspectId = placement.aspectId || placement.id;
        this.sceneId = placement.sceneId;
        this.placement = placement;
        this.aspect = aspect;
        this.tags = tags;
        this._dragging = false;
        this._dragOffset = null;
        this._didDrag = false;
        this._resizing = null;
        this._resizeStart = null;
        this._bg = null;
        this._texts = [];
        this._handles = [];
        this._hovered = false;
        this.eventMode = "static";
        this.cursor = "pointer";
        this.interactiveChildren = true;
        this.sortableChildren = false;
        this.x = placement.x;
        this.y = placement.y;
        this._build();
        this._bindEvents();
    }

    _getDimensions() {
        const w = this.placement.width ?? WIDGET_WIDTH;
        const aspect = this.aspect;
        const tags = this.tags;
        const showTags = game.settings.get("fatex-extras", "sceneDrawingShowTags") ?? true;
        const fontFamily = game.settings.get("fatex-extras", "sceneDrawingFont") || "Signika";
        const TextClass = foundry?.canvas?.containers?.PreciseText ?? PIXI.Text;
        const fixedH = this.placement.height ?? null;
        const scaleW = w / WIDGET_WIDTH;
        const { text, invokesLine } = buildWidgetText(aspect, tags);


        const contentHeightAt = (s) => {
            const nameSize = Math.round(Math.max(12, Math.min(120, 16 * s)));
            const nameLH = Math.round(nameSize * 1.2);
            const st = new PIXI.TextStyle({ fontFamily, fontSize: nameSize, wordWrap: true, wordWrapWidth: w - WIDGET_PADDING * 2, align: "center", lineHeight: nameLH });
            const nm = new TextClass(aspect.name ? aspect.name.trim() : " ", st);
            const nameH = nm.height;
            nm.destroy();
            const pillRowH = (showTags && tags.length > 0) ? Math.round(13 * s) : 0;
            const gap = 4 * s;
            const invSize = Math.round(Math.max(9, Math.min(48, 10.5 * s)));
            const invLH = Math.round(invSize * 1.15);
            return WIDGET_PADDING + nameH + gap + pillRowH + (pillRowH ? gap : 0) + (invokesLine ? invLH : 0) + WIDGET_PADDING;
        };



        if (!fixedH) {
            const scale = Math.max(0.55, scaleW);
            const h = Math.max(WIDGET_MIN_HEIGHT, contentHeightAt(scale));
            return { w, h, text, lines: text.split("\n"), effectiveScale: scale };
        }




        const target = Math.max(0.55, Math.max(scaleW, (fixedH / 70) * 0.9));
        let scale = target;
        if (contentHeightAt(target) > fixedH) {
            let lo = 0.55, hi = target;
            for (let i = 0; i < 8; i++) {
                const mid = (lo + hi) / 2;
                if (contentHeightAt(mid) <= fixedH) lo = mid;
                else hi = mid;
            }
            scale = lo;
        }
        const h = fixedH;
        return { w, h, text, lines: text.split("\n"), effectiveScale: scale };
    }

    _build() {
        this.removeChildren();
        this._texts = [];
        this._handles = [];
        const aspect = this.aspect;
        const tags = this.tags;
        const { w, h, text, lines, effectiveScale } = this._getDimensions();

        const fontFamily = game.settings.get("fatex-extras", "sceneDrawingFont") || "Signika";
        const strokeColorSetting = game.settings.get("fatex-extras", "sceneDrawingStrokeColor");
        let strokeColor = "#ffffff";
        if (strokeColorSetting) {
            if (typeof strokeColorSetting === "string") strokeColor = strokeColorSetting;
            else if (strokeColorSetting.css) strokeColor = strokeColorSetting.css;
            else if (strokeColorSetting.toString) strokeColor = strokeColorSetting.toString();
        }
        const strokeAlpha = game.settings.get("fatex-extras", "sceneDrawingStrokeAlpha") ?? 0.3;
        const bgAlpha = game.settings.get("fatex-extras", "sceneDrawingBgAlpha") ?? 1;
        const bgColorNum = hexToNumber(aspect.color || "#4a4a4a");
        const strokeColorNum = hexToNumber(strokeColor);

        const TextClass = foundry?.canvas?.containers?.PreciseText ?? PIXI.Text;


        const bg = new PIXI.Graphics();

        bg.beginFill(0x000000, 0.32);
        bg.drawRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, WIDGET_RADIUS);
        bg.endFill();

        const fillCol = hexToNumber(String(aspect.color || "#4a4a4a").trim());
        bg.beginFill(fillCol, bgAlpha);
        if (strokeAlpha > 0 && strokeColorNum !== null) bg.lineStyle(2.5, strokeColorNum, strokeAlpha);
        else bg.lineStyle(0);
        bg.drawRoundedRect(-w / 2, -h / 2, w, h, WIDGET_RADIUS);
        bg.endFill();

        bg.beginFill(0xffffff, 0.07);
        bg.drawRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, 9, WIDGET_RADIUS);
        bg.endFill();
        bg.eventMode = "none";
        this.addChild(bg);
        this._bg = bg;
        this.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);


        let y = -h / 2 + WIDGET_PADDING;

        const nameLine = aspect.name ? aspect.name.trim() : " ";
        const nameSize = Math.round(Math.max(12, Math.min(120, 16 * effectiveScale)));
        const nameLH = Math.round(nameSize * 1.2);
        const nameStyle = new PIXI.TextStyle({ fontFamily, fontSize: nameSize, fill: 0xffffff, fontWeight: "800", wordWrap: true, wordWrapWidth: w - WIDGET_PADDING * 2, align: "center", lineHeight: nameLH, dropShadow: false });
        const nameText = new TextClass(nameLine, nameStyle);
        nameText.anchor.set(0.5, 0);
        nameText.x = 0;
        nameText.y = y;
        nameText.eventMode = "none";
        this.addChild(nameText);
        this._texts.push(nameText);
        y += nameText.height + 4 * Math.min(effectiveScale, 1.2);


        const showTags = game.settings.get("fatex-extras", "sceneDrawingShowTags") ?? true;
        if (showTags && tags.length > 0) {

            if (true) {
                const pillPadX = 6 * effectiveScale;
                const pillH = Math.round(13 * effectiveScale);
                const pillGap = 4 * effectiveScale;
                const pillFont = Math.round(Math.max(8, 9 * effectiveScale));
                let totalW = 0;
                const pillWidths = tags.map(tag => {
                    const ls = new PIXI.TextStyle({ fontFamily, fontSize: pillFont, fill: 0xffffff, fontWeight: "700" });
                    const tt = new TextClass(tag.label, ls);
                    const tw = tt.width + pillPadX * 2;
                    tt.destroy();
                    return tw;
                });
                totalW = pillWidths.reduce((a, b) => a + b, 0) + pillGap * (tags.length - 1);
                let curX = -Math.min(totalW, w - WIDGET_PADDING * 2) / 2;
                if (totalW > w - WIDGET_PADDING * 2) curX = -w / 2 + WIDGET_PADDING;
                for (let i = 0; i < tags.length; i++) {
                    const tag = tags[i];
                    const pw = pillWidths[i];
                    if (curX + pw > w / 2 - WIDGET_PADDING) break;
                    if (y + pillH > h / 2 - 4) break;
                    const pill = new PIXI.Graphics();
                    pill.beginFill(hexToNumber(tag.color || "#7a7a7a"), 1);
                    pill.drawRoundedRect(0, 0, pw, pillH, pillH / 2);
                    pill.endFill();
                    pill.x = curX;
                    pill.y = y;
                    pill.eventMode = "none";
                    this.addChild(pill);
                    const ls2 = new PIXI.TextStyle({ fontFamily, fontSize: pillFont, fill: 0xffffff, fontWeight: "700", align: "center" });
                    const pt = new TextClass(tag.label, ls2);
                    pt.anchor.set(0.5, 0.5);
                    pt.x = curX + pw / 2;
                    pt.y = y + pillH / 2 + 0.5;
                    pt.eventMode = "none";
                    this.addChild(pt);
                    curX += pw + pillGap;
                }
                y += pillH + 4 * effectiveScale;
            }
        }

        const showInvokes = game.settings.get("fatex-extras", "sceneDrawingShowInvokes") ?? true;
        const showHostile = game.settings.get("fatex-extras", "sceneDrawingShowHostile") ?? true;
        let invokesText = "";
        const compact = game.settings.get("fatex-extras", "sceneDrawingCompactInvokes") ?? false;
        if (showInvokes || showHostile) {
            if (compact) {
                if (showInvokes && showHostile) {
                    const f = aspect.invokes ? "+".repeat(aspect.invokes) : "";
                    const h = aspect.hostileInvokes ? "-".repeat(aspect.hostileInvokes) : "";
                    if (f && h) invokesText = `${f} | ${h}`;
                    else if (f) invokesText = f;
                    else if (h) invokesText = h;
                    else invokesText = "";
                } else if (showInvokes) invokesText = aspect.invokes ? "+".repeat(aspect.invokes) : "";
                else invokesText = aspect.hostileInvokes ? "-".repeat(aspect.hostileInvokes) : "";
            } else {
                const invLbl = game.i18n.localize("FAx.Global.Invokes");
                const hosLbl = game.i18n.localize("FAx.Global.HostileInvokes");
                if (showInvokes && showHostile) invokesText = `${invLbl}: ${aspect.invokes || 0} | ${hosLbl}: ${aspect.hostileInvokes || 0}`;
                else if (showInvokes) invokesText = `${invLbl}: ${aspect.invokes || 0}`;
                else invokesText = `${hosLbl}: ${aspect.hostileInvokes || 0}`;
            }
        }
        if (invokesText) {
            if (invokesText.trim() !== "") {
                const invSize = Math.round(Math.max(9, Math.min(48, 10.5 * effectiveScale)));
                const invLH = Math.round(invSize * 1.15);
                const invStyle = new PIXI.TextStyle({ fontFamily, fontSize: invSize, fill: 0xffffff, fontWeight: "700", wordWrap: true, wordWrapWidth: w - WIDGET_PADDING * 2, align: "center", lineHeight: invLH });
                const invText = new TextClass(invokesText, invStyle);
                invText.anchor.set(0.5, 0);
                invText.x = 0;
                const clampedY = Math.min(y, h / 2 - invLH - 4);
                invText.y = Math.max(-h / 2 + WIDGET_PADDING, clampedY);
                invText.eventMode = "none";
                this.addChild(invText);
                this._texts.push(invText);
            }
        }

        this._createHandles(w, h);
    }

    _canEdit() {
        if (game.user.isGM) return true;
        if (this.placement?.source === "character" && this.placement?.actorId) {
            const actor = game.actors.get(this.placement.actorId);
            if (actor?.isOwner) return true;
        }

        return false;
    }

    _createHandles(w, h) {
        if (!this._canEdit()) return;
        const isEdge = (n) => n.length === 1;
        const positions = [
            { name: "tl", x: -w / 2, y: -h / 2, cursor: "nwse-resize" },
            { name: "tr", x: w / 2, y: -h / 2, cursor: "nesw-resize" },
            { name: "bl", x: -w / 2, y: h / 2, cursor: "nesw-resize" },
            { name: "br", x: w / 2, y: h / 2, cursor: "nwse-resize" },
            { name: "t", x: 0, y: -h / 2, cursor: "ns-resize" },
            { name: "b", x: 0, y: h / 2, cursor: "ns-resize" },
            { name: "l", x: -w / 2, y: 0, cursor: "ew-resize" },
            { name: "r", x: w / 2, y: 0, cursor: "ew-resize" }
        ];
        for (const pos of positions) {
            const isCorner = !isEdge(pos.name);
            const sz = isCorner ? HANDLE_SIZE : (pos.name === "t" || pos.name === "b" ? 26 : 9);
            const szH = isCorner ? HANDLE_SIZE : (pos.name === "t" || pos.name === "b" ? 9 : 26);
            const hitW = isCorner ? HANDLE_HIT : (pos.name === "t" || pos.name === "b" ? 44 : 20);
            const hitH = isCorner ? HANDLE_HIT : (pos.name === "t" || pos.name === "b" ? 18 : 40);
            const hdl = new PIXI.Graphics();

            hdl.beginFill(0x000000, 0.0);
            hdl.drawRoundedRect(-hitW / 2, -hitH / 2, hitW, hitH, 4);
            hdl.endFill();
            hdl.beginFill(0xffffff, 0.88);
            hdl.lineStyle(1, 0x444444, 0.28);
            if (isCorner) hdl.drawRoundedRect(-sz / 2, -sz / 2, sz, sz, 2);
            else hdl.drawRoundedRect(-sz / 2, -szH / 2, sz, szH, 3);
            hdl.endFill();
            hdl.x = pos.x;
            hdl.y = pos.y;
            hdl.eventMode = "static";
            hdl.cursor = pos.cursor;
            hdl.hitArea = new PIXI.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH);
            hdl._handleName = pos.name;
            hdl.on("pointerdown", (e) => this._onHandlePointerDown(e, pos.name));
            hdl.visible = this._hovered || this._resizing === pos.name;
            hdl.alpha = 0.92;
            this.addChild(hdl);
            this._handles.push(hdl);
        }
    }

    _updateHandleVisibility(hovered) {
        this._hovered = hovered;
        const selected = canvas.aspects?.isSelected?.(this.placementId);
        for (const h of this._handles) {
            h.visible = hovered || this._resizing !== null || selected;
            h.alpha = selected ? 1 : 0.92;
        }
    }

    _setSelected(selected) {
        this._selected = selected;

        this._build();
        this._updateHandleVisibility(this._hovered);

        if (selected) {
            const dims = this._getDimensions();
            const sel = new PIXI.Graphics();
            sel.lineStyle(2.5, 0x00aaff, 0.95, 0.5);
            sel.drawRoundedRect(-dims.w/2 -3, -dims.h/2 -3, dims.w+6, dims.h+6, WIDGET_RADIUS+2);
            sel.eventMode = "none";
            sel.name = "selectionGlow";
            this.addChild(sel);
        } else {
            const old = this.getChildByName?.("selectionGlow") || this.children.find(c => c.name === "selectionGlow");
            if (old) this.removeChild(old);
        }
    }

    refresh(aspect, tags) {
        this.aspect = aspect;
        this.tags = tags;
        this._build();
    }

    _getWindowUpHandler() {
        if (!this.__windowUpHandler) {
            this.__windowUpHandler = (e) => {

                if (this._dragging || this._resizing || this._dragOffset || this._resizeStart) {

                    const fakeEvent = { button: 0, stopPropagation: () => {}, preventDefault: () => {} };
                    this._onStagePointerUp(fakeEvent);
                }
            };
        }
        return this.__windowUpHandler;
    }

    destroy(options) {
        const stage = canvas?.app?.stage;
        if (stage) {
            stage.off("pointermove", this._onPointerMove, this);
            stage.off("pointerup", this._onStagePointerUp, this);
            stage.off("pointerupoutside", this._onStagePointerUp, this);
        }
        window.removeEventListener("pointerup", this._getWindowUpHandler());
        window.removeEventListener("mouseup", this._getWindowUpHandler());
        window.removeEventListener("pointercancel", this._getWindowUpHandler());
        super.destroy(options);
    }

    _bindEvents() {
        this.on("pointerover", () => this._updateHandleVisibility(true), this);
        this.on("pointerout", () => {
            if (!this._dragging && !this._resizing) this._updateHandleVisibility(false);
        }, this);
        this.on("pointerdown", this._onPointerDown, this);
        this.on("rightclick", this._onRightClick, this);
        this.on("rightdown", this._onRightClick, this);
        this.on("pointerup", this._onPointerUp, this);
        this.on("pointerupoutside", this._onPointerUp, this);
        this.on("dblclick", this._openManager, this);
        this.on("click", (event) => {
            if (event.detail === 2) {
                event.stopPropagation();
                this._openManager();
            }
        }, this);

        this.on("pointerdown", (event) => {
            if (event.button === 2 || event.data?.button === 2) {

                event.stopPropagation();
                event.preventDefault?.();

                setTimeout(() => {
                    if (!document.querySelector(".fatex-context-menu")) this._onRightClick(event);
                }, 10);
            }
        }, this);
    }

    _onPointerDown(event) {
        if (!this._canEdit()) return;
        if (event.button === 2) {

            event.stopPropagation();
            event.preventDefault?.();
            return;
        }
        if (event.target?._handleName || event.target?._isDeleteButton) return;

        const layer = canvas.aspects;
        const isCtrl = event.ctrlKey || event.metaKey;
        const isShift = event.shiftKey;
        if (layer) {
            const wasSelected = layer.isSelected(this.placementId);
            if (isCtrl) {
                layer.select(this.placementId, { toggle: true });
                if (layer.isSelected(this.placementId) === wasSelected) {

                }

                if (!layer.isSelected(this.placementId)) {
                    event.stopPropagation();
                    return;
                }
            } else if (isShift) {
                layer.select(this.placementId, { append: true });
            } else if (!wasSelected) {
                layer.select(this.placementId, { append: false });
            }

        }
        event.stopPropagation();
        const pos = event.getLocalPosition(this.parent);
        this._dragOffset = { x: pos.x - this.x, y: pos.y - this.y };
        this._dragging = false;
        this._didDrag = false;
        this._dragStart = { x: this.x, y: this.y, posX: pos.x, posY: pos.y };

        if (layer && layer.selectedIds.has(this.placementId)) {
            this._multiDragStarts = new Map();
            for (const id of layer.selectedIds) {
                const w = layer.widgets.get(id) || layer.domWidgets.get(id);
                if (w) this._multiDragStarts.set(id, { x: w.x ?? w.placement.x, y: w.y ?? w.placement.y });
            }
        } else {
            this._multiDragStarts = null;
        }
        this.alpha = 0.85;
        const stage = canvas?.app?.stage;
        if (stage) {
            stage.on("pointermove", this._onPointerMove, this);
            stage.on("pointerup", this._onStagePointerUp, this);
            stage.on("pointerupoutside", this._onStagePointerUp, this);
        }
        window.addEventListener("pointerup", this._getWindowUpHandler());
        window.addEventListener("mouseup", this._getWindowUpHandler());
        window.addEventListener("pointercancel", this._getWindowUpHandler());
        this.zIndex = 1000;
        if (this.parent) this.parent.sortChildren();
    }

    _onHandlePointerDown(event, handleName) {
        if (!this._canEdit()) return;
        if (event.button !== undefined && event.button !== 0) return;

        if (event.data?.button === 2 || event.button === 2) return;
        event.stopPropagation();
        const pos = event.getLocalPosition(this.parent);
        const dims = this._getDimensions();
        this._resizing = handleName;
        this._didDrag = false;
        this._resizeStart = {
            handle: handleName,
            w: dims.w,
            h: dims.h,
            posX: pos.x,
            posY: pos.y,
            centerX: this.x,
            centerY: this.y
        };
        this.alpha = 0.9;
        const stage = canvas?.app?.stage;
        if (stage) {
            stage.on("pointermove", this._onPointerMove, this);
            stage.on("pointerup", this._onStagePointerUp, this);
            stage.on("pointerupoutside", this._onStagePointerUp, this);
        }
        window.addEventListener("pointerup", this._getWindowUpHandler());
        window.addEventListener("mouseup", this._getWindowUpHandler());
        window.addEventListener("pointercancel", this._getWindowUpHandler());
        for (const h of this._handles) h.visible = h._handleName === handleName;
    }

    _onPointerMove(event) {
        const pos = event.getLocalPosition(this.parent);
        if (this._resizing) {
            const snapStep = event.shiftKey ? (Math.max(8, (canvas.scene?.grid?.size || canvas.dimensions?.size || 100) / 4)) : null;
            const snap = (v) => snapStep ? Math.round(v / snapStep) * snapStep : v;

            const sdx = snap(pos.x - this._resizeStart.posX);
            const sdy = snap(pos.y - this._resizeStart.posY);
            const dx = event.shiftKey ? sdx : pos.x - this._resizeStart.posX;
            const dy = event.shiftKey ? sdy : pos.y - this._resizeStart.posY;
            if (Math.hypot(dx, dy) < 4 && !this._didDrag) return;
            this._didDrag = true;
            let newW = this._resizeStart.w;
            let newH = this._resizeStart.h;
            let newX = this._resizeStart.centerX;
            let newY = this._resizeStart.centerY;
            const handle = this._resizing;

            if (handle === "br") {
                newW = Math.max(100, this._resizeStart.w + dx);
                newH = Math.max(40, this._resizeStart.h + dy);
                newX = this._resizeStart.centerX + dx / 2;
                newY = this._resizeStart.centerY + dy / 2;
            } else if (handle === "tl") {
                newW = Math.max(100, this._resizeStart.w - dx);
                newH = Math.max(40, this._resizeStart.h - dy);
                newX = this._resizeStart.centerX + dx / 2;
                newY = this._resizeStart.centerY + dy / 2;
            } else if (handle === "tr") {
                newW = Math.max(100, this._resizeStart.w + dx);
                newH = Math.max(40, this._resizeStart.h - dy);
                newX = this._resizeStart.centerX + dx / 2;
                newY = this._resizeStart.centerY + dy / 2;
            } else if (handle === "bl") {
                newW = Math.max(100, this._resizeStart.w - dx);
                newH = Math.max(40, this._resizeStart.h + dy);
                newX = this._resizeStart.centerX + dx / 2;
                newY = this._resizeStart.centerY + dy / 2;
            } else if (handle === "r") {
                newW = Math.max(100, this._resizeStart.w + dx);
                newX = this._resizeStart.centerX + dx / 2;
            } else if (handle === "l") {
                newW = Math.max(100, this._resizeStart.w - dx);
                newX = this._resizeStart.centerX + dx / 2;
            } else if (handle === "b") {
                newH = Math.max(40, this._resizeStart.h + dy);
                newY = this._resizeStart.centerY + dy / 2;
            } else if (handle === "t") {
                newH = Math.max(40, this._resizeStart.h - dy);
                newY = this._resizeStart.centerY + dy / 2;
            }
            this.placement.width = newW;
            this.placement.height = newH;
            this.x = newX;
            this.y = newY;

            const dims = canvas.dimensions;
            this.x = Math.max(newW / 2, Math.min(dims.width - newW / 2, this.x));
            this.y = Math.max(newH / 2, Math.min(dims.height - newH / 2, this.y));
            this._build();
            for (const h of this._handles) if (h._handleName === handle) h.visible = true;
            event.stopPropagation();
            return;
        }
        if (!this._dragOffset) return;
        const dx = pos.x - this._dragStart.posX;
        const dy = pos.y - this._dragStart.posY;
        if (!this._dragging && Math.hypot(dx, dy) < 6) return;
        this._dragging = true;
        this._didDrag = true;

        const grid = event.shiftKey ? (canvas.scene?.grid?.size || canvas.dimensions?.size || 100) : null;
        const snapStep = grid ? Math.max(8, grid / 4) : null;
        let effDX = dx;
        let effDY = dy;
        if (snapStep) {
            const anchorX = this._dragStart.x + dx;
            const anchorY = this._dragStart.y + dy;
            effDX = Math.round(anchorX / snapStep) * snapStep - this._dragStart.x;
            effDY = Math.round(anchorY / snapStep) * snapStep - this._dragStart.y;
        }

        const layer = canvas.aspects;
        const isMulti = layer && layer.selectedIds.size > 1 && layer.isSelected(this.placementId);
        if (isMulti) {
            for (const id of layer.selectedIds) {
                const w = layer.widgets.get(id);
                const start = this._multiDragStarts?.get(id);
                if (!w || !start) continue;
                const dims = w._getDimensions();
                const nx = start.x + effDX;
                const ny = start.y + effDY;
                w.x = Math.max(dims.w/2, Math.min(canvas.dimensions.width - dims.w/2, nx));
                w.y = Math.max(dims.h/2, Math.min(canvas.dimensions.height - dims.h/2, ny));
                w.placement.x = w.x;
                w.placement.y = w.y;
            }

            this.x = Math.max(this._getDimensions().w/2, Math.min(canvas.dimensions.width - this._getDimensions().w/2, this._dragStart.x + effDX));
            this.y = Math.max(this._getDimensions().h/2, Math.min(canvas.dimensions.height - this._getDimensions().h/2, this._dragStart.y + effDY));
            this.placement.x = this.x;
            this.placement.y = this.y;
        } else {
            const newX = this._dragStart.x + effDX;
            const newY = this._dragStart.y + effDY;
            const dims = canvas.dimensions;
            const { w, h } = this._getDimensions();
            this.x = Math.max(w / 2, Math.min(dims.width - w / 2, newX));
            this.y = Math.max(h / 2, Math.min(dims.height - h / 2, newY));
        }
        event.stopPropagation();
    }

    _onStagePointerUp(event) {

        const btn = event?.button ?? event?.data?.button;
        if (btn !== undefined && btn !== 0 && btn !== 1) {
            const stageR = canvas?.app?.stage;
            if (stageR) {
                stageR.off("pointermove", this._onPointerMove, this);
                stageR.off("pointerup", this._onStagePointerUp, this);
                stageR.off("pointerupoutside", this._onStagePointerUp, this);
            }
            window.removeEventListener("pointerup", this._getWindowUpHandler());
            window.removeEventListener("mouseup", this._getWindowUpHandler());
            window.removeEventListener("pointercancel", this._getWindowUpHandler());
            this.alpha = 1;
            this.zIndex = 0;
            this._dragging = false;
            this._dragOffset = null;
            this._dragStart = null;

            if (this._resizing) {
                const dims = this._getDimensions();
                this.placement.width = this._resizeStart?.w ?? dims.w;
                this.placement.height = this._resizeStart?.h ?? dims.h;
                this.x = this._resizeStart?.centerX ?? this.x;
                this.y = this._resizeStart?.centerY ?? this.y;
                this._build();
            }
            this._resizing = null;
            this._resizeStart = null;
            this._didDrag = false;
            this._updateHandleVisibility(false);
            return;
        }
        const stage = canvas?.app?.stage;
        if (stage) {
            stage.off("pointermove", this._onPointerMove, this);
            stage.off("pointerup", this._onStagePointerUp, this);
            stage.off("pointerupoutside", this._onStagePointerUp, this);
        }
        window.removeEventListener("pointerup", this._getWindowUpHandler());
        window.removeEventListener("mouseup", this._getWindowUpHandler());
        window.removeEventListener("pointercancel", this._getWindowUpHandler());
        this.alpha = 1;
        this.zIndex = 0;
        const wasResizing = !!this._resizing;
        const wasDragging = this._didDrag;
        const layer = canvas.aspects;
        const isMulti = layer && layer.selectedIds.size > 1 && layer.isSelected(this.placementId);
        if (wasResizing && wasDragging) {
            event?.stopPropagation?.();
            this._savePlacement();
            this._updateHandleVisibility(false);
        } else if (wasDragging) {
            event?.stopPropagation?.();
            if (isMulti) {

                (async () => {
                    const storage = await AspectStorage.getStorage();
                    if (!storage) return;
                    const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
                    for (const id of layer.selectedIds) {
                        const w = layer.widgets.get(id);
                        const p = placements.find(pl => pl.id === id);
                        if (w && p) { p.x = w.x; p.y = w.y; }
                    }
                    await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
                    game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
                })();
            } else {
                this._savePosition();
            }
        } else if (!wasDragging && !wasResizing) {

            layer?._updateSelectionVisuals();
        }
        this._dragging = false;
        this._dragOffset = null;
        this._dragStart = null;
        this._multiDragStarts = null;
        this._resizing = null;
        this._resizeStart = null;
        setTimeout(() => { this._didDrag = false; }, 50);
        if (!wasResizing) this._updateHandleVisibility(false);
    }

    _onPointerUp(event) {
        if (this._didDrag || this._resizing) {
            event.stopPropagation();
            return;
        }
        if (event.detail === 2) {
            event.stopPropagation();
            this._openManager();
        }
    }

    async _savePosition() {
        const storage = await AspectStorage.getStorage();
        if (!storage) return;
        const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
        const p = placements.find(pl => pl.id === this.placementId);
        if (!p) return;
        p.x = this.x;
        p.y = this.y;
        await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
        game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
    }

    async _savePlacement() {
        const storage = await AspectStorage.getStorage();
        if (!storage) return;
        const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
        const p = placements.find(pl => pl.id === this.placementId);
        if (!p) return;
        p.x = this.x;
        p.y = this.y;
        p.width = this.placement.width;
        p.height = this.placement.height;
        await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
        game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
    }

    _onRightClick(event) {
        console.log("FateX Extras | Widget _onRightClick", { id: this.placementId, source: this.placement?.source, aspect: this.aspect?.name });
        event.stopPropagation();
        event.preventDefault?.();

        const layer = canvas.aspects;
        if (layer?._showWidgetContextMenu) layer._showWidgetContextMenu(this, event);
        else if (typeof globalThis._showWidgetContextMenu === "function") globalThis._showWidgetContextMenu(this, event);
        else {

            import("../main.js").then(() => {});
        }
    }

    async _onDeleteClick(event) {
        if (!this._canEdit()) {
            ui.notifications.warn(game.i18n.localize("FAx.Global.CannotDeleteStorage"));
            return;
        }
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("FAx.Global.DeleteAspectTitle") || "Delete Aspect",
            content: `<p>${game.i18n.localize("FAx.Global.DeleteAspectConfirm") || "Delete this aspect from the scene?"}</p>`,
            defaultYes: false
        });
        if (!confirmed) return;
        const layer = canvas.aspects;
        if (layer?.deletePlacement) await layer.deletePlacement(this.placementId);
        else {
            const storage = await AspectStorage.getStorage();
            if (!storage) return;
            let placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
            placements = placements.filter(p => p.id !== this.placementId);
            await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
            game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
            canvas.aspects?.refreshWidgets?.();
        }
    }

    _openManager() {
        if (this.placement?.source === "manager") {
            if (typeof globalThis.openAspectManager === "function") globalThis.openAspectManager();
            else if (typeof _openAspectManagerGlobal === "function") _openAspectManagerGlobal();
            else import("../apps/scene-aspects.js").then(({ SceneAspectsApp: App }) => new App().render(true));
            return;
        }

        if (this.placement?.source === "character" && this.placement?.actorId) {
            const actor = game.actors.get(this.placement.actorId);
            if (actor) { actor.sheet.render(true); return; }
        }
        const SceneAspectsApp = foundry.utils.getProperty(window, "SceneAspectsApp") || null;

        if (typeof globalThis.showSceneAspectInManager === "function") globalThis.showSceneAspectInManager(this.aspectId);
        else if (typeof _openAspectManagerGlobal === "function") _openAspectManagerGlobal(this.aspectId);
        else {
            const existing = Object.values(ui.windows).find(w => w.constructor?.name === "SceneAspectsApp");
            if (existing) existing.close();

            import("../apps/scene-aspects.js").then(({ SceneAspectsApp: App }) => {
                new App({ focusAspectId: this.aspectId }).render(true);
            });
        }
    }
}


globalThis._openAspectManagerGlobal = null;

export class AspectWidgetsLayer extends foundry.canvas.layers.InteractionLayer {
    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            name: "aspects",
            zIndex: 900
        });
    }

    constructor() {
        super();
        this.widgets = new Map();
        this.domWidgets = new Map();
        this.managerWidgets = new Map();
        this._domContainer = null;
        this._managerContainer = null;
        this._refreshDebounced = foundry.utils.debounce(() => this.refreshWidgets(), 50);
        this._createLock = Promise.resolve();
        this.selectedIds = new Set();
        this._selectionGraphics = null;
        this._marqueeStart = null;
    }

    static prepareSceneControls() {
        return null;
    }

    isSelected(placementId) {
        return this.selectedIds.has(placementId);
    }

    _isSelectionToolActive() {
        const controls = ui.controls;
        const control = controls?.control ?? controls?.activeControl;
        const tool = controls?.tool ?? controls?.activeTool;
        const controlName = typeof control === "string" ? control : control?.name;
        const toolName = typeof tool === "string" ? tool : tool?.name;
        if (controlName && controlName !== "tokens") return false;
        if (toolName) return toolName === "select";
        return !!canvas.tokens?.active;
    }

    select(placementId, { append = false, toggle = false } = {}) {
        if (toggle) {
            if (this.selectedIds.has(placementId)) this.selectedIds.delete(placementId);
            else this.selectedIds.add(placementId);
        } else if (append) {
            this.selectedIds.add(placementId);
        } else {
            this.selectedIds.clear();
            this.selectedIds.add(placementId);
        }
        this._updateSelectionVisuals();
        return this.selectedIds.has(placementId);
    }

    clearSelection() {
        if (this.selectedIds.size === 0) return;
        this.selectedIds.clear();
        this._updateSelectionVisuals();
    }

    selectInside(rect, { append = false } = {}) {
        if (!append) this.selectedIds.clear();
        for (const w of this.widgets.values()) {
            const dims = w._getDimensions();
            const bounds = new PIXI.Rectangle(w.x - dims.w/2, w.y - dims.h/2, dims.w, dims.h);
            if (rect.x < bounds.x + bounds.width && rect.x + rect.width > bounds.x && rect.y < bounds.y + bounds.height && rect.y + rect.height > bounds.y) {
                this.selectedIds.add(w.placementId);
            }
        }

        for (const w of this.domWidgets.values()) {
            const r = w.element.getBoundingClientRect();
            const worldPos = { x: w.placement.x, y: w.placement.y };

            const dims = { w: w.element.offsetWidth, h: w.element.offsetHeight };

            const scale = canvas.stage.scale.x || 1;
            const screenPos = canvas.clientCoordinatesFromCanvas ? canvas.clientCoordinatesFromCanvas(worldPos) : { x: worldPos.x, y: worldPos.y };

        }
        this._updateSelectionVisuals();
    }

    _updateSelectionVisuals() {
        for (const w of this.widgets.values()) {
            const selected = this.isSelected(w.placementId);
            w._setSelected?.(selected);
        }
        for (const w of this.domWidgets.values()) {
            w._setSelected?.(this.isSelected(w.id));
        }
    }

    _ensureSelectionGraphics() {
        if (this._selectionGraphics && !this._selectionGraphics.destroyed && !this._selectionGraphics.parent) this.addChild(this._selectionGraphics);
        if (!this._selectionGraphics || this._selectionGraphics.destroyed) {
            this._selectionGraphics = new PIXI.Graphics();
            this._selectionGraphics.eventMode = "none";
            this.addChild(this._selectionGraphics);
        }
        return this._selectionGraphics;
    }

    _drawSelectionRect(rect) {
        const g = this._ensureSelectionGraphics();
        g.clear();
        if (!rect) { g.visible = false; return; }
        g.visible = true;
        g.lineStyle(1.5, 0x00aaff, 0.9, 0.5);
        g.beginFill(0x00aaff, 0.12);
        g.drawRect(rect.x, rect.y, rect.width, rect.height);
        g.endFill();
    }

    async deleteSelected() {
        if (this.selectedIds.size === 0) return;
        const ids = [...this.selectedIds];
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("FAx.Global.DeleteAspectTitle") || "Delete Aspects",
            content: `<p>Delete ${ids.length} selected aspect(s) from the scene? (Aspects stay in journal)</p>`,
            defaultYes: false
        });
        if (!confirmed) return;
        const storage = await AspectStorage.getStorage();
        if (!storage) return;
        let placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
        placements = placements.filter(p => !ids.includes(p.id));
        await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
        this.selectedIds.clear();
        this._drawSelectionRect(null);
        game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
        await this.refreshWidgets();
    }

    async _draw(options) {
        await super._draw(options);


        this.widgets.clear();
        this.domWidgets.clear();
        this.managerWidgets.clear();
        this._selectionGraphics = null;

        this.hitArea = null;
        this.eventMode = "passive";
        this.interactiveChildren = true;
        this.sortableChildren = true;
        this.visible = true;
        this.alpha = 1;

        if (this._managerContainer) this._managerContainer.innerHTML = "";
        this._ensureManagerContainer();

        if (!this._domContainer) {
            this._domContainer = document.createElement("div");
            this._domContainer.id = "fatex-aspect-widgets";
            this._domContainer.style.cssText = "position:fixed; inset:0; pointer-events:none; z-index:50;";
            document.body.appendChild(this._domContainer);
            Hooks.on("canvasPan", () => this._updateDomPositions());
        }

        if (!this._marqueeHandlersBound) {
            this._marqueeHandlersBound = true;
            this._marqueeActive = false;
            this._marqueeStartWorld = null;
            const isOnWidget = (worldPos) => {
                for (const w of this.widgets.values()) {
                    const dims = w._getDimensions();
                    const bounds = new PIXI.Rectangle(w.x - dims.w/2, w.y - dims.h/2, dims.w, dims.h);
                    if (bounds.contains(worldPos.x, worldPos.y)) return true;
                }
                return false;
            };
            const isOnPlaceable = (worldPos) => {
                try {


                    const tokens = canvas.tokens?.placeables || [];
                    for (const p of tokens) {
                        const b = p.bounds;
                        if (b && b.contains(worldPos.x, worldPos.y)) return true;
                    }
                } catch {}
                return false;
            };
            const onPointerDown = (e) => {
                if (e.button !== 0) return;
                if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                if (!canvas.ready) return;
                if (!this._isSelectionToolActive()) return;
                const world = (() => {
                    try {
                        if (canvas.canvasCoordinatesFromClient) {
                            const p = canvas.canvasCoordinatesFromClient({ x: e.clientX, y: e.clientY });
                            if (p) return p;
                        }
                    } catch {}
                    return null;
                })();
                if (!world) return;
                if (isOnWidget(world)) return;
                if (isOnPlaceable(world)) return;

                const isOnCanvas = e.target === canvas.app.view || e.target.closest?.("#board") || (canvas.app.view && canvas.app.view.contains(e.target));
                if (!isOnCanvas) return;
                this._marqueeActive = true;
                this._marqueeStartWorld = world;
                const g = this._ensureSelectionGraphics();
                g.clear();
                g.visible = true;
                const onMove = (ev) => {
                    if (!this._marqueeActive) return;
                    const cur = (() => {
                        try {
                            if (canvas.canvasCoordinatesFromClient) return canvas.canvasCoordinatesFromClient({ x: ev.clientX, y: ev.clientY });
                        } catch { return null; }
                    })();
                    if (!cur) return;
                    const x = Math.min(this._marqueeStartWorld.x, cur.x);
                    const y = Math.min(this._marqueeStartWorld.y, cur.y);
                    const w = Math.abs(cur.x - this._marqueeStartWorld.x);
                    const h = Math.abs(cur.y - this._marqueeStartWorld.y);
                    this._drawSelectionRect({ x, y, width: w, height: h });
                };
                const onUp = (ev) => {
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                    if (!this._marqueeActive) return;
                    const cur = (() => {
                        try {
                            if (canvas.canvasCoordinatesFromClient) return canvas.canvasCoordinatesFromClient({ x: ev.clientX, y: ev.clientY });
                        } catch { return null; }
                    })();
                    if (cur) {
                        const x = Math.min(this._marqueeStartWorld.x, cur.x);
                        const y = Math.min(this._marqueeStartWorld.y, cur.y);
                        const w = Math.abs(cur.x - this._marqueeStartWorld.x);
                        const h = Math.abs(cur.y - this._marqueeStartWorld.y);
                        if (w > 10 && h > 10) {
                            const additive = ev.ctrlKey || ev.metaKey || ev.shiftKey;
                            this.selectInside({ x, y, width: w, height: h }, { append: additive });
                        } else if (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
                            this.clearSelection();
                        }
                    }
                    this._marqueeActive = false;
                    this._marqueeStartWorld = null;
                    this._drawSelectionRect(null);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp, { once: true });
            };

            canvas.app.view.addEventListener("pointerdown", onPointerDown, true);
            document.addEventListener("pointerdown", (e) => {

                if (e.button !== 0) return;
                if (e.ctrlKey || e.shiftKey || e.metaKey) return;
                if (!this._isSelectionToolActive()) return;
                const world = (() => {
                    try { return canvas.canvasCoordinatesFromClient({ x: e.clientX, y: e.clientY }); } catch { return null; }
                })();
                if (!world) return;
                const hit = (() => {
                    for (const w of this.widgets.values()) {
                        const d = w._getDimensions();
                        if (new PIXI.Rectangle(w.x - d.w/2, w.y - d.h/2, d.w, d.h).contains(world.x, world.y)) return true;
                    }
                    for (const p of (canvas.tokens?.placeables || [])) {
                        const b = p.bounds;
                        if (b && b.contains(world.x, world.y)) return true;
                    }
                    return false;
                })();
                if (!hit) {
                    const isOnCanvas = e.target === canvas.app.view || e.target.closest?.("#board") || (canvas.app.view && canvas.app.view.contains(e.target));
                    if (isOnCanvas) {

                        setTimeout(() => {
                            if (!this._marqueeActive) this.clearSelection();
                        }, 150);
                    }
                }
            }, true);

            window.addEventListener("keydown", (e) => {
                if ((e.key === "Delete" || e.key === "Backspace") && this.selectedIds.size > 0 && !e.target.matches?.("input, textarea, select")) {
                    e.preventDefault();
                    this.deleteSelected();
                }
                if (e.key === "Escape" && this.selectedIds.size > 0) {
                    this.clearSelection();
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && document.activeElement?.tagName !== "INPUT") {

                    e.preventDefault();
                    for (const w of this.widgets.values()) {
                        const p = w.placement;
                        if (p.sceneId === canvas.scene?.id) this.selectedIds.add(p.id);
                    }
                    this._updateSelectionVisuals();
                }
            });
        }

        if (!this._lastRightDown) {
            this._lastRightDown = null;
            canvas.app.view.addEventListener("pointerdown", (e) => {
                if (e.button === 2) this._lastRightDown = { x: e.clientX, y: e.clientY, time: Date.now() };
            }, true);
            document.addEventListener("pointerdown", (e) => {
                if (e.button === 2) this._lastRightDown = { x: e.clientX, y: e.clientY, time: Date.now() };
            }, true);
        }

        if (!this._domContextMenuHandler) {
            this._domContextMenuHandler = (e) => {
                if (!canvas.ready) return;
                if (e.button !== 2) return;

                if (this._lastRightDown) {
                    const dx = e.clientX - this._lastRightDown.x;
                    const dy = e.clientY - this._lastRightDown.y;
                    const dt = Date.now() - this._lastRightDown.time;
                    if (Math.hypot(dx, dy) > 10) return;
                    if (dt > 500) return;
                }
                if (this._dragging || this._resizing) return;
                const pos = (() => {
                    try {
                        if (canvas.canvasCoordinatesFromClient) {
                            const p = canvas.canvasCoordinatesFromClient({ x: e.clientX, y: e.clientY });
                            if (p) return p;
                        }
                    } catch {}
                    return null;
                })();
                if (!pos) return;

                for (const w of this.widgets.values()) {
                    try {
                        const dims = w._getDimensions();
                        const bounds = new PIXI.Rectangle(w.x - dims.w/2, w.y - dims.h/2, dims.w, dims.h);
                        if (bounds.contains(pos.x, pos.y)) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation?.();
                            console.log("FateX Extras | DOM contextmenu hit widget", { id: w.placementId, source: w.placement?.source, aspect: w.aspect?.name });
                            const fakeEvent = {
                                stopPropagation: () => {},
                                preventDefault: () => {},
                                clientX: e.clientX,
                                clientY: e.clientY,
                                global: { x: e.clientX, y: e.clientY },
                                data: { button: 2 },
                                button: 2
                            };

                            if (typeof globalThis._showWidgetContextMenu === "function") {
                                globalThis._showWidgetContextMenu(w, fakeEvent);
                            } else {
                                w._onRightClick(fakeEvent);
                            }
                            return;
                        }
                    } catch (err) { console.warn("FateX Extras | hit test failed", err); }
                }

                for (const w of this.domWidgets.values()) {

                    try {
                        const rect = w.element.getBoundingClientRect();
                        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (typeof globalThis._showWidgetContextMenu === "function") {
                                globalThis._showWidgetContextMenu(w, { clientX: e.clientX, clientY: e.clientY, stopPropagation:()=>{}, preventDefault:()=>{} });
                            }
                            return;
                        }
                    } catch {}
                }

                if (e.target?.closest?.(".fatex-manager-widget, .fatex-context-menu, .window-app")) return;
                e.preventDefault();
            };
            canvas.app.view.addEventListener("contextmenu", this._domContextMenuHandler, true);

            document.addEventListener("contextmenu", this._domContextMenuHandler, true);
        }
        console.log("FateX Extras | AspectWidgetsLayer _draw", { scene: canvas.scene?.id, dimensions: canvas.dimensions?.rect });
        await this.refreshWidgets();
    }

    _activate() {

        this.eventMode = "passive";
        this.interactiveChildren = true;
    }

    _deactivate() {

        this.eventMode = "passive";
        this.interactiveChildren = true;
        this.hitArea = null;
    }

    _ensureManagerContainer() {
        if (this._managerContainer && this._managerContainer.isConnected) return;
        this._managerContainer = document.createElement("div");
        this._managerContainer.id = "fatex-manager-widgets";



        this._managerContainer.style.cssText = "position:fixed; inset:0; pointer-events:none; z-index:5;";
        document.body.appendChild(this._managerContainer);
        if (!this._managerPanHook) {
            this._managerPanHook = true;
            Hooks.on("canvasPan", () => this._updateManagerPositions());
        }
        for (const mw of this.managerWidgets.values()) {
            if (mw.element?.parentElement !== this._managerContainer) {
                this._managerContainer.appendChild(mw.element);
            }
        }
    }

    _updateManagerPositions() {
        for (const mw of this.managerWidgets.values()) {
            mw._updatePosition();
        }
    }

    _updateDomPositions() {
        for (const w of this.domWidgets.values()) {
            w._updatePosition();
        }
    }

    async _tearDown(options) {
        for (const w of this.widgets.values()) w.destroy({ children: true });
        this.widgets.clear();
        for (const w of this.domWidgets.values()) w.destroy();
        this.domWidgets.clear();
        for (const mw of this.managerWidgets.values()) mw.destroy();
        this.managerWidgets.clear();
        if (this._domContainer) {
            this._domContainer.remove();
            this._domContainer = null;
        }
        if (this._managerContainer) {
            this._managerContainer.remove();
            this._managerContainer = null;
        }
        await super._tearDown(options);
    }

    async refreshWidgets() {
        if (!canvas.ready) {
            console.log("FateX Extras | refreshWidgets skipped: canvas not ready");
            return;
        }
        const sceneId = canvas.scene?.id;
        if (!sceneId) {
            console.log("FateX Extras | refreshWidgets skipped: no sceneId");
            return;
        }
        const storage = await AspectStorage.getStorage();
        if (!storage) {
            console.log("FateX Extras | refreshWidgets skipped: no storage");
            return;
        }
        const aspects = storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || [];
        const tags = storage.getFlag("fatex-extras", AspectStorage.FLAGS.TAGS) || [];
        const placements = storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || [];
        const scenePlacements = placements.filter(p => p.sceneId === sceneId);
        console.log(`FateX Extras | refreshWidgets: ${placements.length} total, ${scenePlacements.length} for scene ${sceneId}, ${this.widgets.size} existing widgets`);


        for (const [id, w] of this.widgets.entries()) {
            if (!scenePlacements.some(p => p.id === id)) {
                try { w.destroy({ children: true }); } catch {}
                this.widgets.delete(id);
            }
        }
        for (const [id, mw] of this.managerWidgets.entries()) {
            if (!scenePlacements.some(p => p.id === id)) {
                mw.destroy();
                this.managerWidgets.delete(id);
            }
        }
        for (const placement of scenePlacements) {
            if (placement.source === "manager") {
                this._ensureManagerContainer();
                let mw = this.managerWidgets.get(placement.id);
                if (mw) {
                    if (mw.placement?.x !== placement.x || mw.placement?.y !== placement.y ||
                        mw.placement?.width !== placement.width || mw.placement?.height !== placement.height) {
                        mw.placement = placement;
                        if (mw.element) {
                            if (placement.width) mw.element.style.width = `${placement.width}px`;
                            if (placement.height) mw.element.style.height = `${placement.height}px`;
                        }
                        mw._updatePosition();
                    }
                    await mw.refresh();
                } else {
                    mw = new ManagerCanvasWidget(placement);
                    this.managerWidgets.set(placement.id, mw);
                    this._managerContainer.appendChild(mw.element);
                    mw._updatePosition();
                }
                continue;
            }
            let aspect = null;
            let aspectTags = [];
            let displayColor = placement.color || null;
            if (placement.source === "character") {

                const actor = placement.actorId ? game.actors.get(placement.actorId) : null;
                const item = actor?.items.get(placement.itemId) || (placement.itemId ? game.items.get(placement.itemId) : null);
                const liveName = item?.system?.value ? _stripHtml(item.system.value) : item?.name;
                const name = (liveName || placement.name || "Aspect").trim().substring(0,120);
                const isConsequence = placement.isConsequence ?? (item?.type === "consequence");
                const freeInvokes = item?.getFlag?.("fatex-extras", "freeInvokes") ?? 0;
                aspect = {
                    id: placement.id,
                    name,
                    color: placement.color || (isConsequence ? "#b83636" : "#6b7280"),
                    tagIds: [],
                    invokes: freeInvokes,
                    hostileInvokes: 0,
                    hidden: false
                };

                if (placement.name !== name) placement.name = name;
                displayColor = aspect.color;
            } else {
                aspect = aspects.find(a => a.id === placement.aspectId);
                if (!aspect) {
                    const w = this.widgets.get(placement.id);
                    if (w) { w.destroy({ children: true }); this.widgets.delete(placement.id); }
                    continue;
                }
                if (aspect.hidden && !game.user.isGM) {
                    const w = this.widgets.get(placement.id);
                    if (w) { w.destroy({ children: true }); this.widgets.delete(placement.id); }
                    continue;
                }
                aspectTags = (aspect.tagIds || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean);
                displayColor = aspect.color;
            }
            let widget = this.widgets.get(placement.id);
            if (widget) {
                widget.placement = placement;
                widget.x = placement.x;
                widget.y = placement.y;
                if (placement.source === "character") widget._colorOverride = displayColor;
                widget.refresh(aspect, aspectTags);
            } else {
                widget = new AspectWidget(placement, aspect, aspectTags);
                if (placement.source === "character") widget._colorOverride = displayColor;
                this.widgets.set(placement.id, widget);
                this.addChild(widget);
            }
            widget.visible = true;
            const isHidden = placement.source === "character" ? false : aspect.hidden;
            widget.alpha = isHidden ? 0.45 : 1;
        }
        this.sortChildren();

        for (const [id, w] of this.domWidgets.entries()) {
            try { w.destroy(); } catch {}
            this.domWidgets.delete(id);
        }
    }

    async createPlacement(aspectId, x, y) {
        const task = async () => {
            const storage = await AspectStorage.getStorage();
            if (!storage) return null;
            const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
            const placement = { id: foundry.utils.randomID(), aspectId, sceneId: canvas.scene.id, x, y };
            placements.push(placement);
            await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
            game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
            await this.refreshWidgets();
            return placement;
        };
        this._createLock = this._createLock.then(task, task);
        return this._createLock;
    }

    async createPlacementFromCharacter(name, color, isConsequence, actorId, itemId, x, y) {
        const task = async () => {
            const storage = await AspectStorage.getStorage();
            if (!storage) return null;
            const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
            const placement = { id: foundry.utils.randomID(), sceneId: canvas.scene.id, x, y, source: "character", name, color: color || (isConsequence ? "#b83636" : "#6b7280"), isConsequence: !!isConsequence, actorId: actorId || null, itemId: itemId || null };
            placements.push(placement);
            await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
            game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
            await this.refreshWidgets();
            return placement;
        };
        this._createLock = this._createLock.then(task, task);
        return this._createLock;
    }

    async createManagerPlacement(x, y) {
        const task = async () => {
            const storage = await AspectStorage.getStorage();
            if (!storage) return null;
            const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);

            const scenePlacements = placements.filter(p => p.sceneId === canvas.scene.id);
            const existing = scenePlacements.find(p => p.source === "manager");
            if (existing) {
                ui.notifications.info(game.i18n.localize("FAx.Manager.AlreadyPlaced") || "Aspect manager is already placed on this scene");
                return existing;
            }
            const cx = x ?? canvas.dimensions?.sceneRect?.center?.x ?? 0;
            const cy = y ?? canvas.dimensions?.sceneRect?.center?.y ?? 0;
            const placement = { id: foundry.utils.randomID(), sceneId: canvas.scene.id, x: cx, y: cy, source: "manager", width: 540, height: 640 };
            placements.push(placement);
            await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
            game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
            await this.refreshWidgets();
            return placement;
        };
        this._createLock = this._createLock.then(task, task);
        return this._createLock;
    }

    async deletePlacement(placementId) {
        const storage = await AspectStorage.getStorage();
        if (!storage) return;
        let placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
        placements = placements.filter(p => p.id !== placementId);
        await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
        game.socket.emit("module.fatex-extras", { action: "REFRESH_WIDGETS" });
        await this.refreshWidgets();
    }


    _showWidgetContextMenu(widget, event) {
        const evt = event;

        if (typeof globalThis._showAspectContextMenuForWidget === "function") {
            globalThis._showAspectContextMenuForWidget(widget, evt);
            return;
        }

        this._fallbackContextMenu(widget, evt);
    }

    _fallbackContextMenu(widget, event) {
        const aspectId = widget.aspectId;
        const placementId = widget.placementId;

        document.querySelectorAll(".fatex-context-menu").forEach(m => m.remove());
        const menu = document.createElement("div");
        menu.className = "fatex-context-menu";
        const clientX = event.clientX ?? event.global?.x ?? 0;
        const clientY = event.clientY ?? event.global?.y ?? 0;
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;
        const mkItem = (icon, label, action) => {
            const el = document.createElement("div");
            el.className = "fatex-context-menu__item";
            el.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
            el.addEventListener("click", async () => {
                document.querySelectorAll(".fatex-context-menu").forEach(m => m.remove());
                try { await action(); } catch(e){ console.error(e); }
            });
            return el;
        };
        const mod = async (field, delta) => {
            const storage = await AspectStorage.getStorage();
            const aspects = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
            const a = aspects.find(x => x.id === aspectId);
            if (!a) return;
            a[field] = Math.max(0, (a[field]||0)+delta);
            await storage.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, aspects);
        };
        menu.appendChild(mkItem("fa-plus", game.i18n.localize("FAx.ContextMenu.IncreaseInvokes"), () => mod("invokes", 1)));
        menu.appendChild(mkItem("fa-minus", game.i18n.localize("FAx.ContextMenu.DecreaseInvokes"), () => mod("invokes", -1)));
        if (game.user.isGM) {
            menu.appendChild(mkItem("fa-plus", game.i18n.localize("FAx.ContextMenu.IncreaseHostile"), () => mod("hostileInvokes", 1)));
            menu.appendChild(mkItem("fa-minus", game.i18n.localize("FAx.ContextMenu.DecreaseHostile"), () => mod("hostileInvokes", -1)));
        }
        menu.appendChild(mkItem("fa-book-open", game.i18n.localize("FAx.ContextMenu.OpenInManager"), () => {
            import("../apps/scene-aspects.js").then(({SceneAspectsApp}) => new SceneAspectsApp({focusAspectId: aspectId}).render(true));
        }));
        if (game.user.isGM) {
            menu.appendChild(mkItem("fa-trash", game.i18n.localize("FAx.ContextMenu.DeleteDrawing"), async () => {
                await this.deletePlacement(placementId);
            }));
        }
        document.body.appendChild(menu);
        const cleanup = (e) => {
            if (!e.target.closest?.(".fatex-context-menu")) {
                document.querySelectorAll(".fatex-context-menu").forEach(m => m.remove());
                document.removeEventListener("click", cleanup);
                document.removeEventListener("keydown", onEsc);
            }
        };
        const onEsc = (e) => { if (e.key==="Escape") { document.querySelectorAll(".fatex-context-menu").forEach(m=>m.remove()); document.removeEventListener("click", cleanup); document.removeEventListener("keydown", onEsc);} };
        setTimeout(()=> { document.addEventListener("click", cleanup); document.addEventListener("keydown", onEsc); }, 50);
    }
}
