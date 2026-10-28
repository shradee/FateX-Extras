import { SceneAspectsApp, applyAspectInvokeValue } from "./apps/scene-aspects.js";
import { RollModifiers } from "./features/roll-modifiers.js";
import { AspectStorage } from "./helpers/aspect-storage.js";
import { AspectWidgetsLayer } from "./canvas/aspect-widget-layer.mjs";

const MODULE_ID = "fatex-extras";
const SOCKET_NAME = `module.${MODULE_ID}`;

window.__fatexDragActive = false;
document.addEventListener("dragstart", () => { window.__fatexDragActive = true; }, true);
document.addEventListener("drop", () => { window.__fatexDragActive = false; }, true);
document.addEventListener("dragend", () => {
    window.__fatexDragActive = false;
    document.querySelectorAll(".fatex-scene-aspect, .fatex-aspect-group, .aspect-tag-pill").forEach(el => {
        el.classList.remove("drag-left", "drag-right", "drag-top", "drag-bottom");
    });
}, true);

function openAspectManager() {
    const existing = Object.values(ui.windows).find(w => w instanceof SceneAspectsApp);
    if (existing) existing.render(true);
    else new SceneAspectsApp().render(true);
}
globalThis.openAspectManager = openAspectManager;
globalThis._openAspectManagerGlobal = (aspectId) => {
    if (typeof globalThis.showSceneAspectInManager === "function") globalThis.showSceneAspectInManager(aspectId);
};

Hooks.on("getSceneControlButtons", (controls) => {
    const aspectButtonTool = {
        name: "scene-aspects",
        title: game.i18n.localize("FAx.Global.ManageAspects"),
        icon: "fas fa-book-open",
        visible: true,
        button: true,
        onChange: (event, active) => {
            if (active) openAspectManager();
        }
    };

    const findControlGroup = (name) => {
        if (!controls) return null;
        if (Array.isArray(controls)) return controls.find(c => c.name === name);
        if (controls instanceof Map) return controls.get(name) || Array.from(controls.values()).find(c => c.name === name);
        if (typeof controls === "object") {
            if (Array.isArray(controls.controls)) return controls.controls.find(c => c.name === name);
            return controls[name] || Object.values(controls).find(c => c.name === name);
        }
        return null;
    };

    const setTool = (group, tool) => {
        if (!group) return;
        if (!group.tools) group.tools = {};
        if (Array.isArray(group.tools)) {
            if (!group.tools.find(t => t.name === tool.name)) group.tools.push({ ...tool });
        } else if (group.tools instanceof Map) {
            if (!group.tools.has(tool.name)) group.tools.set(tool.name, { ...tool });
        } else if (typeof group.tools === "object") {
            if (!group.tools[tool.name]) group.tools[tool.name] = { ...tool };
        } else {
            console.warn("FateX Extras | Expected group.tools to be an array, Map or object but got:", typeof group.tools, group.tools);
        }
    };


    const tokenGroup = findControlGroup("tokens");
    if (tokenGroup) {
        const tokenTool = { ...aspectButtonTool, name: "scene-aspects-token", title: game.i18n.localize("FAx.Global.ManageAspects") };
        setTool(tokenGroup, tokenTool);
        if (!tokenGroup.activeTool) tokenGroup.activeTool = tokenGroup.activeTool || "select";
    }

    const oldGroup = findControlGroup("aspects");
    if (oldGroup?.tools) {
        if (oldGroup.tools instanceof Map) oldGroup.tools.delete("scene-aspects");
        else if (Array.isArray(oldGroup.tools)) {
            const idx = oldGroup.tools.findIndex(t => t.name === "scene-aspects");
            if (idx !== -1) oldGroup.tools.splice(idx, 1);
        } else if (typeof oldGroup.tools === "object") {
            delete oldGroup.tools["scene-aspects"];
        }

        const hasTools = oldGroup.tools instanceof Map ? oldGroup.tools.size > 0 : Array.isArray(oldGroup.tools) ? oldGroup.tools.length > 0 : Object.keys(oldGroup.tools).length > 0;
        if (!hasTools) oldGroup.visible = false;
    }
});

document.addEventListener("click", (event) => {
    const el = event.target.closest?.('#scene-controls [data-tool="scene-aspects-token"]');
    if (!el) return;
    openAspectManager();
});

Hooks.once("setup", () => {
    game.keybindings.register("fatex-extras", "openSceneAspects", {
        name: "FAx.Keybindings.OpenSceneAspects",
        hint: "FAx.Keybindings.OpenSceneAspectsHint",
        editable: [{ key: "KeyA" }],
        onDown: () => {
            const existing = Object.values(ui.windows).find(w => w instanceof SceneAspectsApp);
            if (existing) existing.close();
            else new SceneAspectsApp().render(true);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
});

Hooks.once("diceSoNiceReady", (dice3d) => {
    dice3d.addSystem({ id: "fatex-extras", name: game.i18n.localize("FAx.Dice.SystemName") }, "default");
    dice3d.addDicePreset({
        type: "dc",
        labels: ["", ""],
        modelFile: "modules/fatex-extras/assets/dc_die.glb",
        system: "fatex-extras"
    });
});

Hooks.once("init", () => {
    try {
        CONFIG.Canvas.layers.aspects = {
            layerClass: AspectWidgetsLayer,
            group: "interface"
        };
    } catch (e) {
        console.warn("FateX Extras | Failed to register aspects canvas layer", e);
    }
    game.settings.register("fatex-extras", "darkMode", {
        name: game.i18n.localize("FAx.Settings.DarkMode"),
        hint: game.i18n.localize("FAx.Settings.DarkModeHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            if (value) document.body.classList.add("fatex-dark-mode");
            else document.body.classList.remove("fatex-dark-mode");
        }
    });

    game.settings.register("fatex-extras", "sceneDrawingFont", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingFont"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingFontHint"),
        scope: "world",
        config: true,
        type: String,
        default: "Signika",
        choices: {
            "Signika": "Signika",
            "Roboto": "Roboto",
            "Roboto Condensed": "Roboto Condensed",
            "Arial": "Arial",
            "Georgia": "Georgia",
            "Times New Roman": "Times New Roman"
        }
    });

    game.settings.register("fatex-extras", "sceneDrawingBgAlpha", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingBgAlpha"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingBgAlphaHint"),
        scope: "world",
        config: true,
        type: Number,
        default: 1,
        range: { min: 0, max: 1, step: 0.1 }
    });

    game.settings.register("fatex-extras", "sceneDrawingShowTags", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingShowTags"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingShowTagsHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("fatex-extras", "sceneDrawingShowHostile", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingShowHostile"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingShowHostileHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("fatex-extras", "sceneDrawingShowInvokes", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingShowInvokes"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingShowInvokesHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("fatex-extras", "sceneDrawingCompactInvokes", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingCompactInvokes"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingCompactInvokesHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("fatex-extras", "sceneDrawingStrokeColor", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingStrokeColor"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingStrokeColorHint"),
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ nullable: false }),
        default: "#ffffff"
    });

    game.settings.register("fatex-extras", "sceneDrawingStrokeAlpha", {
        name: game.i18n.localize("FAx.Settings.SceneDrawingStrokeAlpha"),
        hint: game.i18n.localize("FAx.Settings.SceneDrawingStrokeAlphaHint"),
        scope: "world",
        config: true,
        type: Number,
        default: 0.3,
        range: { min: 0, max: 1, step: 0.1 }
    });

    game.settings.register("fatex-extras", "koFiDismissed", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register("fatex-extras", "showKoFiMessage", {
        name: game.i18n.localize("FAx.KoFi.ShowMessage"),
        hint: game.i18n.localize("FAx.KoFi.ShowMessageHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    RollModifiers.init();


    const APPEARANCE_SETTINGS = new Set([
        "sceneDrawingFont",
        "sceneDrawingBgAlpha",
        "sceneDrawingShowTags",
        "sceneDrawingShowHostile",
        "sceneDrawingShowInvokes",
        "sceneDrawingCompactInvokes",
        "sceneDrawingStrokeColor",
        "sceneDrawingStrokeAlpha"
    ]);
    Hooks.on("updateSetting", (setting, changed) => {
        if (setting.namespace !== "fatex-extras" || !APPEARANCE_SETTINGS.has(setting.key)) return;
        canvas.aspects?.refreshWidgets?.();

        _resyncAllAspectDrawings();
    });
});

function _onDocumentDragOver(event) {
    try {
        const raw = event.dataTransfer.getData("text/plain") || "{}";
        const data = JSON.parse(raw);
        if (data.type === "SceneAspect" || data.type === "CharacterAspect") {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            return;
        }
        if (data.type === "PlaceAspectManager") {
            if (!game.user.isGM) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            return;
        }

        if (data.type === "Item") {
            const uuid = data.uuid || "";

            if (uuid.includes("Item.") || data.data?.type === "aspect" || data.data?.type === "consequence") {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            }
        }
    } catch (e) {}
}

async function _resolveCharacterItemFromDropData(data) {
    try {
        if (data.type === "CharacterAspect" && data.actorId && data.itemId) {
            const actor = game.actors.get(data.actorId);
            const item = actor?.items.get(data.itemId);
            if (item && (item.type === "aspect" || item.type === "consequence")) return item;
        }
        if (data.type === "Item") {
            let doc = null;
            if (data.uuid) {
                try { doc = await fromUuid(data.uuid); } catch {}
            }
            if (!doc && data.data?._id) {

                const actor = data.data?.actorId ? game.actors.get(data.data.actorId) : null;
                doc = actor?.items.get(data.data._id) || game.items.get(data.data._id);
            }
            if (doc && (doc.documentName === "Item" || doc.type === "aspect" || doc.type === "consequence")) {
                const item = doc.documentName === "Item" ? doc : null;
                if (item && (item.type === "aspect" || item.type === "consequence")) return item;
            }

            if (data.data?.type === "aspect" || data.data?.type === "consequence") {
                return { type: data.data.type, name: data.data.name || data.data.label, system: data.data.system, id: data.data._id || foundry.utils.randomID(), parent: { id: data.actorId || null } };
            }
        }
    } catch {}
    return null;
}

async function _onDocumentDrop(event) {
    try {

        let raw = event.dataTransfer.getData("text/plain") || "";
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
        if (!data.type) {
            try {
                const alt = event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/x-item") || "{}";
                const altData = JSON.parse(alt);
                if (altData.type) { data = altData; raw = alt; }
            } catch {}
        }

        if (!data.type && event.dataTransfer.types?.includes("text/plain")) {
            try {
                const txt = event.dataTransfer.getData("text/plain");
                if (txt && txt.includes("Item")) {
                    data = { type: "Item", uuid: txt };
                }
            } catch {}
        }
        const isSceneAspect = data.type === "SceneAspect";
        const isCharacterDrag = data.type === "CharacterAspect" || data.type === "Item";
        const isManagerPin = data.type === "PlaceAspectManager";
        if (!isSceneAspect && !isCharacterDrag && !isManagerPin) {

            console.log("FateX Extras | Drop ignored, data:", data, "types:", [...(event.dataTransfer.types||[])]);
            return;
        }

        if (!canvas?.ready || !game.scenes.active) {
            console.warn("FateX Extras | Drop ignored: canvas not ready");
            return;
        }

        const coords = _clientToCanvas(event.clientX, event.clientY);
        if (!coords) {
            console.warn("FateX Extras | Drop ignored: could not get canvas coords", event.clientX, event.clientY);
            return;
        }
        const dropTarget = event.target;

        if (dropTarget.closest?.(".fatex-scene-aspects") || dropTarget.closest?.("#fatex-scene-aspects") || dropTarget.closest?.(".fatex-desk")) {
            console.log("FateX Extras | Drop inside manager, ignoring canvas drop");
            return;
        }

        if (dropTarget.closest?.(".window-app.fatex-extras-app") || document.querySelector("#fatex-scene-aspects")?.contains(dropTarget)) {
            return;
        }
        const isOnCanvas = dropTarget === canvas.app.view ||
                          dropTarget.closest?.('#board') ||
                          dropTarget.classList?.contains('board') ||
                          (canvas.app.view && canvas.app.view.contains(dropTarget));
        console.log("FateX Extras | Drop detected", {type: data.type, coords, isOnCanvas, dropTarget: dropTarget?.id || dropTarget?.tagName});
        if (!isOnCanvas) return;

        if (isManagerPin) {
            if (!game.user.isGM) return;
            if (canvas.aspects?.createManagerPlacement) {
                await canvas.aspects.createManagerPlacement(coords.x, coords.y);
                event.preventDefault?.();
                event.stopPropagation?.();
            }
            return;
        }

        if (isSceneAspect) {
            const storage = await AspectStorage.getStorage();
            if (!storage) return;
            const aspects = storage.getFlag("fatex-extras", "sceneAspects") || [];
            const aspect = aspects.find(a => a.id === data.id);
            if (!aspect) return;
            if (canvas.aspects?.createPlacement) {
                await canvas.aspects.createPlacement(aspect.id, coords.x, coords.y);
            } else {
                const { mainDrawing } = await _createAspectDrawingData(aspect, coords.x, coords.y);
                await game.scenes.active.createEmbeddedDocuments("Drawing", [mainDrawing]);
            }
            ui.notifications.info(game.i18n.format("FAx.Global.AspectAddedToScene", { name: aspect.name }));
            event.preventDefault?.();
            event.stopPropagation?.();
            return;
        }


        let item = await _resolveCharacterItemFromDropData(data);

        if (!item && data.type === "CharacterAspect" && data.actorId && data.itemId) {
            const actor = game.actors.get(data.actorId);
            const fallback = actor?.items.get(data.itemId);
            if (fallback) item = fallback;
            else item = { type: "aspect", name: "Aspect", id: data.itemId, parent: { id: data.actorId }, system: { value: "" } };
        }
        if (!item) {
            console.warn("FateX Extras | Drop: could not resolve character item", data);
            return;
        }
        const isConsequence = item.type === "consequence";
        const displayName = item.system?.value ? _stripHtml(item.system.value) || item.name : item.name;
        const cleanName = (displayName || item.name || "Aspect").trim().substring(0, 120);
        const color = isConsequence ? "#b83636" : "#6b7280";
        const actorId = item.parent?.id || item.actorId || data.actorId || null;
        const itemId = item.id || item._id || data.itemId || null;
        console.log("FateX Extras | Creating character widget", { cleanName, color, isConsequence, actorId, itemId, coords, hasLayer: !!canvas.aspects?.createPlacementFromCharacter });

        if (!game.user.isGM) {
            game.socket.emit(SOCKET_NAME, { action: "CREATE_CHARACTER_PLACEMENT", name: cleanName, color, isConsequence, actorId, itemId, x: coords.x, y: coords.y, sceneId: canvas.scene.id });
            ui.notifications.info(game.i18n.format("FAx.Global.AspectAddedToScene", { name: cleanName }));
            return;
        }
        if (canvas.aspects?.createPlacementFromCharacter) {
            await canvas.aspects.createPlacementFromCharacter(cleanName, color, isConsequence, actorId, itemId, coords.x, coords.y);
            ui.notifications.info(game.i18n.format("FAx.Global.AspectAddedToScene", { name: cleanName }));
        } else {

            const storage = await AspectStorage.getStorage();
            if (!storage) {
                console.warn("FateX Extras | No storage for character widget");
                return;
            }
            const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
            const placement = { id: foundry.utils.randomID(), sceneId: canvas.scene.id, x: coords.x, y: coords.y, source: "character", name: cleanName, color, isConsequence: !!isConsequence, actorId, itemId };
            placements.push(placement);
            await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
            game.socket.emit(SOCKET_NAME, { action: "REFRESH_WIDGETS" });
            await canvas.aspects?.refreshWidgets?.();
            ui.notifications.info(game.i18n.format("FAx.Global.AspectAddedToScene", { name: cleanName }));
        }
    } catch (e) {
        console.error("FateX Extras | Error creating aspect drawing:", e);
    }
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

function _clientToCanvas(clientX, clientY) {
    try {
        if (canvas.canvasCoordinatesFromClient) {
            const point = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
            if (point) return { x: point.x, y: point.y };
        }
        if (canvas.screenToCanvas) {
            const point = canvas.screenToCanvas(clientX, clientY);
            if (point) return { x: point.x, y: point.y };
        }
        const t = canvas.stage.worldTransform;
        return {
            x: (clientX - t.tx) / t.a,
            y: (clientY - t.ty) / t.d
        };
    } catch (e) {
        console.error("FateX Extras | Error converting client coordinates to canvas coordinates:", e);
        return null;
    }
}

async function _createAspectDrawingData(aspect, x, y) {
    const tags = aspect.tagIds || [];
    const storage = await AspectStorage.getStorage();
    const allTags = storage ? storage.getFlag("fatex-extras", "sceneAspectTags") || [] : [];
    const aspectTags = tags.map(tid => allTags.find(t => t.id === tid)).filter(Boolean);

    const showTags = game.settings.get("fatex-extras", "sceneDrawingShowTags") ?? true;
    const showInvokes = game.settings.get("fatex-extras", "sceneDrawingShowInvokes") ?? true;
    const showHostile = game.settings.get("fatex-extras", "sceneDrawingShowHostile") ?? true;
    const compactInvokes = game.settings.get("fatex-extras", "sceneDrawingCompactInvokes") ?? false;

    const tagsText = (showTags && aspectTags.length > 0) ? `[${aspectTags.map(t => t.label).join(' | ')}]` : '';

    let invokesLine = '';
    if (showInvokes || showHostile) {
        if (compactInvokes) {
            if (showInvokes && showHostile) {
                invokesLine = `${"+".repeat(aspect.invokes || 0)} | ${"-".repeat(aspect.hostileInvokes || 0)}`;
            } else if (showInvokes) {
                invokesLine = "+".repeat(aspect.invokes || 0);
            } else {
                invokesLine = "-".repeat(aspect.hostileInvokes || 0);
            }
        } else {
            const invokesLabel = game.i18n.localize("FAx.Global.Invokes");
            const hostileLabel = game.i18n.localize("FAx.Global.HostileInvokes");

            if (showInvokes && showHostile) {
                invokesLine = `${invokesLabel}: ${aspect.invokes || 0} | ${hostileLabel}: ${aspect.hostileInvokes || 0}`;
            } else if (showInvokes) {
                invokesLine = `${invokesLabel}: ${aspect.invokes || 0}`;
            } else {
                invokesLine = `${hostileLabel}: ${aspect.hostileInvokes || 0}`;
            }
        }
    }

    const text = aspect.name + (tagsText ? '\n' + tagsText : '') + (invokesLine ? '\n' + invokesLine : '');

    const width = Math.max(200, Math.max(aspect.name.length, tagsText.length, invokesLine.length) * 10);
    const height = (showTags && aspectTags.length > 0) ? 100 : 70;
    const bgColor = aspect.color || "#4a4a4a";
    const fontSize = Math.min(64, Math.max(10, Math.round(height * 0.18)));
    const fontFamily = game.settings.get("fatex-extras", "sceneDrawingFont") || "Signika";
    const bgAlpha = game.settings.get("fatex-extras", "sceneDrawingBgAlpha") ?? 1;
    const strokeColorSetting = game.settings.get("fatex-extras", "sceneDrawingStrokeColor");
    let strokeColor = "#ffffff";
    if (strokeColorSetting) {
        if (typeof strokeColorSetting === "string") {
            strokeColor = strokeColorSetting;
        } else if (strokeColorSetting.css) {
            strokeColor = strokeColorSetting.css;
        } else if (strokeColorSetting.toString) {
            strokeColor = strokeColorSetting.toString();
        }
    }
    const strokeAlpha = game.settings.get("fatex-extras", "sceneDrawingStrokeAlpha") ?? 0.3;

    const mainDrawing = {
        author: game.user.id,
        type: foundry.data.ShapeData.TYPES.RECTANGLE,
        x: x - width / 2,
        y: y - height / 2,
        shape: {
            type: foundry.data.ShapeData.TYPES.RECTANGLE,
            width: width,
            height: height
        },
        fillType: bgAlpha > 0 ? CONST.DRAWING_FILL_TYPES.SOLID : CONST.DRAWING_FILL_TYPES.NONE,
        fillColor: bgColor,
        fillAlpha: bgAlpha,
        strokeWidth: strokeAlpha > 0 ? 2 : 0,
        strokeColor: strokeColor,
        strokeAlpha: strokeAlpha,
        text: text,
        fontFamily: fontFamily,
        fontSize: fontSize,
        textColor: "#ffffff",
        textAlpha: 1,
        rotation: 0,
        hidden: false,
        locked: false,
        flags: {
            "fatex-extras": {
                isAspectDrawing: true,
                aspectId: aspect.id
            }
        }
    };

    return { mainDrawing };
}

document.addEventListener("dragover", _onDocumentDragOver);
document.addEventListener("drop", _onDocumentDrop);

Hooks.on("updateDrawing", async (drawing, changes, options, userId) => {
    if (!drawing.getFlag("fatex-extras", "isAspectDrawing")) return;

    const newHeight = drawing.shape?.height;

    if (newHeight !== undefined) {
        const fontSize = Math.min(64, Math.max(10, Math.round(newHeight * 0.18)));
        if (drawing.fontSize !== fontSize) await drawing.update({ fontSize: fontSize });
    }
});

async function _aspectDrawingPayloads(aspects) {
    const storage = await AspectStorage.getStorage();
    if (!storage) return new Map();
    const allTags = storage.getFlag("fatex-extras", "sceneAspectTags") || [];
    const showTags = game.settings.get("fatex-extras", "sceneDrawingShowTags") ?? true;
    const showInvokes = game.settings.get("fatex-extras", "sceneDrawingShowInvokes") ?? true;
    const showHostile = game.settings.get("fatex-extras", "sceneDrawingShowHostile") ?? true;
    const compactInvokes = game.settings.get("fatex-extras", "sceneDrawingCompactInvokes") ?? false;
    const fontFamily = game.settings.get("fatex-extras", "sceneDrawingFont") || "Signika";
    const map = new Map();
    for (const aspect of aspects) {
        const aspectTags = (aspect.tagIds || []).map(tid => allTags.find(t => t.id === tid)).filter(Boolean);
        const tagsText = (showTags && aspectTags.length > 0) ? `[${aspectTags.map(t => t.label).join(' | ')}]` : '';

        let invokesLine = '';
        if (showInvokes || showHostile) {
            if (compactInvokes) {
                if (showInvokes && showHostile) {
                    invokesLine = `${"+".repeat(aspect.invokes || 0)} | ${"-".repeat(aspect.hostileInvokes || 0)}`;
                } else if (showInvokes) {
                    invokesLine = "+".repeat(aspect.invokes || 0);
                } else {
                    invokesLine = "-".repeat(aspect.hostileInvokes || 0);
                }
            } else {
                const invokesLabel = game.i18n.localize("FAx.Global.Invokes");
                const hostileLabel = game.i18n.localize("FAx.Global.HostileInvokes");

                if (showInvokes && showHostile) {
                    invokesLine = `${invokesLabel}: ${aspect.invokes || 0} | ${hostileLabel}: ${aspect.hostileInvokes || 0}`;
                } else if (showInvokes) {
                    invokesLine = `${invokesLabel}: ${aspect.invokes || 0}`;
                } else {
                    invokesLine = `${hostileLabel}: ${aspect.hostileInvokes || 0}`;
                }
            }
        }
        map.set(aspect.id, {
            text: aspect.name + (tagsText ? '\n' + tagsText : '') + (invokesLine ? '\n' + invokesLine : ''),
            fillColor: aspect.color || "#4a4a4a",
            fontFamily
        });
    }
    return map;
}

function _collectDrawingUpdates(scene, payloads) {
    const updates = [];
    for (const aspectId of payloads.keys()) {
        const payload = payloads.get(aspectId);
        const drawings = scene.drawings.filter(d => d.getFlag("fatex-extras", "isAspectDrawing") && d.getFlag("fatex-extras", "aspectId") === aspectId);
        for (const drawing of drawings) {
            const height = drawing.shape?.height ?? 300;
            const fontSize = Math.min(64, Math.max(10, Math.round(height * 0.18)));
            if (drawing.text === payload.text && drawing.fillColor === payload.fillColor && drawing.fontSize === fontSize && drawing.fontFamily === payload.fontFamily) continue;
            updates.push({ _id: drawing.id, text: payload.text, fillColor: payload.fillColor, fontSize, fontFamily: payload.fontFamily });
        }
    }
    return updates;
}

async function _updateAspectDrawings(aspectId) {
    const scene = game.scenes.active;
    if (!scene || !game.user.isGM) return;
    const storage = await AspectStorage.getStorage();
    if (!storage) return;
    const aspect = (storage.getFlag("fatex-extras", "sceneAspects") || []).find(a => a.id === aspectId);
    if (!aspect) return;
    const payloads = await _aspectDrawingPayloads([aspect]);
    const updates = _collectDrawingUpdates(scene, payloads);
    if (updates.length) await scene.updateEmbeddedDocuments("Drawing", updates);
}

async function _updateSceneAspectDrawings(aspects) {
    const scene = game.scenes.active;
    if (!scene || !game.user.isGM) return;
    const payloads = await _aspectDrawingPayloads(aspects);
    const updates = _collectDrawingUpdates(scene, payloads);
    if (updates.length) await scene.updateEmbeddedDocuments("Drawing", updates);
}

async function _resyncAllAspectDrawings() {
    const scene = game.scenes.active;
    if (!scene || !game.user.isGM) return;
    const storage = await AspectStorage.getStorage();
    if (!storage) return;
    const aspects = storage.getFlag("fatex-extras", "sceneAspects") || [];
    await _updateSceneAspectDrawings(aspects);
}

Hooks.on("preDeleteDrawing", async (drawing, options, userId) => {
});

Hooks.on("canvasReady", () => {
    canvas.aspects?.refreshWidgets?.();
});
Hooks.on("canvasPan", () => {

    canvas.aspects?.sortChildren?.();
});

Hooks.once("ready", async () => {
    _patchDrawingInteractions();
    _patchDrawingToolValidation();

    const scene = game.scenes?.active;
    if (scene) {
        for (const drawing of scene.drawings ?? []) {
            if (drawing.getFlag("fatex-extras", "isAspectDrawing")) {
                drawing.object?.refresh?.({ refreshState: true });
            }
        }
    }
    canvas.aspects?.refreshWidgets?.();
    const FateActor = CONFIG.Actor.documentClass;
    if (FateActor) {
        FateActor.createDialog = async function (data, options = {}) {
            const picker = CONFIG.FateX?.applications?.templatePicker;
            if (picker) {
                if (picker.options && Object.isExtensible(picker.options)) {
                    picker.options.folder = data?.folder;
                }
                return picker.render({ force: true });
            }
        };
    }

    if (game.settings.get("fatex-extras", "darkMode")) {
        document.body.classList.add("fatex-dark-mode");
    }

    await AspectStorage.getStorage();
    await AspectStorage.ensurePlacementsFlag();
    hideAspectJournal();
    canvas.aspects?.refreshWidgets?.();

    const moduleData = game.modules.get("fatex-extras");
    let koFiUrl = "";
    if (moduleData?.authors) {
        const authorsArray = Array.from(moduleData.authors);
        koFiUrl = authorsArray?.[0]?.url || "";
    }
    const koFiDismissed = game.settings.get("fatex-extras", "koFiDismissed");
    const showKoFi = game.settings.get("fatex-extras", "showKoFiMessage") !== false;

    if (game.user.isGM && !koFiDismissed && showKoFi && koFiUrl && koFiUrl.includes("ko-fi")) {
        ChatMessage.create({
            user: game.user.id,
            content: `
                <div style="background: linear-gradient(135deg, #794bc4 0%, #ff5e62 100%); padding: 15px; border-radius: 8px; color: white; font-family: inherit; max-width: 350px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px;">
                        ${game.i18n.localize("FAx.KoFi.SupportMessage")}
                    </p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <a href="${koFiUrl}" target="_blank" style="display: inline-block; background: white; color: #794bc4; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 13px;">
                            Support on Ko-fi
                        </a>
                        <button id="fatex-ko-fi-dismiss" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            Don't show again
                        </button>
                    </div>
                </div>
            `
        });

        Hooks.on("renderChatMessage", (message, html) => {
            const btn = html.find("#fatex-ko-fi-dismiss");
            if (btn.length) {
                btn.on("click", () => {
                    game.settings.set("fatex-extras", "showKoFiMessage", false);
                    message.delete();
                });
            }
        });
    }

    game.socket.on(SOCKET_NAME, async (payload) => {
        if (payload.action === "REFRESH_APPS") {
            refreshApps();
            canvas.aspects?.refreshWidgets?.();
        }
        else if (payload.action === "REFRESH_WIDGETS") {
            canvas.aspects?.refreshWidgets?.();
        }
        else if (payload.action === "CREATE_CHARACTER_PLACEMENT") {
            if (!game.user.isGM) return;
            try {
                const storage = await AspectStorage.getStorage();
                if (!storage) return;
                const placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
                const placement = { id: foundry.utils.randomID(), sceneId: payload.sceneId || canvas.scene?.id, x: payload.x, y: payload.y, source: "character", name: payload.name, color: payload.color, isConsequence: !!payload.isConsequence, actorId: payload.actorId, itemId: payload.itemId };
                placements.push(placement);
                await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
                game.socket.emit(SOCKET_NAME, { action: "REFRESH_WIDGETS" });
                await canvas.aspects?.refreshWidgets?.();
                ui.notifications.info(game.i18n.format("FAx.Global.AspectAddedToScene", { name: payload.name }));
            } catch (e) { console.error("FateX Extras | CREATE_CHARACTER_PLACEMENT failed", e); }
        }
        else if (payload.action === "REFRESH_INVOKES") {
            applyAspectInvokeValue(payload.aspectId, payload.field, payload.value);
        }
        else if (payload.action === "UPDATE_ASPECT_DRAWINGS") {
            await _updateAspectDrawings(payload.aspectId);
            canvas.aspects?.refreshWidgets?.();
        }
        else if (game.user.isGM) {
            if (payload.action === "UPDATE_CHAT_MESSAGE") {
                const msg = game.messages.get(payload.messageId);
                if (msg) await msg.update(payload.updateData);
            } else if (payload.action === "UPDATE_ACTOR") {
                const actor = game.actors.get(payload.actorId);
                if (actor) await actor.update(payload.updateData);
            } else if (payload.action === "UPDATE_ITEM") {
                const actor = game.actors.get(payload.actorId);
                const item = actor?.items.get(payload.itemId);
                if (item) await item.update(payload.updateData);
            } else if (payload.action === "UPDATE_JOURNAL") {
                const journal = game.journal.get(payload.journalId);
                if (journal) await journal.update(payload.updateData);
            }
        }
    });
});

Hooks.on("preDeleteJournalEntry", (doc, options, userId) => {
    if (doc.getFlag("fatex-extras", "isGlobalAspectStorage")) {
        ui.notifications.warn(game.i18n.localize("FAx.Global.CannotDeleteStorage"));
        return false;
    }
});

Hooks.on("updateItem", (item, change, options, userId) => {
    if (options.fromGlobalSync) return;

    if (item.type !== "aspect" && item.type !== "consequence") return;

    const invokesChanged = change.flags?.["fatex-extras"]?.freeInvokes !== undefined;
    const nameChanged = change.name !== undefined;
    const textChanged = change.system?.value !== undefined;

    if (invokesChanged || nameChanged || textChanged) {
         if (userId === game.user.id) {
             AspectStorage.syncItemToGlobal(item);
         }
    }
});

Hooks.on("updateJournalEntry", async (doc, change, options, userId) => {
    if (!doc.getFlag("fatex-extras", "isGlobalAspectStorage")) return;

    refreshApps();

    const needsWidgetRefresh = foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.ASPECTS}`)
        || foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.PLACEMENTS}`)
        || foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.TAGS}`)
        || foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.GROUPS}`);
    if (needsWidgetRefresh) {

        if (game.user.isGM && foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.ASPECTS}`)) {
            const aspects = doc.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || [];
            const placements = doc.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || [];
            const validIds = new Set(aspects.map(a => a.id));
            const filtered = placements.filter(p => p.source === "manager" || !p.aspectId || validIds.has(p.aspectId));
            if (filtered.length !== placements.length) {
                await doc.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, filtered);
            }
        }
        canvas.aspects?.refreshWidgets?.();

        if (game.user.isGM && foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.ASPECTS}`)) {
            const aspects = doc.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || [];
            await _updateSceneAspectDrawings(aspects);
        }
    } else if (game.user.isGM && foundry.utils.hasProperty(change, `flags.fatex-extras.${AspectStorage.FLAGS.ASPECTS}`)) {
        const aspects = doc.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || [];
        await _updateSceneAspectDrawings(aspects);
    }

    const flat = foundry.utils.flattenObject(change);
    const updatesToProcess = new Set();

    for (const key of Object.keys(flat)) {
        if (key.includes("characterInvokes")) {
            const parts = key.split(".");
            const invokesIndex = parts.indexOf("characterInvokes");
            if (invokesIndex !== -1 && parts.length > invokesIndex + 1) {
                const itemId = parts[invokesIndex + 1];
                updatesToProcess.add(itemId);
            }
        }
    }

    if (updatesToProcess.size > 0) {
        const allInvokes = doc.getFlag("fatex-extras", AspectStorage.FLAGS.CHARACTER_INVOKES) || {};

        for (const itemId of updatesToProcess) {
            const data = allInvokes[itemId];
            if (!data) continue;

            const actorId = data.actorId;
            const actor = game.actors.get(actorId);

            if (actor && actor.isOwner) {
                const item = actor.items.get(itemId);
                if (item) {
                    const currentLocal = item.getFlag("fatex-extras", "freeInvokes");
                    if (currentLocal !== data.value) {
                        await item.update({
                            "flags.fatex-extras.freeInvokes": data.value
                        }, { fromGlobalSync: true });
                    }
                }
            }
        }
    }
});

// FateX 1.6 moved sheets to ApplicationV2: "renderActorSheet" no longer fires,
// V2 sheets fire "renderActorSheetV2" with (app, element, context, options).
function onActorSheetRender(fn) {
    Hooks.on("renderActorSheet", fn);
    Hooks.on("renderActorSheetV2", fn);
}

onActorSheetRender((sheet, html, data) => {
    if (sheet.actor.type !== "character") return;
    const $html = $(html);

    if (sheet.actor.isOwner) {
        const wrapper = $html.find(".fatex-header__fate-points-wrapper");
        if (wrapper.length && wrapper.find(".fatex-js-refresh-fatepoints").length === 0) {
            const refreshBtn = $(`<i class="fas fa-sync-alt fatex-js-refresh-fatepoints" title="${game.i18n.localize("FAx.NewSession.Title")}" style="cursor: pointer; margin-left: 10px; font-size: 14px; color: rgba(255,255,255,0.5); align-self: center; pointer-events: all;"></i>`);
            wrapper.append(refreshBtn);
            refreshBtn.hover(
                function() { $(this).css("color", "rgba(255,255,255,1)"); },
                function() { $(this).css("color", "rgba(255,255,255,0.5)"); }
            );
            refreshBtn.click(async (e) => {
                e.preventDefault(); e.stopPropagation();
                new Dialog({
                    title: game.i18n.localize("FAx.NewSession.Title"),
                    content: `<p>${game.i18n.localize("FAx.NewSession.Question")}</p>`,
                    buttons: {
                        yes: {
                            icon: '<i class="fas fa-check"></i>',
                            label: game.i18n.localize("FAx.NewSession.Confirm"),
                            callback: async () => {
                                const actor = sheet.actor;
                                const fp = actor.system.fatepoints;
                                if (fp.current < fp.refresh) {
                                    const diff = fp.refresh - fp.current;
                                    await actor.update({ "system.fatepoints.current": fp.refresh });
                                    if (game.dice3d) {
                                        const dice = Array.from({length: diff}, () => ({ result: 1, resultLabel: 1, type: "dc", vectors: [], options: {} }));
                                        game.dice3d.show({ throws: [{ dice: dice }], formula: `${dice.length}dc` }, game.user, true);
                                    }
                                    ui.notifications.info(game.i18n.format("FAx.NewSession.Success", { name: actor.name }));
                                } else {
                                    ui.notifications.info(game.i18n.format("FAx.NewSession.AlreadyFull", { name: actor.name }));
                                }
                            }
                        },
                        no: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("FAx.NewSession.Cancel") }
                    },
                    default: "yes"
                }).render(true);
            });
        }
    }

    $html.find(".fatex-item, .fatex-js-item").each((i, el) => {
        const itemEl = $(el);
        const itemId = itemEl.attr("data-id") || itemEl.attr("data-item-id");
        if (!itemId) return;

        const item = sheet.actor.items.get(itemId);
        if (!item || (item.type !== "aspect" && item.type !== "consequence")) return;

        itemEl.find(".fatex-extras-item-tools").remove();

        const freeInvokes = item.getFlag("fatex-extras", "freeInvokes") || 0;

        const toolsHtml = `
            <div class="fatex-extras-item-tools" style="position: absolute; right: 0; bottom: 0; height: 16px; z-index: 5; display: flex; align-items: center; gap: 5px; pointer-events: none;">
                <div class="character-invoke-counter" style="background: rgba(0,0,0,0.05); padding: 0 5px; border-radius: 5px; display: flex; align-items: center; gap: 3px; height: 16px; pointer-events: all;">
                    <i class="fas fa-minus fatex-extras-invoke-ctrl" data-action="decrease" data-id="${itemId}" style="cursor: pointer; font-size: 8px;"></i>
                    <span class="invoke-value" style="font-size: 10px; font-weight: bold; min-width: 8px; text-align: center; line-height: 16px;">${freeInvokes}</span>
                    <i class="fas fa-plus fatex-extras-invoke-ctrl" data-action="increase" data-id="${itemId}" style="cursor: pointer; font-size: 8px;"></i>
                </div>
            </div>
        `;

        const relativeContainer = itemEl.find(".fatex-u-pos-relative");
        if (relativeContainer.length) {
            relativeContainer.append(toolsHtml);
            const toolsContainer = relativeContainer.find('.fatex-extras-item-tools');

            let chatIcon = relativeContainer.find('i.fatex-js-item-to-chat');
            if (chatIcon.length === 0) {
                chatIcon = $(`<i class="fatex-js-item-to-chat fatex-actions__icon fatex-actions__icon--no-hide fa fa-comment" data-item="${itemId}" style="pointer-events: all;"></i>`);
            }

            if (chatIcon.length) {
                toolsContainer.prepend(chatIcon);
                chatIcon.css({
                    'position': 'static', 'height': '16px', 'display': 'flex', 'align-items': 'center', 'justify-content': 'center',
                    'margin': '0', 'font-size': '12px', 'opacity': '1', 'pointer-events': 'all'
                });

                chatIcon.off("click").on("click", ev => {
                    ev.preventDefault(); ev.stopPropagation();
                    const title = item.system.label || game.i18n.localize(item.name);
                    const content = `<div class="fatex-sheet fatex-item-card"><header class="fatex-headline fatex-headline--chat"><h3 class="fatex-headline__text">${title}</h3></header><div class="fatex-item-card__content"><div class="fatex-item-card__description">${item.system.value}</div></div></div>`;
                    ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: sheet.actor }), content: content });
                });
            }
        }
    });

    $html.find(".fatex-extras-invoke-ctrl").on("click", async (e) => {
        e.preventDefault(); e.stopPropagation();
        const btn = $(e.currentTarget);
        const itemId = btn.attr("data-id");
        const action = btn.attr("data-action");
        const item = sheet.actor.items.get(itemId);
        if (!item) return;

        const currentInvokes = item.getFlag("fatex-extras", "freeInvokes") || 0;
        let newInvokes = action === "increase" ? currentInvokes + 1 : Math.max(0, currentInvokes - 1);

        if (newInvokes === currentInvokes) return;

        if (game.user.isGM || item.isOwner) {
            await item.setFlag("fatex-extras", "freeInvokes", newInvokes);
        } else {
            game.socket.emit(SOCKET_NAME, {
                action: "UPDATE_ITEM",
                actorId: sheet.actor.id,
                itemId: itemId,
                updateData: { "flags.fatex-extras.freeInvokes": newInvokes }
            });
        }
    });
});

onActorSheetRender((sheet, html, data) => {
    const actor = sheet.actor;
    if (!actor || (actor.type !== "character" && actor.type !== "npc")) return;
    const $html = $(html);
    $html.find(".fatex-js-sortable[data-item-id]").each((_, el) => {
        const $el = $(el);
        if ($el.find(".fatex-drag-scene-handle").length) return;
        const itemId = $el.attr("data-item-id");
        const item = actor.items.get(itemId);
        if (!item || (item.type !== "aspect" && item.type !== "consequence")) return;
        const isConsequence = item.type === "consequence";
        const color = isConsequence ? "#b83636" : "#6b7280";
        const $actions = $el.find(".fatex-actions--item, .fatex-actions");
        const $chatBtn = $el.find("i.fatex-js-item-to-chat");
        const kindClass = isConsequence ? "fatex-drag--consequence" : "fatex-drag--aspect";
        const $handle = $(`<i class="fas fa-share-from-square fatex-drag-scene-handle ${kindClass}" draggable="true" title="Drag to scene"></i>`);
        if ($chatBtn.length) {
            $chatBtn.before($handle);
        } else if ($actions.length) {
            $actions.prepend($handle);
        } else {
            $el.find(".fatex-u-pos-relative").append($handle);
        }
        $el.css("position", "relative");
        $el.attr("draggable", "false");
        $el.find(".fatex-js-aspect-input, .fatex-js-consequence-input").attr("draggable", "false").css("user-select", "text");
        const handleEl = $handle[0];
        handleEl.draggable = true;
        const onDragStart = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            try {
                const payload = JSON.stringify({ type: "CharacterAspect", actorId: actor.id, itemId: item.id });

                try { e.dataTransfer.clearData(); } catch {}
                e.dataTransfer.setData("text/plain", payload);
                try { e.dataTransfer.setData("application/json", payload); } catch {}
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.dropEffect = "copy";

                try {
                    const itemPayload = JSON.stringify({ type: "Item", uuid: item.uuid });

                    try { e.dataTransfer.setData("text/x-item", itemPayload); } catch {}
                } catch {}
                if (e.dataTransfer.setDragImage) {
                    const crt = document.createElement("div");
                    const bg = isConsequence ? "#b83636" : "#6b7280";
                    crt.style.cssText = `position:absolute;top:-1000px;padding:7px 12px;background:${bg};color:white;border-radius:6px;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;`;
                    crt.textContent = (item.system?.value ? _stripHtml(item.system.value).substring(0,40) : item.name) || item.name;
                    document.body.appendChild(crt);
                    e.dataTransfer.setDragImage(crt, 12, 12);
                    setTimeout(() => crt.remove(), 0);
                }
            } catch (err) {
                console.warn("FateX Extras | dragstart failed", err);
            }
        };
        handleEl.addEventListener("dragstart", onDragStart, true);

        $handle.on("dragstart", (ev) => {
            const e = ev.originalEvent || ev;
            if (e.dataTransfer && !e.dataTransfer.getData("text/plain")) {
                try {
                    const payload = JSON.stringify({ type: "CharacterAspect", actorId: actor.id, itemId: item.id });
                    e.dataTransfer.setData("text/plain", payload);
                    e.dataTransfer.effectAllowed = "copy";
                } catch {}
            }
        });
        $handle.on("mousedown", (e) => { e.stopPropagation(); e.stopImmediatePropagation?.(); });

        $handle.on("click", (e) => {
            if (e.detail === 1) {

            }
        });

    });
});


Hooks.on("createItem", (item, options, userId) => {
    if (item.type !== "aspect" && item.type !== "consequence") return;
    canvas.aspects?.refreshWidgets?.();
});
Hooks.on("deleteItem", (item, options, userId) => {
    if (item.type !== "aspect" && item.type !== "consequence") return;
    canvas.aspects?.refreshWidgets?.();
});
Hooks.on("updateItem", (item, change, options, userId) => {
    if (item.type !== "aspect" && item.type !== "consequence") return;
    if (change.name !== undefined || change.system?.value !== undefined || change.flags?.["fatex-extras"]?.freeInvokes !== undefined) {
        canvas.aspects?.refreshWidgets?.();
    }
});



function hideAspectJournal() {
    const journal = game.journal.find(j => j.getFlag("fatex-extras", "isGlobalAspectStorage"));
    if (!journal) return;
    const cssId = "fatex-extras-hide-storage";
    if (!document.getElementById(cssId)) {
        const style = document.createElement("style");
        style.id = cssId;
        style.textContent = `.sidebar-tab.journal-directory [data-document-id="${journal.id}"] { display: none !important; }`;
        document.head.appendChild(style);
    }
}

function refreshApps() {
    Object.values(ui.windows).forEach(w => {
        if (!(w instanceof SceneAspectsApp)) return;


        const $focusedColor = w.element?.find?.("input.aspect-color-trigger:focus");
        if ($focusedColor && $focusedColor.length) return;
        w.render();
    });
}

function _getDrawingPlaceableClass() {
    if (foundry?.canvas?.placeables?.Drawing) return foundry.canvas.placeables.Drawing;
    if (CONFIG?.Canvas?.drawing?.objectClass) return CONFIG.Canvas.drawing.objectClass;
    if (typeof Drawing === "function") return Drawing;
    return null;
}

function _patchDrawingInteractions() {
    const DrawingPlaceable = _getDrawingPlaceableClass();
    if (!DrawingPlaceable) {
        console.warn("FateX Extras | Could not resolve Drawing placeable class, canvas interactions disabled.");
        return;
    }

    const originalOnClickRight = DrawingPlaceable.prototype._onClickRight;
    DrawingPlaceable.prototype._onClickRight = function(event) {
        if (this.document?.getFlag("fatex-extras", "isAspectDrawing")) {
            _showAspectContextMenu(this, event);
            return;
        }
        return originalOnClickRight?.call(this, event);
    };

    const originalOnClickLeft2 = DrawingPlaceable.prototype._onClickLeft2;
    DrawingPlaceable.prototype._onClickLeft2 = function(event) {
        if (this.document?.getFlag("fatex-extras", "isAspectDrawing")) {
            const aspectId = this.document.getFlag("fatex-extras", "aspectId");
            if (aspectId) globalThis.showSceneAspectInManager?.(aspectId);
            return;
        }
        return originalOnClickLeft2?.call(this, event);
    };

    const originalRefreshState = DrawingPlaceable.prototype._refreshState;
    DrawingPlaceable.prototype._refreshState = function(...args) {
        const result = originalRefreshState?.apply(this, args);
        if (this.document?.getFlag("fatex-extras", "isAspectDrawing") && !this.controlled) {
            if (this.eventMode !== "static") {
                this.eventMode = "static";
                foundry.canvas.interaction.MouseInteractionManager?.emulateMoveEvent();
            }
        }
        return result;
    };
}

function _patchDrawingToolValidation() {
    const DrawingLayer = CONFIG?.Canvas?.layers?.drawings?.layerClass;
    const DrawingDoc = CONFIG?.Drawing?.documentClass;
    if (!DrawingLayer?.prototype?._getNewDrawingData || !DrawingDoc?._validateVisibleContent) return;

    const originalGetNewDrawingData = DrawingLayer.prototype._getNewDrawingData;
    DrawingLayer.prototype._getNewDrawingData = function(origin) {
        const data = originalGetNewDrawingData.call(this, origin);
        if (DrawingDoc._validateVisibleContent(data)) return data;

        const shape = data.shape || (data.shape = {});
        const sw = data.strokeWidth || 0;
        if (shape.type === "r" || shape.type === "e") {
            shape.width = Math.max(shape.width || 0, sw + 10);
            shape.height = Math.max(shape.height || 0, sw + 10);
        } else if (shape.type === "c") {
            shape.radius = Math.max(shape.radius || 0, (sw / 2) + 5);
        } else if (shape.type === "p") {
            if (!Array.isArray(shape.points) || shape.points.length < 4) {
                shape.points = [0, 0, 10, 0, 10, 10, 0, 10];
            }
            if (!(shape.width > 0) || !(shape.height > 0)) {
                shape.width = sw + 10;
                shape.height = sw + 10;
            }
        }

        if (!DrawingDoc._validateVisibleContent(data)) {
            data.strokeWidth = Math.max(data.strokeWidth || 0, 2);
            data.strokeAlpha = data.strokeAlpha || 1;
        }
        return data;
    };
}

function _eventClientXY(event) {
    if (typeof event.clientX === "number" && typeof event.clientY === "number") {
        return { x: event.clientX, y: event.clientY };
    }
    const rect = canvas?.app?.view?.getBoundingClientRect() || { left: 0, top: 0 };
    const g = event.global || event.data?.global || { x: 0, y: 0 };
    return { x: rect.left + g.x, y: rect.top + g.y };
}

function _openAspectManager(aspectId) {
    const existing = Object.values(ui.windows).find(w => w instanceof SceneAspectsApp);
    if (existing) existing.close();
    new SceneAspectsApp({ focusAspectId: aspectId }).render(true);
}

function _managerWidgetOnScene() {
    const layer = canvas?.aspects;
    if (!layer?.managerWidgets) return null;
    for (const mw of layer.managerWidgets.values()) {
        if (!mw.placement || mw.placement.sceneId !== canvas.scene?.id) continue;
        return mw;
    }
    return null;
}

globalThis.showSceneAspectInManager = (aspectId, opts = {}) => {
    if (opts.actorId) {
        const actor = game.actors.get(opts.actorId);
        if (actor?.sheet) {
            actor.sheet.render(true);
            return;
        }
    }
    const mw = _managerWidgetOnScene();
    const openWin = Object.values(ui.windows).find(w => w instanceof SceneAspectsApp);
    if (mw) {
        mw.focusAspect?.(aspectId);
        if (openWin) {
            openWin.focusAspectId = aspectId;
            openWin.render(true);
        }
        return;
    }
    _openAspectManager(aspectId);
};

async function _modifySceneAspectInvokes(aspectId, field, delta) {
    const storage = await AspectStorage.getStorage();
    if (!storage) return;
    const aspects = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
    const aspect = aspects.find(a => a.id === aspectId);
    if (!aspect) return;
    aspect[field] = Math.max(0, (aspect[field] || 0) + delta);
    applyAspectInvokeValue(aspectId, field, aspect[field]);
    game.socket.emit(SOCKET_NAME, { action: "REFRESH_INVOKES", aspectId, field, value: aspect[field] });
    if (game.user.isGM || storage.isOwner) {
        await storage.update({ [`flags.fatex-extras.${AspectStorage.FLAGS.ASPECTS}`]: aspects });
    } else {
        game.socket.emit(SOCKET_NAME, {
            action: "UPDATE_JOURNAL",
            journalId: storage.id,
            updateData: { [`flags.fatex-extras.${AspectStorage.FLAGS.ASPECTS}`]: aspects }
        });
    }
}

function _removeAspectContextMenu() {
    document.querySelectorAll(".fatex-context-menu").forEach(menu => menu.remove());
}
globalThis._removeAspectContextMenu = _removeAspectContextMenu;

async function _modifyCharacterWidgetInvokes(widget, delta) {
    const placement = widget.placement;
    if (!placement || placement.source !== "character" || !placement.actorId || !placement.itemId) return;
    const actor = game.actors.get(placement.actorId);
    const item = actor?.items.get(placement.itemId);
    if (!item) return;
    const cur = item.getFlag("fatex-extras", "freeInvokes") || 0;
    const nxt = Math.max(0, cur + delta);
    if (game.user.isGM || item.isOwner) await item.setFlag("fatex-extras", "freeInvokes", nxt);
    else game.socket.emit("module.fatex-extras", { action: "UPDATE_ITEM", actorId: actor.id, itemId: item.id, updateData: { "flags.fatex-extras.freeInvokes": nxt } });
}

function _showWidgetContextMenu(widget, event) {
    console.log("FateX Extras | _showWidgetContextMenu", { aspectId: widget.aspectId, placementId: widget.placementId, source: widget.placement?.source, isCharacter: widget.placement?.source === "character" });
    event.stopPropagation?.();
    event.preventDefault?.();
    _removeAspectContextMenu();
    const aspectId = widget.aspectId || widget.placementId;
    const placementId = widget.placementId;
    const isCharacter = widget.placement?.source === "character";
    if (!aspectId && !isCharacter) {
        console.warn("FateX Extras | _showWidgetContextMenu no aspectId", widget);
        return;
    }
    if (!placementId) {
        console.warn("FateX Extras | _showWidgetContextMenu no placementId", widget);
        return;
    }
    const items = isCharacter ? [
        { icon: "fa-plus", label: game.i18n.localize("FAx.ContextMenu.IncreaseInvokes"), action: () => _modifyCharacterWidgetInvokes(widget, 1) },
        { icon: "fa-minus", label: game.i18n.localize("FAx.ContextMenu.DecreaseInvokes"), action: () => _modifyCharacterWidgetInvokes(widget, -1) }
    ] : [
        { icon: "fa-plus", label: game.i18n.localize("FAx.ContextMenu.IncreaseInvokes"), action: () => _modifySceneAspectInvokes(aspectId, "invokes", 1) },
        { icon: "fa-minus", label: game.i18n.localize("FAx.ContextMenu.DecreaseInvokes"), action: () => _modifySceneAspectInvokes(aspectId, "invokes", -1) }
    ];
    if (game.user.isGM && !isCharacter) {
        items.push(
            { icon: "fa-plus", label: game.i18n.localize("FAx.ContextMenu.IncreaseHostile"), action: () => _modifySceneAspectInvokes(aspectId, "hostileInvokes", 1) },
            { icon: "fa-minus", label: game.i18n.localize("FAx.ContextMenu.DecreaseHostile"), action: () => _modifySceneAspectInvokes(aspectId, "hostileInvokes", -1) }
        );
    }
    const showCharLabel = (() => { try { const v = game.i18n.localize("FAx.Global.ShowCharacter"); return v && !String(v).includes("FAx.") ? v : "Show character"; } catch { return "Show character"; } })();
    items.push(
        { icon: isCharacter ? "fa-user" : "fa-book-open", label: isCharacter ? showCharLabel : game.i18n.localize("FAx.ContextMenu.OpenInManager"), action: () => {
            globalThis.showSceneAspectInManager?.(aspectId, { actorId: isCharacter ? widget.placement.actorId : null });
        } }
    );
    const layer = canvas.aspects;
    const isMulti = layer && layer.selectedIds.size > 1 && layer.isSelected(placementId);
    const canDelete = game.user.isGM || (isCharacter && game.actors.get(widget.placement.actorId)?.isOwner);
    if (canDelete) {
        const delLabel = isMulti ? `${game.i18n.localize("FAx.ContextMenu.DeleteDrawing")} (${layer.selectedIds.size})` : game.i18n.localize("FAx.ContextMenu.DeleteDrawing");
        items.push(
            { icon: "fa-trash", label: delLabel, action: async () => {
                if (isMulti && layer.deleteSelected) await layer.deleteSelected();
                else if (canvas.aspects?.deletePlacement) await canvas.aspects.deletePlacement(placementId);
                else {
                    const storage = await AspectStorage.getStorage();
                    if (!storage) return;
                    let placements = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS) || []);
                    placements = placements.filter(p => p.id !== placementId);
                    await storage.setFlag("fatex-extras", AspectStorage.FLAGS.PLACEMENTS, placements);
                    game.socket.emit(SOCKET_NAME, { action: "REFRESH_WIDGETS" });
                    canvas.aspects?.refreshWidgets?.();
                }
            } }
        );
    }
    if (isMulti) {
        items.unshift(
            { icon: "fa-arrows-alt", label: `Move ${layer.selectedIds.size} selected`, action: async () => {
                ui.notifications.info(`Drag any selected widget to move all ${layer.selectedIds.size} together (Ctrl+click to add).`);
            }}
        );
    }
    const menu = document.createElement("div");
    menu.className = "fatex-context-menu";
    const { x, y } = _eventClientXY(event);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    for (const item of items) {
        const el = document.createElement("div");
        el.className = "fatex-context-menu__item";
        el.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
        el.addEventListener("click", async () => {
            _removeAspectContextMenu();
            try { await item.action(); } catch (err) {
                console.error("FateX Extras | Error executing aspect context menu action:", err);
            }
        });
        menu.appendChild(el);
    }
    document.body.appendChild(menu);
}
globalThis._showWidgetContextMenu = _showWidgetContextMenu;
globalThis._showAspectContextMenuForWidget = _showWidgetContextMenu;
globalThis._modifySceneAspectInvokes = _modifySceneAspectInvokes;

function _showAspectContextMenu(drawing, event) {
    event.stopPropagation?.();
    event.preventDefault?.();
    _removeAspectContextMenu();

    const aspectId = drawing.document.getFlag("fatex-extras", "aspectId");
    if (!aspectId) return;

    const items = [
        { icon: "fa-plus", label: game.i18n.localize("FAx.ContextMenu.IncreaseInvokes"), action: () => _modifySceneAspectInvokes(aspectId, "invokes", 1) },
        { icon: "fa-minus", label: game.i18n.localize("FAx.ContextMenu.DecreaseInvokes"), action: () => _modifySceneAspectInvokes(aspectId, "invokes", -1) }
    ];
    if (game.user.isGM) {
        items.push(
            { icon: "fa-plus", label: game.i18n.localize("FAx.ContextMenu.IncreaseHostile"), action: () => _modifySceneAspectInvokes(aspectId, "hostileInvokes", 1) },
            { icon: "fa-minus", label: game.i18n.localize("FAx.ContextMenu.DecreaseHostile"), action: () => _modifySceneAspectInvokes(aspectId, "hostileInvokes", -1) }
        );
    }
    items.push(
        { icon: "fa-book-open", label: game.i18n.localize("FAx.ContextMenu.OpenInManager"), action: () => globalThis.showSceneAspectInManager?.(aspectId) }
    );
    if (game.user.isGM) {
        items.push(
            { icon: "fa-trash", label: game.i18n.localize("FAx.ContextMenu.DeleteDrawing"), action: () => drawing.document.delete() }
        );
    }

    const menu = document.createElement("div");
    menu.className = "fatex-context-menu";
    const { x, y } = _eventClientXY(event);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    for (const item of items) {
        const el = document.createElement("div");
        el.className = "fatex-context-menu__item";
        el.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
        el.addEventListener("click", async () => {
            _removeAspectContextMenu();
            try { await item.action(); } catch (err) {
                console.error("FateX Extras | Error executing aspect context menu action:", err);
            }
        });
        menu.appendChild(el);
    }
    document.body.appendChild(menu);
}

document.addEventListener("click", (event) => {
    if (!event.target.closest?.(".fatex-context-menu")) _removeAspectContextMenu();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") _removeAspectContextMenu();
});


document.addEventListener("auxclick", async (event) => {
    if (event.button !== 1) return;
    if (!game.user.isGM) return;
    if (!canvas?.ready || !game.scenes.active) return;

    const target = event.target;
    if (target.closest?.(".fatex-context-menu") || target.closest?.(".fatex-manager-widget") || target.closest?.("#ui-top") || target.closest?.("#sidebar") || target.closest?.(".window-app")) return;
    const isOnCanvas = target === canvas.app.view || target.closest?.("#board") || (canvas.app.view && canvas.app.view.contains(target));
    if (!isOnCanvas) return;

    const world = _clientToCanvas(event.clientX, event.clientY);
    if (!world) return;

    const hitWidget = (() => {
        try {
            const layer = canvas.aspects;
            if (!layer) return false;
            for (const w of layer.widgets.values()) {
                const dims = w._getDimensions?.();
                if (!dims) continue;
                const bounds = new PIXI.Rectangle(w.x - dims.w/2, w.y - dims.h/2, dims.w, dims.h);
                if (bounds.contains(world.x, world.y)) return true;
            }
        } catch {}
        return false;
    })();
    if (hitWidget) return;
    event.preventDefault();
    event.stopPropagation();

    let groups = [];
    let allTags = [];
    try {
        const storage = await AspectStorage.getStorage();
        if (storage) {
            groups = storage.getFlag("fatex-extras", AspectStorage.FLAGS.GROUPS) || [];
            allTags = storage.getFlag("fatex-extras", AspectStorage.FLAGS.TAGS) || [];
        }
    } catch {}
    const groupOptions = [`<option value="">${game.i18n.localize("FAx.Global.Uncategorized")}</option>`, ...groups.map(g => `<option value="${g.id}">${foundry.utils.escapeHTML(g.label)}</option>`)].join("");

    const previewId = foundry.utils.randomID();
    const initialAspect = { id: previewId, name: game.i18n.localize("FAx.Global.NewAspect") || "New Aspect", color: "#4a4a4a", tagIds: [], invokes: 0, hostileInvokes: 0, hidden: false };
    try {
        const storageForCreate = await AspectStorage.getStorage();
        if (storageForCreate) {
            const curAspects = foundry.utils.duplicate(storageForCreate.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
            curAspects.push(foundry.utils.duplicate(initialAspect));
            await storageForCreate.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, curAspects);
        }
    } catch (e) { console.error("FateX Extras | Failed to pre-create aspect for mid-click", e); }
    const content = `
        <form class="fatex-desk fatex-scene-aspects" style="padding:8px; background:transparent;">
            <div class="fatex-item fatex-scene-aspect" data-id="${previewId}" style="border-left:6px solid #4a4a4a; margin:0;">
                <input type="color" class="aspect-color-trigger" value="#4a4a4a" data-id="${previewId}" data-field="color" title="${game.i18n.localize('FAx.Global.Color')}" style="position:absolute; top:0; left:-6px; width:6px; height:100%; opacity:0; cursor:pointer; z-index:10; border:none; padding:0; margin:0;" onmousedown="event.stopPropagation()" ondragstart="event.preventDefault(); event.stopPropagation(); return false;" onpointerdown="event.stopPropagation()">
                <div class="fatex-u-pos-relative">
                    <div class="fatex-row-main">
                        <textarea id="fatex-new-aspect-name" class="fatex-text-input aspect-name" placeholder="${game.i18n.localize("FAx.Global.AspectName") || "Aspect Name"}" data-id="${previewId}" data-field="name" rows="1" autofocus>${initialAspect.name}</textarea>
                    </div>
                    <div class="aspect-tags-list" id="fatex-new-tags-list" style="margin:5px 0; min-height:22px;">
                        <button type="button" class="add-tag-to-aspect" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.AddTag')}"><i class="fas fa-plus"></i></button>
                    </div>
                    <div class="fatex-row-details">
                        <div class="aspect-invokes-wrapper">
                            <label class="fatex-text-input__label">${game.i18n.localize("FAx.Global.Invokes")}</label>
                            <div class="invoke-counter">
                                <i class="fas fa-minus invoke-control" data-action="decrease" data-field="invokes" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.DecreaseInvokes')}"></i>
                                <span class="invoke-value">0</span>
                                <i class="fas fa-plus invoke-control" data-action="increase" data-field="invokes" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.IncreaseInvokes')}"></i>
                            </div>
                        </div>
                        <div class="aspect-invokes-wrapper">
                            <label class="fatex-text-input__label">${game.i18n.localize("FAx.Global.HostileInvokes")}</label>
                            <div class="invoke-counter hostile">
                                <i class="fas fa-minus invoke-control" data-action="decrease" data-field="hostileInvokes" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.DecreaseInvokes')}"></i>
                                <span class="invoke-value">0</span>
                                <i class="fas fa-plus invoke-control" data-action="increase" data-field="hostileInvokes" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.IncreaseInvokes')}"></i>
                            </div>
                        </div>
                        <div class="aspect-actions-wrapper">
                            <div class="aspect-item-actions"><i class="fas fa-eye aspect-visibility" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.ToggleVisibility')}"></i> <i class="fas fa-trash aspect-delete" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.Delete')}"></i></div>
                        </div>
                    </div>
                    <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
                        <label style="font-weight:600; font-size:11px; white-space:nowrap;">${game.i18n.localize("FAx.Global.Category") || "Category"}</label>
                        <select id="fatex-new-aspect-group" style="flex:1;">${groupOptions}</select>
                    </div>
                </div>
            </div>
        </form>
    `;
    let _midClickHandled = false;
    const _deletePreCreated = async () => {
        if (_midClickHandled) return;
        _midClickHandled = true;
        try {
            const storage = await AspectStorage.getStorage();
            if (!storage) return;
            const aspects = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
            const filtered = aspects.filter(a => a.id !== previewId);
            if (filtered.length !== aspects.length) await storage.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, filtered);
        } catch {}
    };
    new Dialog({
        title: game.i18n.localize("FAx.Global.CreateAspect") || "Create Aspect",
        content,
        buttons: {
            create: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize("FAx.Global.Create") || "Create",
                callback: async (html) => {
                    _midClickHandled = true;
                    const name = html.find("#fatex-new-aspect-name").val()?.trim() || game.i18n.localize("FAx.Global.NewAspect") || "New Aspect";
                    const groupId = html.find("#fatex-new-aspect-group").val() || "";
                    const color = html.find(".aspect-color-trigger").val() || "#4a4a4a";
                    const tagIds = html.find(".aspect-tag-pill").map((_, el) => $(el).data("tag-id")).get().filter(Boolean);

                    try {
                        const storage = await AspectStorage.getStorage();
                        if (storage) {
                            const aspects = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                            const asp = aspects.find(a => a.id === previewId);
                            if (asp) {
                                asp.name = name;
                                asp.color = color;
                                asp.tagIds = tagIds;
                                if (groupId) asp.groupId = groupId;
                                else delete asp.groupId;
                                await storage.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, aspects);
                            }
                        }
                        if (canvas.aspects?.createPlacement) {
                            await canvas.aspects.createPlacement(previewId, world.x, world.y);
                        }
                        ui.notifications.info(game.i18n.format("FAx.Global.AspectAddedToScene", { name }));
                    } catch (e) {
                        console.error("FateX Extras | Failed to finalize aspect via middle-click", e);
                    }
                }
            },
            cancel: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("Cancel") || "Cancel", callback: async () => { await _deletePreCreated(); } }
        },
        default: "create",
        close: async () => { await _deletePreCreated(); },
        render: (html) => {
            html.find("#fatex-new-aspect-name").focus();
            html.find("#fatex-new-aspect-name").on("input", function() {
                this.style.height = "auto";
                this.style.height = (this.scrollHeight) + "px";

                (async () => {
                    try {
                        const storage = await AspectStorage.getStorage();
                        if (!storage) return;
                        const aspects = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                        const asp = aspects.find(a => a.id === previewId);
                        if (asp) { asp.name = $(this).val(); await storage.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, aspects); }
                    } catch {}
                })();
            });
            html.find("#fatex-new-aspect-name").on("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    html.find(".dialog-button.create").click();
                }
            });
            html.find(".aspect-color-trigger").on("input", async (e) => {
                const col = e.target.value;
                html.find(".fatex-scene-aspect").css("border-left-color", col);
                try {
                    const storage = await AspectStorage.getStorage();
                    if (!storage) return;
                    const aspects = foundry.utils.duplicate(storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                    const asp = aspects.find(a => a.id === previewId);
                    if (asp) { asp.color = col; await storage.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, aspects); }
                } catch {}
            });

            const renderPills = async () => {
                try {
                    const storage = await AspectStorage.getStorage();
                    if (!storage) return;
                    const aspects = storage.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || [];
                    const asp = aspects.find(a => a.id === previewId);
                    const curTagIds = asp ? (asp.tagIds || []) : [];
                    let $list = html.find(".aspect-tags-list");

                    $list.find(".aspect-tag-pill").remove();

                    if (!$list.find("button.add-tag-to-aspect").length) {
                        $list.append(`<button type="button" class="add-tag-to-aspect" data-id="${previewId}" title="${game.i18n.localize('FAx.Global.AddTag')}"><i class="fas fa-plus"></i></button>`);
                    }
                    curTagIds.forEach(tid => {
                        const t = allTags.find(x => x.id === tid);
                        if (!t) return;
                        const $pill = $(`<span class="aspect-tag-pill" data-tag-id="${t.id}" style="background-color:${t.color}">${t.label} <i class="fas fa-times aspect-tag-remove" data-tag-id="${t.id}"></i></span>`);
                        $pill.find(".aspect-tag-remove").on("click", async () => {
                            try {
                                const st = await AspectStorage.getStorage();
                                if (!st) return;
                                const as = foundry.utils.duplicate(st.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                                const a = as.find(x => x.id === previewId);
                                if (a && a.tagIds) {
                                    a.tagIds = a.tagIds.filter(x => x !== t.id);
                                    await st.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, as);
                                    renderPills();
                                }
                            } catch {}
                        });
                        $list.append($pill);
                    });

                    const $addBtn = $list.find("button.add-tag-to-aspect");
                    $list.append($addBtn);
                    if ($addBtn.length) $addBtn.show();
                } catch {}
            };

            renderPills();

                    html.find(".invoke-control").css({ opacity: 1, pointerEvents: "auto" }).off("click").on("click", async (e) => {
                        const btn = e.currentTarget;
                        const field = btn.dataset.field || "invokes";
                        const action = btn.dataset.action;
                        try {
                            const st = await AspectStorage.getStorage();
                            if (!st) return;
                            const as = foundry.utils.duplicate(st.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                            const a = as.find(x => x.id === previewId);
                            if (!a) return;
                            if (action === "increase") a[field] = (a[field] || 0) + 1;
                            else a[field] = Math.max(0, (a[field] || 0) - 1);
                            await st.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, as);

                            const $val = $(btn).siblings(".invoke-value").first();
                            if ($val.length) $val.text(a[field]);
                            else $(btn).parent().find(".invoke-value").text(a[field]);
                        } catch {}
                    });
                    html.find(".aspect-visibility, .aspect-delete").css({ opacity: 1, pointerEvents: "auto" }).off("click").on("click", async (e) => {
                        const isVis = e.currentTarget.classList.contains("aspect-visibility");
                        if (isVis) {
                            try {
                                const st = await AspectStorage.getStorage();
                                const as = foundry.utils.duplicate(st.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                                const a = as.find(x => x.id === previewId);
                                if (a) { a.hidden = !a.hidden; await st.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, as); }
                            } catch {}
                        } else {
                            const ok = await Dialog.confirm({ title: game.i18n.localize("FAx.Global.DeleteAspectTitle"), content: `<p>${game.i18n.localize("FAx.Global.DeleteAspectConfirm")}</p>`, defaultYes: false });
                            if (ok) {
                                try {
                                    const st = await AspectStorage.getStorage();
                                    const as = foundry.utils.duplicate(st.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                                    const filtered = as.filter(x => x.id !== previewId);
                                    await st.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, filtered);

                                    html.closest(".app").find(".dialog-button.cancel").click();
                                } catch {}
                            }
                        }
                    });

                    const $addBtn = html.find(`.add-tag-to-aspect[data-id="${previewId}"]`);
                    if ($addBtn.length && !$addBtn.is(":visible")) $addBtn.show();
                    html.find(`.add-tag-to-aspect[data-id="${previewId}"]`).off("click.fatexAddTag").on("click.fatexAddTag", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                    const st = await AspectStorage.getStorage();
                    if (st) allTags = st.getFlag("fatex-extras", AspectStorage.FLAGS.TAGS) || allTags;
                } catch {}
                const storageForTags = await AspectStorage.getStorage();
                const curAspects = storageForTags ? (storageForTags.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []) : [];
                const curAsp = curAspects.find(a => a.id === previewId);
                const curTagIds = curAsp ? (curAsp.tagIds || []) : [];
                const available = allTags.filter(t => !curTagIds.includes(t.id));
                let pickerHtml = `<div class="fatex-tag-picker">`;
                if (available.length) {
                    pickerHtml += `<label><b>${game.i18n.localize("FAx.Global.PickExistingTag") || "Pick Existing Tag"}</b></label><div class="tag-list-scroll">`;
                    available.forEach(t => { pickerHtml += `<button type="button" class="fatex-tag-pick" data-id="${t.id}" style="text-align:left; padding:6px 8px; background:${t.color}; color:white; border:none; border-radius:4px; cursor:pointer; margin-bottom:4px; width:100%;"><i class="fas fa-tag" style="margin-right:6px;"></i>${foundry.utils.escapeHTML(t.label)}</button>`; });
                    pickerHtml += `</div><hr>`;
                } else if (!allTags.length) {
                    pickerHtml += `<p style="font-size:11px; opacity:0.6;">${game.i18n.localize("FAx.Global.NoTags") || "No tags defined"}</p><hr>`;
                } else {
                    pickerHtml += `<p style="font-size:11px; opacity:0.6;">All tags already added</p><hr>`;
                }
                pickerHtml += `<label><b>${game.i18n.localize("FAx.Global.CreateNewTag") || "Create New Tag"}</b></label><div class="form-group"><input type="text" id="fatex-pick-new-tag-name" placeholder="${game.i18n.localize("FAx.Global.TagName") || "Tag Name"}" style="width:100%; margin-bottom:6px;"><div style="display:flex; align-items:center; gap:8px;"><label>${game.i18n.localize("FAx.Global.Color") || "Color"}:</label> <input type="color" id="fatex-pick-new-tag-color" value="#7a7a7a" style="width:40px; height:28px; padding:2px; cursor:pointer;"></div></div></div>`;
                const pickDialog = new Dialog({
                    title: game.i18n.localize("FAx.Global.AddTag") || "Add Tag",
                    content: pickerHtml,
                    buttons: {
                        create: {
                            icon: '<i class="fas fa-plus"></i>',
                            label: game.i18n.localize("FAx.Global.CreateAndAdd") || "Create & Add",
                            callback: async (html2) => {
                                const name = html2.find("#fatex-pick-new-tag-name").val()?.trim();
                                const color = html2.find("#fatex-pick-new-tag-color").val() || "#7a7a7a";
                                if (!name) return;
                                const newTag = { id: foundry.utils.randomID(), label: name, color };
                                allTags.push(newTag);
                                try {
                                    const storage = await AspectStorage.getStorage();
                                    if (storage) {
                                        const currentTags = storage.getFlag("fatex-extras", AspectStorage.FLAGS.TAGS) || [];
                                        currentTags.push(newTag);
                                        await storage.setFlag("fatex-extras", AspectStorage.FLAGS.TAGS, currentTags);
                                    }
                                } catch {}
                                await _addTagToPreview(newTag.id);
                                renderPills();
                            }
                        },
                        close: { label: game.i18n.localize("Close") || "Close" }
                    },
                    render: ($h) => {
                        $h.find(".fatex-tag-pick").on("click", async (ev) => {
                            const tid = $(ev.currentTarget).data("id");
                            await _addTagToPreview(tid);
                            renderPills();
                            pickDialog.close();
                        });
                    }
                }, { width: 380 });
                pickDialog.render(true);
            });
            const _addTagToPreview = async (tagId) => {
                try {
                    const st = await AspectStorage.getStorage();
                    if (!st) return;
                    const as = foundry.utils.duplicate(st.getFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS) || []);
                    const a = as.find(x => x.id === previewId);
                    if (!a) return;
                    a.tagIds = a.tagIds || [];
                    if (!a.tagIds.includes(tagId)) a.tagIds.push(tagId);
                    await st.setFlag("fatex-extras", AspectStorage.FLAGS.ASPECTS, as);
                } catch {}
            };
        }
    }, { width: 520 }).render(true);
}, true);
