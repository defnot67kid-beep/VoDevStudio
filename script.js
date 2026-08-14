import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// ============================================================
// DOCKING SYSTEM
// ============================================================
class DockManager {
    constructor(root) {
        this.root = root;
        this.panels = {};
        this.layout = {};
        this.dragState = null;
        this.indicators = this.createIndicators();
        this.resizeHandle = null;
        this.resizeState = null;
        this.loadLayout();
        this.render();
    }

    createIndicators() {
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:150;display:none;';
        const zones = ['top','bottom','left','right','center'];
        const indicators = {};
        zones.forEach(z => {
            const el = document.createElement('div');
            el.style.cssText = 'position:absolute;border:3px dashed rgba(0,162,255,0.5);background:rgba(0,162,255,0.1);border-radius:4px;transition:all 0.15s;';
            if (z === 'top') { el.style.cssText += 'top:10px;left:10%;right:10%;height:25%;'; }
            else if (z === 'bottom') { el.style.cssText += 'bottom:10px;left:10%;right:10%;height:25%;'; }
            else if (z === 'left') { el.style.cssText += 'left:10px;top:10%;bottom:10%;width:20%;'; }
            else if (z === 'right') { el.style.cssText += 'right:10px;top:10%;bottom:10%;width:20%;'; }
            else if (z === 'center') { el.style.cssText += 'top:15%;left:15%;bottom:15%;right:15%;'; }
            container.appendChild(el);
            indicators[z] = el;
        });
        document.body.appendChild(container);
        return { container, zones: indicators };
    }

    register(id, config) {
        this.panels[id] = {
            id,
            title: config.title || id,
            content: config.content,
            icon: config.icon || '📦',
            defaultSide: config.defaultSide || 'left',
            defaultSize: config.defaultSize || 280,
            order: config.order || 0,
        };
        if (!this.layout[id]) {
            this.layout[id] = {
                mode: 'docked',
                side: config.defaultSide || 'left',
                size: config.defaultSize || 280,
                visible: config.visible !== false,
                floatingX: 100,
                floatingY: 100,
                floatingWidth: 400,
                floatingHeight: 300,
                tabGroup: null,
                minimized: false,
            };
        }
        this.render();
    }

    getPanel(id) { return this.panels[id]; }
    getState(id) { return this.layout[id]; }

    toggle(id) {
        if (!this.layout[id]) return;
        this.layout[id].visible = !this.layout[id].visible;
        this.saveLayout();
        this.render();
        this.updateViewport();
    }

    dock(id, side) {
        const state = this.layout[id];
        if (!state) return;
        state.mode = 'docked';
        state.side = side;
        state.size = state.size || 280;
        this.saveLayout();
        this.render();
        this.updateViewport();
    }

    undock(id) {
        const state = this.layout[id];
        if (!state) return;
        state.mode = 'floating';
        state.floatingX = state.floatingX || 100;
        state.floatingY = state.floatingY || 100;
        this.saveLayout();
        this.render();
        this.updateViewport();
    }

    close(id) {
        if (!this.layout[id]) return;
        this.layout[id].visible = false;
        this.saveLayout();
        this.render();
        this.updateViewport();
    }

    open(id) {
        if (!this.layout[id]) return;
        this.layout[id].visible = true;
        this.saveLayout();
        this.render();
        this.updateViewport();
    }

    resize(id, size) {
        if (!this.layout[id]) return;
        this.layout[id].size = Math.max(80, Math.min(800, size));
        this.saveLayout();
        this.render();
        this.updateViewport();
    }

    resetLayout() {
        this.layout = {};
        Object.keys(this.panels).forEach(id => {
            const p = this.panels[id];
            this.layout[id] = {
                mode: 'docked',
                side: p.defaultSide || 'left',
                size: p.defaultSize || 280,
                visible: true,
                floatingX: 100 + Math.random() * 50,
                floatingY: 100 + Math.random() * 50,
                floatingWidth: 400,
                floatingHeight: 300,
                tabGroup: null,
                minimized: false,
            };
        });
        localStorage.removeItem('vodevs_layout');
        this.render();
        this.updateViewport();
    }

    saveLayout() {
        try {
            localStorage.setItem('vodevs_layout', JSON.stringify(this.layout));
        } catch (e) {}
    }

    loadLayout() {
        try {
            const raw = localStorage.getItem('vodevs_layout');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed === 'object') {
                    this.layout = parsed;
                    return;
                }
            }
        } catch (e) {}
    }

    render() {
        const left = [], right = [], bottom = [], top = [];
        const floating = [];
        const hidden = [];

        Object.keys(this.layout).forEach(id => {
            const state = this.layout[id];
            const panel = this.panels[id];
            if (!panel) return;
            if (!state.visible) { hidden.push(id); return; }
            if (state.mode === 'floating') { floating.push(id); return; }
            if (state.side === 'left') left.push(id);
            else if (state.side === 'right') right.push(id);
            else if (state.side === 'bottom') bottom.push(id);
            else if (state.side === 'top') top.push(id);
            else left.push(id);
        });

        this.root.innerHTML = '';

        const leftEl = this.buildDockColumn(left, 'left');
        const rightEl = this.buildDockColumn(right, 'right');
        const bottomEl = this.buildDockRow(bottom, 'bottom');
        const topEl = this.buildDockRow(top, 'top');

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';

        if (topEl) wrapper.appendChild(topEl);

        const middle = document.createElement('div');
        middle.style.cssText = 'display:flex;flex:1;min-height:0;';
        if (leftEl) middle.appendChild(leftEl);

        const center = document.createElement('div');
        center.style.cssText = 'flex:1;min-width:0;min-height:0;position:relative;display:flex;';
        center.id = 'viewportWrap';
        center.innerHTML = `<div id="viewport" style="flex:1;position:relative;"></div>
            <div id="controls-hint" style="position:absolute;bottom:10px;right:10px;background:rgba(35,36,39,0.85);padding:6px 10px;border-radius:3px;border:1px solid #4a4d55;font-size:10.5px;color:#b0b3ba;line-height:1.6;pointer-events:none;z-index:5;">
                <b>WASD</b> Move &nbsp;<b>Q/E</b> Up/Down &nbsp;<b>F</b> Focus<br>
                <b>1</b> Move &nbsp;<b>2</b> Rotate &nbsp;<b>3</b> Scale &nbsp;<b>Del</b> Delete
            </div>`;
        middle.appendChild(center);

        if (rightEl) middle.appendChild(rightEl);
        wrapper.appendChild(middle);

        if (bottomEl) wrapper.appendChild(bottomEl);

        this.root.appendChild(wrapper);

        floating.forEach(id => this.renderFloating(id));

        document.dispatchEvent(new CustomEvent('dock-rendered'));
        this.updateViewport();
    }

    buildDockColumn(ids, side) {
        if (ids.length === 0) return null;
        const el = document.createElement('div');
        el.style.cssText = `display:flex;flex-direction:column;flex:0 0 auto;min-width:0;min-height:0;border-${side === 'left' ? 'right' : 'left'}:1px solid #4a4d55;background:#313338;`;
        let totalSize = 0;
        ids.forEach(id => {
            const state = this.layout[id];
            const panel = this.panels[id];
            if (!panel) return;
            const panelEl = this.buildPanel(id, state, panel);
            const size = state.size || 280;
            panelEl.style.cssText += `flex:0 0 ${size}px;min-height:0;display:flex;flex-direction:column;`;
            if (totalSize > 0) panelEl.style.borderTop = '1px solid #4a4d55';
            el.appendChild(panelEl);
            totalSize += size;
        });
        const children = el.children;
        for (let i = 0; i < children.length - 1; i++) {
            const handle = document.createElement('div');
            handle.style.cssText = 'flex:0 0 4px;cursor:ns-resize;background:transparent;position:relative;';
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const panelId = ids[i];
                const nextId = ids[i+1];
                this.startResize(panelId, nextId, e.clientY, 'vertical');
            });
            el.insertBefore(handle, children[i+1]);
        }
        return el;
    }

    buildDockRow(ids, side) {
        if (ids.length === 0) return null;
        const el = document.createElement('div');
        el.style.cssText = `display:flex;flex:0 0 auto;min-height:0;border-${side}:1px solid #4a4d55;background:#313338;flex-direction:${side === 'bottom' ? 'column' : 'column'};`;
        let totalSize = 0;
        ids.forEach(id => {
            const state = this.layout[id];
            const panel = this.panels[id];
            if (!panel) return;
            const panelEl = this.buildPanel(id, state, panel);
            const size = state.size || 200;
            panelEl.style.cssText += `flex:0 0 ${size}px;min-height:0;display:flex;flex-direction:column;`;
            if (totalSize > 0) panelEl.style.borderTop = '1px solid #4a4d55';
            el.appendChild(panelEl);
            totalSize += size;
        });
        const children = el.children;
        for (let i = 0; i < children.length - 1; i++) {
            const handle = document.createElement('div');
            handle.style.cssText = 'flex:0 0 4px;cursor:ns-resize;background:transparent;position:relative;';
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const panelId = ids[i];
                const nextId = ids[i+1];
                this.startResize(panelId, nextId, e.clientY, 'vertical');
            });
            el.insertBefore(handle, children[i+1]);
        }
        return el;
    }

    buildPanel(id, state, panel) {
        const el = document.createElement('div');
        el.className = 'dock-panel';
        el.dataset.panelId = id;

        const header = document.createElement('div');
        header.style.cssText = 'flex:0 0 28px;display:flex;align-items:center;background:#383a40;border-bottom:1px solid #4a4d55;padding:0 6px;gap:4px;cursor:grab;user-select:none;';
        header.title = 'Drag to move panel';

        const icon = document.createElement('span');
        icon.textContent = panel.icon;
        icon.style.cssText = 'font-size:13px;';

        const title = document.createElement('span');
        title.textContent = panel.title;
        title.style.cssText = 'flex:1;font-weight:600;font-size:11.5px;color:#b0b3ba;';

        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = state.minimized ? '▶' : '▼';
        collapseBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:10px;padding:0 4px;';
        collapseBtn.onclick = (e) => { e.stopPropagation(); state.minimized = !state.minimized; this.saveLayout(); this.render(); };

        const dockBtn = document.createElement('button');
        dockBtn.textContent = state.mode === 'floating' ? '📌' : '🗔';
        dockBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:12px;padding:0 4px;';
        dockBtn.onclick = (e) => {
            e.stopPropagation();
            if (state.mode === 'floating') this.dock(id, state.side || 'left');
            else this.undock(id);
        };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:12px;padding:0 4px;';
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(id); };

        const menuBtn = document.createElement('button');
        menuBtn.textContent = '⋮';
        menuBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:14px;padding:0 4px;';
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            this.showPanelMenu(id, e.clientX, e.clientY);
        };

        header.appendChild(icon);
        header.appendChild(title);
        header.appendChild(collapseBtn);
        header.appendChild(dockBtn);
        header.appendChild(menuBtn);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;';
        if (state.minimized) content.style.display = 'none';
        content.appendChild(panel.content);

        el.appendChild(header);
        el.appendChild(content);

        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('button')) return;
            this.startDrag(id, e.clientX, e.clientY);
        });

        return el;
    }

    renderFloating(id) {
        const state = this.layout[id];
        const panel = this.panels[id];
        if (!panel || !state) return;

        let el = document.querySelector(`.floating-panel[data-panel-id="${id}"]`);
        if (!el) {
            el = document.createElement('div');
            el.className = 'floating-panel';
            el.dataset.panelId = id;
            el.style.cssText = `position:fixed;background:#313338;border:1px solid #4a4d55;border-radius:3px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:100;display:flex;flex-direction:column;min-width:200px;min-height:120px;`;
            document.body.appendChild(el);

            const header = document.createElement('div');
            header.style.cssText = 'flex:0 0 28px;display:flex;align-items:center;background:#383a40;border-bottom:1px solid #4a4d55;padding:0 6px;gap:4px;cursor:grab;user-select:none;';
            header.title = 'Drag to move';

            const icon = document.createElement('span');
            icon.textContent = panel.icon;
            icon.style.cssText = 'font-size:13px;';

            const title = document.createElement('span');
            title.textContent = panel.title;
            title.style.cssText = 'flex:1;font-weight:600;font-size:11.5px;color:#b0b3ba;';

            const dockBtn = document.createElement('button');
            dockBtn.textContent = '📌';
            dockBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:12px;padding:0 4px;';
            dockBtn.onclick = (e) => { e.stopPropagation(); this.dock(id, state.side || 'left'); };

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:12px;padding:0 4px;';
            closeBtn.onclick = (e) => { e.stopPropagation(); this.close(id); };

            const menuBtn = document.createElement('button');
            menuBtn.textContent = '⋮';
            menuBtn.style.cssText = 'background:transparent;border:none;color:#808289;cursor:pointer;font-size:14px;padding:0 4px;';
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                this.showPanelMenu(id, e.clientX, e.clientY);
            };

            header.appendChild(icon);
            header.appendChild(title);
            header.appendChild(dockBtn);
            header.appendChild(menuBtn);
            header.appendChild(closeBtn);

            const content = document.createElement('div');
            content.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;';
            content.appendChild(panel.content);

            el.appendChild(header);
            el.appendChild(content);

            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('button')) return;
                this.startDrag(id, e.clientX, e.clientY);
            });

            this.addResizeHandles(el, id);

            el.addEventListener('mousedown', () => {
                el.style.zIndex = 100 + Date.now() % 1000;
            });
        }

        el.style.left = state.floatingX + 'px';
        el.style.top = state.floatingY + 'px';
        el.style.width = state.floatingWidth + 'px';
        el.style.height = state.floatingHeight + 'px';
        if (state.minimized) {
            el.style.height = '28px';
            el.querySelector('div:last-child').style.display = 'none';
        } else {
            el.querySelector('div:last-child').style.display = 'flex';
        }
    }

    addResizeHandles(el, id) {
        const positions = ['n','s','e','w','ne','nw','se','sw'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.style.cssText = `position:absolute;${this.resizeHandleStyle(pos)};`;
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = el.getBoundingClientRect();
                this.resizeState = {
                    panelId: id,
                    type: pos,
                    startX: e.clientX,
                    startY: e.clientY,
                    startLeft: rect.left,
                    startTop: rect.top,
                    startWidth: rect.width,
                    startHeight: rect.height,
                };
                document.addEventListener('mousemove', this.onResizeMove);
                document.addEventListener('mouseup', this.onResizeEnd);
            });
            el.appendChild(handle);
        });
    }

    resizeHandleStyle(pos) {
        const map = {
            'n': 'top:-4px;left:20%;right:20%;height:8px;cursor:ns-resize;',
            's': 'bottom:-4px;left:20%;right:20%;height:8px;cursor:ns-resize;',
            'e': 'right:-4px;top:20%;bottom:20%;width:8px;cursor:ew-resize;',
            'w': 'left:-4px;top:20%;bottom:20%;width:8px;cursor:ew-resize;',
            'ne': 'top:-4px;right:-4px;width:12px;height:12px;cursor:ne-resize;',
            'nw': 'top:-4px;left:-4px;width:12px;height:12px;cursor:nw-resize;',
            'se': 'bottom:-4px;right:-4px;width:12px;height:12px;cursor:se-resize;',
            'sw': 'bottom:-4px;left:-4px;width:12px;height:12px;cursor:sw-resize;',
        };
        return map[pos] || '';
    }

    startDrag(id, x, y) {
        this.dragState = {
            panelId: id,
            startX: x,
            startY: y,
            panelEl: document.querySelector(`.dock-panel[data-panel-id="${id}"], .floating-panel[data-panel-id="${id}"]`),
            isFloating: this.layout[id].mode === 'floating',
        };
        this.indicators.container.style.display = 'flex';
        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);
    }

    onDragMove = (e) => {
        if (!this.dragState) return;
        const { panelId, startX, startY, isFloating } = this.dragState;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (isFloating) {
            const state = this.layout[panelId];
            state.floatingX += dx;
            state.floatingY += dy;
            this.dragState.startX = e.clientX;
            this.dragState.startY = e.clientY;
            this.renderFloating(panelId);
        } else {
            const rect = this.root.getBoundingClientRect();
            const zones = this.indicators.zones;
            Object.keys(zones).forEach(z => {
                const el = zones[z];
                let active = false;
                if (z === 'left' && e.clientX < rect.left + rect.width * 0.3) active = true;
                else if (z === 'right' && e.clientX > rect.left + rect.width * 0.7) active = true;
                else if (z === 'top' && e.clientY < rect.top + rect.height * 0.3) active = true;
                else if (z === 'bottom' && e.clientY > rect.top + rect.height * 0.7) active = true;
                else if (z === 'center' && e.clientX > rect.left + rect.width * 0.3 && e.clientX < rect.left + rect.width * 0.7 &&
                         e.clientY > rect.top + rect.height * 0.3 && e.clientY < rect.top + rect.height * 0.7) active = true;
                el.style.borderColor = active ? 'rgba(0,162,255,0.9)' : 'rgba(0,162,255,0.3)';
                el.style.background = active ? 'rgba(0,162,255,0.2)' : 'rgba(0,162,255,0.05)';
            });
        }
    };

    onDragEnd = (e) => {
        if (!this.dragState) return;
        const { panelId } = this.dragState;
        const rect = this.root.getBoundingClientRect();
        const x = e.clientX, y = e.clientY;

        let targetZone = null;
        if (x < rect.left + rect.width * 0.3) targetZone = 'left';
        else if (x > rect.left + rect.width * 0.7) targetZone = 'right';
        else if (y < rect.top + rect.height * 0.3) targetZone = 'top';
        else if (y > rect.top + rect.height * 0.7) targetZone = 'bottom';
        else if (x > rect.left + rect.width * 0.3 && x < rect.left + rect.width * 0.7 &&
                 y > rect.top + rect.height * 0.3 && y < rect.top + rect.height * 0.7) targetZone = 'center';

        if (targetZone && targetZone !== 'center') {
            this.dock(panelId, targetZone);
        } else if (targetZone === 'center') {
            this.dock(panelId, 'left');
        } else {
            if (this.layout[panelId].mode === 'docked') {
                this.undock(panelId);
                this.layout[panelId].floatingX = x - 100;
                this.layout[panelId].floatingY = y - 20;
            }
        }

        this.indicators.container.style.display = 'none';
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
        this.dragState = null;
        this.render();
        this.updateViewport();
    };

    startResize(panelId, nextId, startY, direction) {
        const state = this.layout[panelId];
        const nextState = this.layout[nextId];
        if (!state || !nextState) return;
        this.resizeState = {
            panelId,
            nextId,
            startY,
            startSize: state.size,
            nextSize: nextState.size,
            direction,
        };
        document.addEventListener('mousemove', this.onResizeMove);
        document.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove = (e) => {
        if (!this.resizeState) return;
        const { panelId, nextId, startY, startSize, nextSize } = this.resizeState;
        const delta = e.clientY - startY;
        const newSize = Math.max(80, Math.min(800, startSize + delta));
        const nextNewSize = Math.max(80, Math.min(800, nextSize - delta));
        this.layout[panelId].size = newSize;
        this.layout[nextId].size = nextNewSize;
        this.saveLayout();
        this.render();
        this.updateViewport();
    };

    onResizeEnd = () => {
        this.resizeState = null;
        document.removeEventListener('mousemove', this.onResizeMove);
        document.removeEventListener('mouseup', this.onResizeEnd);
    };

    showPanelMenu(id, x, y) {
        const state = this.layout[id];
        const items = [
            { label: 'Dock', icon: '📌', sub: [
                { label: 'Left', onClick: () => this.dock(id, 'left') },
                { label: 'Right', onClick: () => this.dock(id, 'right') },
                { label: 'Top', onClick: () => this.dock(id, 'top') },
                { label: 'Bottom', onClick: () => this.dock(id, 'bottom') },
            ]},
            { label: state.mode === 'floating' ? 'Dock' : 'Float', icon: state.mode === 'floating' ? '📌' : '🗔',
              onClick: () => state.mode === 'floating' ? this.dock(id, state.side || 'left') : this.undock(id) },
            { sep: true },
            { label: 'Close', icon: '✕', onClick: () => this.close(id) },
            { label: 'Reset Position', icon: '🔄', onClick: () => {
                state.floatingX = 100;
                state.floatingY = 100;
                state.size = 280;
                this.saveLayout();
                this.render();
            }},
        ];
        const menu = document.getElementById('contextMenu');
        menu.innerHTML = '';
        this.buildMenuItems(menu, items);
        menu.style.display = 'flex';
        menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
        menu.style.top = Math.min(y, window.innerHeight - 300) + 'px';
        menu.style.zIndex = 210;
    }

    buildMenuItems(container, items) {
        items.forEach(it => {
            if (it.sep) {
                const li = document.createElement('li');
                li.className = 'context-menu-sep';
                container.appendChild(li);
                return;
            }
            const li = document.createElement('li');
            li.innerHTML = `<span>${it.icon || ''}</span><span>${it.label}</span>`;
            if (it.sub) {
                li.style.cursor = 'pointer';
                li.onclick = (e) => {
                    e.stopPropagation();
                    const sub = document.createElement('ul');
                    sub.className = 'context-menu';
                    sub.style.cssText = 'position:absolute;left:100%;top:0;display:flex;';
                    this.buildMenuItems(sub, it.sub);
                    li.style.position = 'relative';
                    li.appendChild(sub);
                };
            } else if (it.onClick) {
                li.onclick = (e) => {
                    e.stopPropagation();
                    it.onClick();
                    document.getElementById('contextMenu').style.display = 'none';
                };
            }
            container.appendChild(li);
        });
    }

    updateViewport() {
        setTimeout(() => {
            const viewport = document.getElementById('viewport');
            if (viewport) {
                const rect = viewport.getBoundingClientRect();
                const event = new CustomEvent('viewport-resize', {
                    detail: { width: rect.width, height: rect.height }
                });
                document.dispatchEvent(event);
            }
        }, 50);
    }
}

// ============================================================
// MAIN APPLICATION
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1b1e);

let viewportEl = null;
let renderer = null;
let camera = null;
let orbitControls = null;
let transformControls = null;
let currentGroup = null;
let selectedObject = null;
let selectionBox = null;
let extraInstances = [];
let extraIdCounter = 1;
let isAltPressed = false;
let initialScale = null;
let initialObject = null;
const keys = {};
const VODEVS_KEY = 'vodevs_library';

const statusEl = document.getElementById('status');
const fileNameEl = document.getElementById('fileName');

// ============================================================
// INIT DOCK SYSTEM
// ============================================================
function initDockSystem() {
    const root = document.getElementById('dockRoot');
    const dock = new DockManager(root);

    const explorerContent = document.createElement('div');
    explorerContent.id = 'explorerContent';
    explorerContent.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;';
    explorerContent.innerHTML = `
        <input type="text" id="searchBox" placeholder="Search Workspace..." style="box-sizing:border-box;background:#24262a;border:1px solid #4a4d55;color:#ffffff;padding:5px 8px;border-radius:2px;font-size:11.5px;margin:8px 8px 6px;width:calc(100% - 16px);">
        <ul id="tree" style="list-style:none;padding:0 0 6px;margin:0;flex:1;overflow-y:auto;">
            <li>
                <span class="arrow">▼</span>
                <span class="tree-node tree-node-row" id="workspaceNode" data-node="Workspace">
                    <span class="tree-node-label">🌐 Workspace</span>
                    <button class="explorer-add-btn" id="workspaceAddBtn" title="Insert object into Workspace">⊕</button>
                </span>
                <ul class="nested" id="workspaceRoot">
                    <li><span class="arrow">▼</span> <span class="tree-node">📷 Camera</span></li>
                    <li><span class="arrow">▼</span> <span class="tree-node">⛰️ Terrain</span></li>
                    <li id="importedModelNode"><span class="arrow">▼</span> <span class="tree-node">ImportedModel (Empty)</span>
                        <ul class="nested" id="modelChildren"></ul>
                    </li>
                    <li class="extras-holder"><ul class="nested" id="workspaceExtras" style="padding-left:0;"></ul></li>
                </ul>
            </li>
        </ul>
    `;
    dock.register('explorer', {
        title: 'Explorer',
        icon: '🗂️',
        content: explorerContent,
        defaultSide: 'right',
        defaultSize: 280,
        visible: true,
        order: 1,
    });

    const propertiesContent = document.createElement('div');
    propertiesContent.id = 'propContent';
    propertiesContent.style.cssText = 'flex:1;overflow-y:auto;padding:8px 10px;';
    propertiesContent.innerHTML = `
        <div class="prop-group">
            <div class="prop-line"><label>Name</label><input type="text" id="propName"></div>
        </div>
        <div class="prop-group">
            <div class="prop-line"><label>ClassName</label><div id="propClass">Part</div></div>
        </div>
        <div class="prop-group">
            <div class="prop-line"><label>Material</label>
                <select id="propMaterial">
                    <option value="Plastic">Plastic</option>
                    <option value="Wood">Wood</option>
                    <option value="Metal">Metal</option>
                    <option value="Grass">Grass</option>
                    <option value="Ice">Ice</option>
                    <option value="Paint">Paint</option>
                </select>
            </div>
        </div>
        <div class="prop-group">
            <label class="prop-group-label">Position</label>
            <div class="prop-row">
                <input type="number" id="propPosX" step="0.1">
                <input type="number" id="propPosY" step="0.1">
                <input type="number" id="propPosZ" step="0.1">
            </div>
        </div>
        <div class="prop-group">
            <label class="prop-group-label">Rotation</label>
            <div class="prop-row">
                <input type="number" id="propRotX" step="0.1">
                <input type="number" id="propRotY" step="0.1">
                <input type="number" id="propRotZ" step="0.1">
            </div>
        </div>
        <div class="prop-group">
            <label class="prop-group-label">Size</label>
            <div class="prop-row">
                <input type="number" id="propSizeX" step="0.1">
                <input type="number" id="propSizeY" step="0.1">
                <input type="number" id="propSizeZ" step="0.1">
            </div>
        </div>
        <div class="prop-group">
            <div class="prop-line"><label>Color</label><input type="color" id="propColor" value="#cccccc"></div>
        </div>
        <div class="prop-group">
            <label class="prop-group-label">Behavior</label>
            <label class="checkbox-row"><input type="checkbox" id="propAnchored"> Anchored</label>
            <label class="checkbox-row"><input type="checkbox" id="propCanCollide"> CanCollide</label>
            <label class="checkbox-row"><input type="checkbox" id="propTruss"> Truss</label>
        </div>
        <div class="prop-group">
            <label class="prop-group-label">Textures</label>
            <div class="texture-add-row">
                <select id="propTexFace">
                    <option value="Front">Front</option>
                    <option value="Back">Back</option>
                    <option value="Top">Top</option>
                    <option value="Bottom">Bottom</option>
                    <option value="Left">Left</option>
                    <option value="Right">Right</option>
                </select>
                <select id="propTexType">
                    <option value="Studs">Studs</option>
                    <option value="Inlets">Inlets</option>
                </select>
            </div>
            <button type="button" class="btn" id="propTexAddBtn" style="width:100%;justify-content:center;margin-bottom:8px;">+ Add Texture</button>
            <ul class="texture-list" id="propTexList"></ul>
        </div>
    `;
    dock.register('properties', {
        title: 'Properties',
        icon: '📋',
        content: propertiesContent,
        defaultSide: 'right',
        defaultSize: 280,
        visible: true,
        order: 2,
    });

    const toolboxContent = document.createElement('div');
    toolboxContent.id = 'toolboxContent';
    toolboxContent.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;';
    toolboxContent.innerHTML = `
        <div class="toolbox-tabs">
            <button class="toolbox-tab active" data-tab="store" type="button">Store</button>
            <button class="toolbox-tab" data-tab="mine" type="button">My Assets</button>
        </div>
        <input type="text" id="toolboxSearch" placeholder="Search Toolbox..." style="box-sizing:border-box;background:#24262a;border:1px solid #4a4d55;color:#ffffff;padding:5px 8px;border-radius:2px;font-size:11.5px;margin:8px 8px 0;width:calc(100% - 16px);">
        <div class="toolbox-chips" id="toolboxChips">
            <button class="chip active" data-cat="all" type="button">All</button>
            <button class="chip" data-cat="model" type="button">Models</button>
            <button class="chip" data-cat="part" type="button">Parts</button>
            <button class="chip" data-cat="instance" type="button">Instances</button>
        </div>
        <div id="toolboxBrowse" style="flex:1;overflow-y:auto;padding:8px;">
            <div id="toolboxEmpty" class="texture-empty" style="display:none;">Nothing here yet.</div>
            <ul id="toolboxList" class="vodevs-list toolbox-grid" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:8px;"></ul>
        </div>
        <div id="toolboxDetail" class="toolbox-detail" style="display:none;flex-direction:column;align-items:center;text-align:center;padding:8px;">
            <button id="toolboxDetailBack" class="toolbox-back" type="button" style="align-self:flex-start;background:none;border:none;color:#b0b3ba;font-size:11px;cursor:pointer;margin-bottom:8px;">← Back</button>
            <div class="toolbox-detail-icon" id="toolboxDetailIcon" style="width:64px;height:64px;border-radius:3px;background:#24262a;border:1px solid #4a4d55;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:10px;">🧩</div>
            <div class="toolbox-detail-name" id="toolboxDetailName" style="font-size:13px;font-weight:700;">Asset name</div>
            <div class="toolbox-detail-meta" id="toolboxDetailMeta" style="font-size:11px;color:#808289;margin-bottom:14px;">By @you</div>
            <div class="toolbox-detail-actions" style="display:flex;gap:6px;width:100%;">
                <button class="btn btn-primary" id="toolboxDetailInsert" type="button" style="flex:1;justify-content:center;">Insert</button>
                <button class="btn btn-danger" id="toolboxDetailRemove" type="button" style="flex:1;justify-content:center;">Remove</button>
            </div>
        </div>
    `;
    dock.register('toolbox', {
        title: 'Toolbox',
        icon: '🧰',
        content: toolboxContent,
        defaultSide: 'left',
        defaultSize: 280,
        visible: true,
        order: 0,
    });

    const outputContent = document.createElement('div');
    outputContent.id = 'outputContent';
    outputContent.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:#1a1b1e;padding:4px 8px;font-family:monospace;font-size:11px;';
    outputContent.innerHTML = `
        <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #4a4d55;flex:0 0 auto;">
            <button id="outputClear" style="background:transparent;border:1px solid #4a4d55;color:#b0b3ba;padding:2px 10px;border-radius:2px;cursor:pointer;font-size:10px;">Clear</button>
            <select id="outputFilter" style="background:#24262a;border:1px solid #4a4d55;color:#ffffff;padding:2px 6px;border-radius:2px;font-size:10px;">
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
            </select>
        </div>
        <div id="outputList" style="flex:1;overflow-y:auto;padding:4px 0;"></div>
    `;
    dock.register('output', {
        title: 'Output',
        icon: '📟',
        content: outputContent,
        defaultSide: 'bottom',
        defaultSize: 160,
        visible: true,
        order: 3,
    });

    const scriptContent = document.createElement('div');
    scriptContent.id = 'scriptContent';
    scriptContent.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:#1a1b1e;';
    scriptContent.innerHTML = `
        <div style="display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid #4a4d55;flex:0 0 auto;background:#313338;overflow-x:auto;">
            <span style="font-size:11px;color:#b0b3ba;">Script.lua</span>
            <span style="font-size:11px;color:#808289;">LocalScript.lua</span>
            <button id="newScriptBtn" style="background:transparent;border:none;color:#b0b3ba;cursor:pointer;font-size:12px;padding:0 6px;">+</button>
        </div>
        <div style="flex:1;overflow:hidden;display:flex;">
            <div style="flex:0 0 40px;background:#24262a;color:#808289;padding:8px 4px;text-align:right;font-family:monospace;font-size:11px;border-right:1px solid #4a4d55;overflow:hidden;user-select:none;">
                1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>10<br>11<br>12<br>13<br>14<br>15
            </div>
            <textarea id="scriptEditor" style="flex:1;background:#1a1b1e;color:#d4d4d4;border:none;padding:8px;font-family:monospace;font-size:11px;resize:none;outline:none;white-space:pre;tab-size:4;" spellcheck="false">local part = workspace.Part
part.Position = Vector3.new(0, 0, 0)
part.Anchored = true
            </textarea>
        </div>
    `;
    dock.register('scriptEditor', {
        title: 'Script Editor',
        icon: '📜',
        content: scriptContent,
        defaultSide: 'bottom',
        defaultSize: 200,
        visible: false,
        order: 4,
    });

    window.dock = dock;
    return dock;
}

const dock = initDockSystem();

// ============================================================
// THREE.JS SETUP
// ============================================================
function initThree() {
    viewportEl = document.getElementById('viewport');
    if (!viewportEl) return;

    const { width, height } = viewportEl.getBoundingClientRect();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(8, 5, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    viewportEl.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.target.set(0, 0, 0);
    orbitControls.maxPolarAngle = Math.PI / 2.2;
    orbitControls.minDistance = 3;
    orbitControls.maxDistance = 30;

    transformControls = new TransformControls(camera, renderer.domElement);
    scene.add(transformControls);
    transformControls.addEventListener('dragging-changed', (event) => {
        orbitControls.enabled = !event.value;
    });

    transformControls.addEventListener('mouseDown', () => {
        if (transformControls.getMode() === 'scale' && selectedObject) {
            initialObject = selectedObject;
            initialScale = selectedObject.scale.clone();
        }
    });
    transformControls.addEventListener('objectChange', () => {
        if (isAltPressed && initialObject && initialScale && transformControls.getMode() === 'scale') {
            const currentScale = initialObject.scale;
            const dx = Math.abs(currentScale.x - initialScale.x);
            const dy = Math.abs(currentScale.y - initialScale.y);
            const dz = Math.abs(currentScale.z - initialScale.z);
            let dominantAxis = 'x', maxChange = dx;
            if (dy > maxChange) { dominantAxis = 'y'; maxChange = dy; }
            if (dz > maxChange) { dominantAxis = 'z'; maxChange = dz; }
            if (maxChange > 0.001) {
                const scaleFactor = currentScale[dominantAxis] / initialScale[dominantAxis];
                const clampedFactor = Math.max(0.1, Math.min(10, scaleFactor));
                initialObject.scale.set(
                    initialScale.x * clampedFactor,
                    initialScale.y * clampedFactor,
                    initialScale.z * clampedFactor
                );
            }
        }
    });
    transformControls.addEventListener('mouseUp', () => {
        initialScale = null;
        initialObject = null;
    });

    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    fillLight.position.set(-5, 0, 5);
    scene.add(fillLight);

    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    const gridHelper = new THREE.GridHelper(20, 20, 0x88aaff, 0x446688);
    gridHelper.position.y = -0.48;
    scene.add(gridHelper);
    window.gridHelper = gridHelper;

    document.addEventListener('viewport-resize', (e) => {
        const { width, height } = e.detail;
        if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    });
}

document.addEventListener('dock-rendered', () => {
    if (!renderer) initThree();
    else {
        const viewport = document.getElementById('viewport');
        if (viewport) {
            const rect = viewport.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                camera.aspect = rect.width / rect.height;
                camera.updateProjectionMatrix();
                renderer.setSize(rect.width, rect.height);
            }
        }
    }
});

// ============================================================
// EXPLORER & PROPERTIES LOGIC
// ============================================================
function ensurePartDefaults(obj) {
    if (obj.userData.material === undefined) obj.userData.material = 'Plastic';
    if (obj.userData.anchored === undefined) obj.userData.anchored = true;
    if (obj.userData.canCollide === undefined) obj.userData.canCollide = true;
    if (obj.userData.truss === undefined) obj.userData.truss = obj.userData.className === 'TrussPart';
    if (!Array.isArray(obj.userData.textures)) obj.userData.textures = [];
}

function selectObject(obj) {
    if (selectedObject) {
        if (selectionBox) scene.remove(selectionBox);
        transformControls.detach();
    }
    selectedObject = obj;
    if (selectedObject) {
        selectionBox = new THREE.BoxHelper(selectedObject, 0x00a2ff);
        scene.add(selectionBox);
        transformControls.attach(selectedObject);
        updateProperties(selectedObject);
        dock.open('properties');
    } else {
        dock.close('properties');
    }
    updateExplorer(currentGroup);
}

function deleteSelected() {
    if (!selectedObject || !currentGroup) return;
    currentGroup.remove(selectedObject);
    selectedObject.geometry.dispose();
    if (Array.isArray(selectedObject.material)) selectedObject.material.forEach(m => m.dispose());
    else selectedObject.material.dispose();
    selectObject(null);
    updateExplorer(currentGroup);
    statusEl.textContent = '🗑️ Deleted part.';
}

function renderTextureList(obj) {
    const list = document.getElementById('propTexList');
    if (!list) return;
    list.innerHTML = '';
    const textures = (obj && Array.isArray(obj.userData.textures)) ? obj.userData.textures : [];
    if (textures.length === 0) {
        const li = document.createElement('li');
        li.className = 'texture-empty';
        li.style.border = 'none';
        li.style.background = 'transparent';
        li.textContent = 'No textures applied';
        list.appendChild(li);
        return;
    }
    textures.forEach((t, i) => {
        const li = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = `${t.face}: ${t.texture}`;
        const remove = document.createElement('span');
        remove.className = 'tex-remove';
        remove.textContent = '✕';
        remove.onclick = () => {
            obj.userData.textures.splice(i, 1);
            renderTextureList(obj);
        };
        li.appendChild(label);
        li.appendChild(remove);
        list.appendChild(li);
    });
}

function updateProperties(obj) {
    if (!obj) return;
    ensurePartDefaults(obj);
    document.getElementById('propName').value = obj.userData.partName || 'Part';
    document.getElementById('propClass').textContent = obj.userData.className || 'Part';
    document.getElementById('propMaterial').value = obj.userData.material;
    document.getElementById('propAnchored').checked = obj.userData.anchored;
    document.getElementById('propCanCollide').checked = obj.userData.canCollide;
    document.getElementById('propTruss').checked = obj.userData.truss;
    renderTextureList(obj);
    
    document.getElementById('propPosX').value = obj.position.x.toFixed(2);
    document.getElementById('propPosY').value = obj.position.y.toFixed(2);
    document.getElementById('propPosZ').value = obj.position.z.toFixed(2);
    
    const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
    document.getElementById('propRotX').value = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
    document.getElementById('propRotY').value = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
    document.getElementById('propRotZ').value = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
    
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    document.getElementById('propSizeX').value = size.x.toFixed(2);
    document.getElementById('propSizeY').value = size.y.toFixed(2);
    document.getElementById('propSizeZ').value = size.z.toFixed(2);
    
    if (obj.material && obj.material.color) {
        document.getElementById('propColor').value = '#' + obj.material.color.getHexString();
    }
}

function bindPropInput(id, applyFn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
        if (selectedObject) applyFn(selectedObject, parseFloat(el.value));
    });
    el.addEventListener('change', () => { if (selectedObject) updateProperties(selectedObject); });
}

document.addEventListener('DOMContentLoaded', () => {
    bindPropInput('propPosX', (obj, v) => obj.position.x = v);
    bindPropInput('propPosY', (obj, v) => obj.position.y = v);
    bindPropInput('propPosZ', (obj, v) => obj.position.z = v);
    
    document.getElementById('propRotX').addEventListener('input', (e) => {
        if (!selectedObject) return;
        const euler = new THREE.Euler(THREE.MathUtils.degToRad(parseFloat(e.target.value)), 0, 0);
        selectedObject.quaternion.setFromEuler(euler);
    });

    function updateObjectScale(obj, x, y, z) {
        if (!obj.userData.baseSize) {
            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            box.getSize(size);
            obj.userData.baseSize = size.clone();
        }
        const base = obj.userData.baseSize;
        const newScaleX = x / base.x;
        const newScaleY = y / base.y;
        const newScaleZ = z / base.z;
        obj.scale.set(newScaleX, newScaleY, newScaleZ);
    }
    bindPropInput('propSizeX', (obj, v) => updateObjectScale(obj, v, parseFloat(document.getElementById('propSizeY').value), parseFloat(document.getElementById('propSizeZ').value)));
    bindPropInput('propSizeY', (obj, v) => updateObjectScale(obj, parseFloat(document.getElementById('propSizeX').value), v, parseFloat(document.getElementById('propSizeZ').value)));
    bindPropInput('propSizeZ', (obj, v) => updateObjectScale(obj, parseFloat(document.getElementById('propSizeX').value), parseFloat(document.getElementById('propSizeY').value), v));

    document.getElementById('propColor').addEventListener('input', (e) => {
        if (selectedObject && selectedObject.material) {
            selectedObject.material.color.set(e.target.value);
        }
    });

    document.getElementById('propName').addEventListener('change', (e) => {
        if (selectedObject) {
            selectedObject.userData.partName = e.target.value;
            updateExplorer(currentGroup);
        }
    });

    document.getElementById('propMaterial').addEventListener('change', (e) => {
        if (selectedObject) selectedObject.userData.material = e.target.value;
    });
    document.getElementById('propAnchored').addEventListener('change', (e) => {
        if (selectedObject) selectedObject.userData.anchored = e.target.checked;
    });
    document.getElementById('propCanCollide').addEventListener('change', (e) => {
        if (selectedObject) selectedObject.userData.canCollide = e.target.checked;
    });
    document.getElementById('propTruss').addEventListener('change', (e) => {
        if (selectedObject) selectedObject.userData.truss = e.target.checked;
    });

    document.getElementById('propTexAddBtn').addEventListener('click', () => {
        if (!selectedObject) return;
        ensurePartDefaults(selectedObject);
        const face = document.getElementById('propTexFace').value;
        const texture = document.getElementById('propTexType').value;
        const existingIndex = selectedObject.userData.textures.findIndex(t => t.face === face);
        if (existingIndex >= 0) selectedObject.userData.textures[existingIndex].texture = texture;
        else selectedObject.userData.textures.push({ face, texture });
        renderTextureList(selectedObject);
    });
});

// ============================================================
// EXPLORER UPDATE
// ============================================================
function updateExplorer(group) {
    const modelChildren = document.getElementById('modelChildren');
    if (!modelChildren) return;
    modelChildren.innerHTML = '';
    if (!group) {
        document.querySelector('#importedModelNode .tree-node').textContent = 'ImportedModel (Empty)';
        return;
    }
    document.querySelector('#importedModelNode .tree-node').textContent = `ImportedModel (${group.children.length} items)`;
    
    const searchBox = document.getElementById('searchBox');
    const searchTerm = searchBox ? searchBox.value.toLowerCase() : '';
    
    group.children.forEach((obj, index) => {
        const name = obj.userData.partName || obj.userData.className || `Part ${index}`;
        if (searchTerm && !name.toLowerCase().includes(searchTerm)) return;
        
        const li = document.createElement('li');
        let icon = '📦';
        if (obj.userData.sourceShape === 'WedgePart' || obj.userData.sourceShape === 'CornerWedgePart' || obj.userData.sourceShape === 'DecomposedWedge') icon = '🪜';
        else if (obj.userData.className === 'MeshPart') icon = '🌀';
        else if (obj.userData.className === 'Part') icon = '📦';
        else if (obj.userData.className === 'TrussPart') icon = '🏗️';
        
        li.innerHTML = `${icon} ${name}`;
        li.dataset.index = index;
        
        li.ondblclick = () => {
            const newName = prompt("Rename Part:", name);
            if (newName) {
                obj.userData.partName = newName;
                updateExplorer(group);
            }
        };

        li.onclick = (e) => {
            e.stopPropagation();
            selectObject(obj);
        };

        li.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectObject(obj);
            showContextMenu(e.clientX, e.clientY, buildPartContextMenuItems(obj));
        };

        if (selectedObject === obj) li.classList.add('selected');
        modelChildren.appendChild(li);
    });

    renderWorkspaceExtras();
}

// ============================================================
// WORKSPACE EXTRAS
// ============================================================
const INSERTABLE_TYPES = [
    { group: 'Frequently Used', className: 'Part', icon: '📦' },
    { group: 'Frequently Used', className: 'Script', icon: '📄' },
    { group: 'Frequently Used', className: 'Folder', icon: '📁' },
    { group: 'Frequently Used', className: 'Tool', icon: '🛠️' },
    { group: 'Frequently Used', className: 'SpawnLocation', icon: '⚙️' },
    { group: 'Frequently Used', className: 'MeshPart', icon: '🌐' },
    { group: 'Frequently Used', className: 'Model', icon: '🧩' },
    { group: '3D Interfaces', className: 'ClickDetector', icon: '🔵' },
    { group: '3D Interfaces', className: 'Decal', icon: '🖼️' },
    { group: '3D Interfaces', className: 'Dialog', icon: '💬' },
    { group: '3D Interfaces', className: 'DialogChoice', icon: '🗨️' },
    { group: '3D Interfaces', className: 'DragDetector', icon: '🧲' },
    { group: '3D Interfaces', className: 'MaterialVariant', icon: '🎨' },
    { group: '3D Interfaces', className: 'ProximityPrompt', icon: '📋' },
    { group: '3D Interfaces', className: 'SurfaceAppearance', icon: '🔷' },
];

function renderWorkspaceExtras() {
    const el = document.getElementById('workspaceExtras');
    if (!el) return;
    el.innerHTML = '';
    extraInstances.forEach((inst) => {
        const li = document.createElement('li');
        li.innerHTML = `${inst.icon} ${inst.name}`;
        li.dataset.extraId = inst.id;

        li.ondblclick = () => {
            const newName = prompt('Rename ' + inst.className + ':', inst.name);
            if (newName) {
                inst.name = newName;
                renderWorkspaceExtras();
            }
        };

        li.onclick = (e) => {
            e.stopPropagation();
            selectObject(null);
            document.querySelectorAll('#workspaceExtras li').forEach(n => n.classList.remove('selected'));
            li.classList.add('selected');
        };

        li.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, buildExtraContextMenuItems(inst));
        };

        el.appendChild(li);
    });
}

function addInstance(className) {
    if (className === 'Part') {
        closeInsertMenu();
        createNewPart('Part');
        return;
    }
    if (className === 'MeshPart') {
        closeInsertMenu();
        document.getElementById('fileInput').click();
        showToast('Choose a glTF/OBJ/rbxlx file to insert as a MeshPart', 'info');
        return;
    }

    const meta = INSERTABLE_TYPES.find(t => t.className === className);
    const inst = {
        id: 'inst_' + (extraIdCounter++),
        className,
        name: className,
        icon: meta ? meta.icon : '🧩',
    };
    extraInstances.push(inst);
    renderWorkspaceExtras();
    closeInsertMenu();
    statusEl.textContent = `➕ Inserted ${className} into Workspace.`;
    showToast(`Inserted ${className}`, 'success');
}

// ============================================================
// CONTEXT MENU
// ============================================================
function showContextMenu(x, y, items) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    menu.innerHTML = '';
    items.forEach((it) => {
        if (it.sep) {
            const li = document.createElement('li');
            li.className = 'context-menu-sep';
            menu.appendChild(li);
            return;
        }
        const li = document.createElement('li');
        if (it.danger) li.classList.add('danger');
        li.innerHTML = `<span>${it.icon || ''}</span><span>${it.label}</span>`;
        li.onclick = (e) => { e.stopPropagation(); hideContextMenu(); it.onClick(); };
        menu.appendChild(li);
    });
    menu.style.display = 'flex';
    const menuW = 200;
    const left = Math.min(x, window.innerWidth - menuW - 10);
    const top = Math.min(y, window.innerHeight - (items.length * 34 + 20));
    menu.style.left = Math.max(left, 10) + 'px';
    menu.style.top = Math.max(top, 10) + 'px';
    menu.style.zIndex = 210;
}

function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) menu.style.display = 'none';
}

function buildPartContextMenuItems(obj) {
    return [
        { label: 'Rename', icon: '✏️', onClick: () => {
            const newName = prompt('Rename Part:', obj.userData.partName || 'Part');
            if (newName) { obj.userData.partName = newName; updateExplorer(currentGroup); }
        } },
        { label: 'Duplicate', icon: '📑', onClick: () => duplicatePart(obj) },
        { sep: true },
        { label: 'Save', icon: '💾', onClick: () => saveObjectLocally(obj) },
        { label: 'Export', icon: '📦', onClick: () => exportObjectAsJSON(obj) },
        { sep: true },
        { label: 'Save to Vodevs', icon: '🧩', onClick: () => saveToVodevs(obj) },
        { sep: true },
        { label: 'Delete', icon: '🗑️', danger: true, onClick: () => { selectObject(obj); deleteSelected(); } },
    ];
}

function buildExtraContextMenuItems(inst) {
    return [
        { label: 'Rename', icon: '✏️', onClick: () => {
            const newName = prompt('Rename ' + inst.className + ':', inst.name);
            if (newName) { inst.name = newName; renderWorkspaceExtras(); }
        } },
        { sep: true },
        { label: 'Save', icon: '💾', onClick: () => saveObjectLocally(inst) },
        { label: 'Export', icon: '📦', onClick: () => exportObjectAsJSON(inst) },
        { sep: true },
        { label: 'Save to Vodevs', icon: '🧩', onClick: () => saveToVodevs(inst) },
        { sep: true },
        { label: 'Delete', icon: '🗑️', danger: true, onClick: () => {
            extraInstances = extraInstances.filter(i => i.id !== inst.id);
            renderWorkspaceExtras();
        } },
    ];
}

// ============================================================
// TOOLBOX
// ============================================================
function loadVodevsLibrary() {
    try {
        const raw = localStorage.getItem(VODEVS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveVodevsLibrary(list) {
    try {
        localStorage.setItem(VODEVS_KEY, JSON.stringify(list));
    } catch (e) {
        showToast('Could not save: ' + e.message, 'error');
    }
}

function buildAssetEntry(source, name) {
    if (source.isMesh) {
        ensurePartDefaults(source);
        const box = new THREE.Box3().setFromObject(source);
        const size = new THREE.Vector3();
        box.getSize(size);
        const color = (source.material && source.material.color) ? source.material.color.getHex() : 0x888888;
        return {
            name,
            kind: 'part',
            className: source.userData.className || 'Part',
            size: { x: size.x || 1, y: size.y || 1, z: size.z || 1 },
            color,
            material: source.userData.material,
            anchored: source.userData.anchored,
            canCollide: source.userData.canCollide,
            truss: source.userData.truss,
            textures: source.userData.textures || [],
        };
    }
    return { name, kind: 'instance', className: source.className, icon: source.icon };
}

function publishAsset(source, isPrivate) {
    const name = prompt(isPrivate ? 'Save as:' : 'Save to Vodevs as:', (source.userData && source.userData.partName) || source.name || 'Asset');
    if (!name) return;

    const entry = buildAssetEntry(source, name);
    entry.id = 'vodevs_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    entry.author = 'You';
    entry.private = !!isPrivate;
    entry.savedAt = Date.now();

    const lib = loadVodevsLibrary();
    lib.unshift(entry);
    saveVodevsLibrary(lib);
    renderToolbox();

    if (isPrivate) {
        statusEl.textContent = `💾 Saved "${name}" — see it under Toolbox → My Assets.`;
        showToast(`Saved "${name}"`, 'success');
    } else {
        statusEl.textContent = `🧩 Published "${name}" to Vodevs — everyone can now insert it from the Toolbox.`;
        showToast(`Saved "${name}" to Vodevs`, 'success');
    }
}

function saveToVodevs(source) { publishAsset(source, false); }
function saveObjectLocally(source) { publishAsset(source, true); }

function insertFromVodevs(entry) {
    if (!currentGroup) {
        currentGroup = new THREE.Group();
        scene.add(currentGroup);
    }
    if (entry.kind === 'part') {
        const part = new THREE.Mesh(
            new THREE.BoxGeometry(entry.size.x, entry.size.y, entry.size.z),
            new THREE.MeshStandardMaterial({ color: entry.color })
        );
        part.position.set(0, entry.size.y / 2, 0);
        part.castShadow = true;
        part.receiveShadow = true;
        part.userData.className = entry.className || 'Part';
        part.userData.partName = entry.name;
        part.userData.material = entry.material;
        part.userData.anchored = entry.anchored;
        part.userData.canCollide = entry.canCollide;
        part.userData.truss = entry.truss;
        part.userData.textures = entry.textures ? JSON.parse(JSON.stringify(entry.textures)) : [];
        currentGroup.add(part);
        updateExplorer(currentGroup);
        selectObject(part);
        statusEl.textContent = `📥 Inserted "${entry.name}" from Vodevs.`;
        showToast(`Inserted "${entry.name}"`, 'success');
    } else if (entry.kind === 'model') {
        entry.parts.forEach((p) => {
            const part = new THREE.Mesh(
                new THREE.BoxGeometry(p.size.x, p.size.y, p.size.z),
                new THREE.MeshStandardMaterial({ color: p.color })
            );
            part.position.set(p.position.x, p.position.y, p.position.z);
            part.castShadow = true;
            part.receiveShadow = true;
            part.userData.className = 'Part';
            part.userData.partName = p.name;
            part.userData.material = p.material;
            part.userData.anchored = p.anchored;
            part.userData.canCollide = p.canCollide;
            part.userData.truss = p.truss;
            part.userData.textures = [];
            currentGroup.add(part);
        });
        updateExplorer(currentGroup);
        statusEl.textContent = `📥 Inserted model "${entry.name}" (${entry.parts.length} parts) from Vodevs.`;
        showToast(`Inserted "${entry.name}"`, 'success');
    } else {
        const inst = { id: 'inst_' + (extraIdCounter++), className: entry.className, name: entry.name, icon: entry.icon || '🧩' };
        extraInstances.push(inst);
        renderWorkspaceExtras();
        statusEl.textContent = `📥 Inserted "${entry.name}" from Vodevs.`;
        showToast(`Inserted "${entry.name}"`, 'success');
    }
}

function renderToolbox(filter) {
    if (!filter) filter = document.getElementById('toolboxSearch')?.value || '';
    const term = filter.trim().toLowerCase();
    const activeTab = document.querySelector('.toolbox-tab.active')?.dataset.tab || 'store';
    const activeCat = document.querySelector('.chip.active')?.dataset.cat || 'all';
    const lib = loadVodevsLibrary();
    const entries = lib.filter(e => activeTab === 'mine' ? e.author === 'You' : !e.private);
    const filtered = entries.filter(e => {
        if (activeCat !== 'all') {
            const cat = e.kind === 'model' ? 'model' : e.kind === 'part' ? 'part' : 'instance';
            if (cat !== activeCat) return false;
        }
        return e.name.toLowerCase().includes(term);
    });

    const list = document.getElementById('toolboxList');
    const empty = document.getElementById('toolboxEmpty');
    if (!list) return;
    list.innerHTML = '';
    if (filtered.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    filtered.forEach((entry) => {
        const li = document.createElement('li');
        li.className = 'vodevs-item';
        const icon = entry.kind === 'model' ? '🧩' : entry.kind === 'part' ? '📦' : (entry.icon || '🧩');
        const visibility = entry.private ? 'Private' : 'Vodevs';
        const metaText = entry.kind === 'model'
            ? `Model · ${entry.parts.length} parts · ${visibility}`
            : `${entry.className || 'Part'} · ${visibility}`;
        li.innerHTML = `
            <div class="vi-icon">${icon}</div>
            <div class="vi-info">
                <div class="vi-name">${entry.name}</div>
                <div class="vi-meta">${metaText}</div>
            </div>
            <div class="vi-actions">
                <button class="vi-insert">Insert</button>
            </div>
        `;
        li.querySelector('.vi-insert').onclick = (e) => { e.stopPropagation(); insertFromVodevs(entry); };
        li.onclick = () => openToolboxDetail(entry);
        list.appendChild(li);
    });
}

function openToolboxDetail(entry) {
    const browse = document.getElementById('toolboxBrowse');
    const detail = document.getElementById('toolboxDetail');
    if (!browse || !detail) return;
    browse.style.display = 'none';
    detail.style.display = 'flex';
    document.getElementById('toolboxDetailIcon').textContent = entry.kind === 'model' ? '🧩' : entry.kind === 'part' ? '📦' : (entry.icon || '🧩');
    document.getElementById('toolboxDetailName').textContent = entry.name;
    document.getElementById('toolboxDetailMeta').textContent = `By @${(entry.author || 'You').toLowerCase()} · ${entry.private ? 'Private' : 'Published to Vodevs'}`;
    document.getElementById('toolboxDetailInsert').onclick = () => insertFromVodevs(entry);
    document.getElementById('toolboxDetailRemove').style.display = entry.author === 'You' ? '' : 'none';
    document.getElementById('toolboxDetailRemove').onclick = () => removeFromVodevs(entry.id);
}

function closeToolboxDetail() {
    const browse = document.getElementById('toolboxBrowse');
    const detail = document.getElementById('toolboxDetail');
    if (browse) browse.style.display = 'block';
    if (detail) detail.style.display = 'none';
}

function removeFromVodevs(id) {
    if (!confirm('Remove this asset?')) return;
    const lib = loadVodevsLibrary().filter(e => e.id !== id);
    saveVodevsLibrary(lib);
    renderToolbox();
    closeToolboxDetail();
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const message = document.getElementById('toastMessage');
    if (!toast) return;
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
    icon.textContent = icons[type] || 'ℹ️';
    message.textContent = msg;
    toast.className = 'toast show ' + type;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============================================================
// PART CREATION & DUPLICATION
// ============================================================
function createNewPart(name) {
    const part = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1, 4),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    part.position.set(0, 0.5, 0);
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData.className = 'Part';
    part.userData.partName = name || 'Part';
    ensurePartDefaults(part);

    if (!currentGroup) {
        currentGroup = new THREE.Group();
        scene.add(currentGroup);
    }
    currentGroup.add(part);
    updateExplorer(currentGroup);
    selectObject(part);
    statusEl.textContent = `➕ Added ${part.userData.partName}.`;
    return part;
}

function duplicatePart(obj) {
    if (!obj || !currentGroup) return null;
    const clone = obj.clone();
    clone.geometry = obj.geometry.clone();
    clone.material = Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone();
    clone.userData = JSON.parse(JSON.stringify(obj.userData));
    clone.position.copy(obj.position).add(new THREE.Vector3(1, 0, 1));
    currentGroup.add(clone);
    updateExplorer(currentGroup);
    selectObject(clone);
    statusEl.textContent = `📑 Duplicated ${clone.userData.partName || 'Part'}.`;
    return clone;
}

// ============================================================
// FILE LOADING
// ============================================================
function loadModelFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    clearModel();
    statusEl.textContent = `⏳ Loading ${file.name} ...`;
    fileNameEl.textContent = file.name;

    const onLoad = (group) => {
        const wedgesFound = processWedgesInGroup(group);
        scene.add(group);
        currentGroup = group;
        updateExplorer(group);
        statusEl.textContent = `✅ Loaded ${file.name} (${group.children.length} part${group.children.length === 1 ? '' : 's'})${wedgesFound > 0 ? ` — Decomposed ${wedgesFound} wedge${wedgesFound > 1 ? 's' : ''}` : ''}`;
        selectObject(null);
    };

    if (ext === 'gltf' || ext === 'glb') {
        const url = URL.createObjectURL(file);
        new GLTFLoader().load(url, (gltf) => {
            const group = new THREE.Group();
            const meshCount = flattenMeshesIntoGroup(gltf.scene, group);
            if (meshCount === 0) {
                statusEl.textContent = `⚠️ No meshes found in glTF.`;
                URL.revokeObjectURL(url);
                return;
            }
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 5) {
                const scale = 4 / maxDim;
                group.scale.set(scale, scale, scale);
            } else if (maxDim < 0.5) {
                const scale = 2 / maxDim;
                group.scale.set(scale, scale, scale);
            }
            const center = new THREE.Vector3();
            box.getCenter(center);
            group.position.sub(center);
            onLoad(group);
            URL.revokeObjectURL(url);
        }, undefined, (error) => {
            statusEl.textContent = `❌ Error loading glTF`;
            console.error(error);
        });
    } else if (ext === 'obj') {
        reader.onload = (e) => {
            try {
                const obj = new OBJLoader().parse(e.target.result);
                const group = new THREE.Group();
                const meshCount = flattenMeshesIntoGroup(obj, group);
                if (meshCount === 0) {
                    statusEl.textContent = `⚠️ No meshes found in OBJ.`;
                    return;
                }
                const box = new THREE.Box3().setFromObject(group);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 5) {
                    const scale = 4 / maxDim;
                    group.scale.set(scale, scale, scale);
                } else if (maxDim < 0.5 && maxDim > 0.01) {
                    const scale = 2 / maxDim;
                    group.scale.set(scale, scale, scale);
                }
                const center = new THREE.Vector3();
                box.getCenter(center);
                group.position.sub(center);
                onLoad(group);
            } catch (err) {
                statusEl.textContent = `❌ Error parsing OBJ`;
                console.error(err);
            }
        };
        reader.readAsText(file);
    } else if (ext === 'xml' || ext === 'rbxlx' || ext === 'rbxmx') {
        reader.onload = (e) => {
            try {
                const group = parseRobloxXML(e.target.result);
                if (group.children.length === 0) {
                    statusEl.textContent = `⚠️ No supported parts found in ${ext.toUpperCase()}.`;
                    return;
                }
                onLoad(group);
            } catch (err) {
                statusEl.textContent = `❌ Error parsing ${ext.toUpperCase()}`;
                console.error(err);
            }
        };
        reader.readAsText(file);
    } else if (ext === 'rbxl' || ext === 'rbxm') {
        statusEl.textContent = `⚠️ .${ext} is Roblox's binary format — not readable here.`;
        showToast(`.${ext} is Roblox's binary format. Use File → Save As → .${ext === 'rbxl' ? 'rbxlx' : 'rbxmx'} (XML) in Studio.`, 'warn');
    } else {
        statusEl.textContent = `❌ Unsupported file type: ${ext}`;
    }
}

function clearModel() {
    if (currentGroup) {
        scene.remove(currentGroup);
        currentGroup.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
        currentGroup = null;
    }
    selectObject(null);
    fileNameEl.textContent = 'No file selected';
    document.getElementById('fileInput').value = '';
    updateExplorer(null);
    statusEl.textContent = '🗑️ Model cleared';
}

// ============================================================
// WEDGE PROCESSING
// ============================================================
function getLocalTriangles(mesh) {
    const geo = mesh.geometry;
    const posAttr = geo && geo.getAttribute('position');
    if (!posAttr) return [];
    const index = geo.index ? geo.index.array : null;
    const triCount = index ? Math.floor(index.length / 3) : Math.floor(posAttr.count / 3);
    const tris = [];
    for (let i = 0; i < triCount; i++) {
        const ia = index ? index[i * 3] : i * 3;
        const ib = index ? index[i * 3 + 1] : i * 3 + 1;
        const ic = index ? index[i * 3 + 2] : i * 3 + 2;
        const a = new THREE.Vector3().fromBufferAttribute(posAttr, ia);
        const b = new THREE.Vector3().fromBufferAttribute(posAttr, ib);
        const c = new THREE.Vector3().fromBufferAttribute(posAttr, ic);
        const cross = b.clone().sub(a).cross(c.clone().sub(a));
        const area = cross.length() * 0.5;
        if (area < 1e-9) continue;
        tris.push({ normal: cross.normalize(), area });
    }
    return tris;
}

function clusterNormals(triangles, angleTolDeg = 6) {
    const tol = Math.cos(THREE.MathUtils.degToRad(angleTolDeg));
    const clusters = [];
    for (const t of triangles) {
        let match = null;
        for (const c of clusters) {
            if (c.avg.dot(t.normal) > tol) { match = c; break; }
        }
        if (match) {
            match.sum.addScaledVector(t.normal, t.area);
            match.area += t.area;
            match.avg = match.sum.clone().normalize();
        } else {
            clusters.push({ sum: t.normal.clone().multiplyScalar(t.area), avg: t.normal.clone(), area: t.area });
        }
    }
    clusters.sort((a, b) => b.area - a.area);
    return clusters;
}

function classifyWedge(mesh) {
    if (!mesh.geometry) return null;
    const triangles = getLocalTriangles(mesh);
    if (triangles.length === 0 || triangles.length > 60) return null;
    const totalArea = triangles.reduce((s, t) => s + t.area, 0);
    if (totalArea < 1e-6) return null;
    const clusters = clusterNormals(triangles, 6);
    if (clusters.length > 10) return null;
    const slopeClusters = clusters.filter(c => Math.abs(c.avg.y) > 0.15 && Math.abs(c.avg.y) < 0.94);
    if (slopeClusters.length === 0) return null;
    const dominant = slopeClusters[0];
    const dominantFrac = dominant.area / totalArea;
    const otherSlopeArea = slopeClusters.slice(1).reduce((s, c) => s + c.area, 0);
    if (dominantFrac < 0.12) return null;
    if (otherSlopeArea > dominant.area * 0.5) return null;
    const nx = dominant.avg.x, nz = dominant.avg.z;
    if (Math.hypot(nx, nz) < 1e-4) return null;
    const axisMode = (Math.abs(nx) > 0.3 && Math.abs(nz) > 0.3) ? 'corner'
        : (Math.abs(nx) >= Math.abs(nz) ? 'x' : 'z');
    return { axisMode };
}

const _slopeRaycaster = new THREE.Raycaster();
const _slopeDownDir = new THREE.Vector3(0, -1, 0);

function sampleLocalTopY(localMesh, x, z, rayStartY) {
    _slopeRaycaster.set(new THREE.Vector3(x, rayStartY, z), _slopeDownDir);
    _slopeRaycaster.far = rayStartY * 2 + 1000;
    const hits = _slopeRaycaster.intersectObject(localMesh, false);
    return hits.length > 0 ? hits[0].point.y : null;
}

function decomposeMeshIntoSlices(mesh, slices = 6, classification = null) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const localBox = mesh.geometry.boundingBox;
    const localSize = new THREE.Vector3();
    localBox.getSize(localSize);
    if (localSize.x < 1e-6 || localSize.y < 1e-6 || localSize.z < 1e-6) return [];
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.matrixWorld.decompose(pos, quat, scale);
    const cls = classification || classifyWedge(mesh) || { axisMode: 'z' };
    const localMesh = new THREE.Mesh(mesh.geometry);
    const rayStartY = localBox.max.y + Math.max(localSize.y, 1) * 0.5 + 0.5;
    const color = (mesh.material && mesh.material.color) ? mesh.material.color.getHex() : 0xcccccc;
    const materialName = mesh.userData.material || 'Plastic';
    const anchored = mesh.userData.anchored !== false;
    const canCollide = mesh.userData.canCollide !== false;
    const baseName = mesh.userData.partName || 'Wedge';
    const MIN_HEIGHT = Math.max(localSize.y * 0.01, 0.001);
    const parts = [];
    let idx = 0;
    function makeBox(localCenter, size) {
        if (size.y < MIN_HEIGHT || size.x < 1e-6 || size.z < 1e-6) return;
        const worldPos = localCenter.clone().applyQuaternion(quat).add(pos);
        const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
        const part = new THREE.Mesh(geo, mat);
        part.position.copy(worldPos);
        part.quaternion.copy(quat);
        part.castShadow = true;
        part.receiveShadow = true;
        idx++;
        part.userData.className = 'Part';
        part.userData.sourceShape = 'DecomposedWedge';
        part.userData.partName = `${baseName}_slice${idx}`;
        part.userData.material = materialName;
        part.userData.anchored = anchored;
        part.userData.canCollide = canCollide;
        part.userData.truss = false;
        part.userData.textures = [];
        parts.push(part);
    }
    if (cls.axisMode === 'corner') {
        const cellX = localSize.x / slices;
        const cellZ = localSize.z / slices;
        for (let i = 0; i < slices; i++) {
            for (let j = 0; j < slices; j++) {
                const cx = localBox.min.x + cellX * (i + 0.5);
                const cz = localBox.min.z + cellZ * (j + 0.5);
                const topY = sampleLocalTopY(localMesh, cx, cz, rayStartY);
                if (topY === null) continue;
                const height = topY - localBox.min.y;
                if (height < MIN_HEIGHT) continue;
                makeBox(new THREE.Vector3(cx, localBox.min.y + height / 2, cz),
                    new THREE.Vector3(cellX * scale.x, height * scale.y, cellZ * scale.z));
            }
        }
    } else {
        const along = cls.axisMode;
        const step = along === 'x' ? localSize.x / slices : localSize.z / slices;
        const otherSize = along === 'x' ? localSize.z : localSize.x;
        for (let i = 0; i < slices; i++) {
            const centerAlong = (along === 'x' ? localBox.min.x : localBox.min.z) + step * (i + 0.5);
            const cx = along === 'x' ? centerAlong : (localBox.min.x + localSize.x / 2);
            const cz = along === 'x' ? (localBox.min.z + localSize.z / 2) : centerAlong;
            const topY = sampleLocalTopY(localMesh, cx, cz, rayStartY);
            if (topY === null) continue;
            const height = topY - localBox.min.y;
            if (height < MIN_HEIGHT) continue;
            const size = along === 'x'
                ? new THREE.Vector3(step * scale.x, height * scale.y, otherSize * scale.z)
                : new THREE.Vector3(otherSize * scale.x, height * scale.y, step * scale.z);
            makeBox(new THREE.Vector3(cx, localBox.min.y + height / 2, cz), size);
        }
    }
    return parts;
}

function processWedgesInGroup(group) {
    const slices = Math.max(2, parseInt(document.getElementById('wedgeSteps')?.value, 10) || 6);
    const meshesToProcess = [];
    group.traverse((child) => {
        if (child.isMesh) meshesToProcess.push(child);
    });
    let decomposedCount = 0;
    meshesToProcess.forEach((mesh) => {
        const classification = classifyWedge(mesh);
        if (!classification) return;
        const parts = decomposeMeshIntoSlices(mesh, slices, classification);
        if (parts.length > 0) {
            group.remove(mesh);
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
            else mesh.material.dispose();
            parts.forEach(p => group.add(p));
            decomposedCount++;
        }
    });
    return decomposedCount;
}

// ============================================================
// ROBLOX XML PARSER
// ============================================================
function parseRobloxXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.getElementsByTagName('Item');
    const meshes = [];

    function getVector3(properties, name) {
        const vecNode = properties.querySelector(`[name="${name}"]`);
        if (!vecNode) return new THREE.Vector3(1, 1, 1);
        const x = parseFloat(vecNode.querySelector('X')?.textContent || 1);
        const y = parseFloat(vecNode.querySelector('Y')?.textContent || 1);
        const z = parseFloat(vecNode.querySelector('Z')?.textContent || 1);
        return new THREE.Vector3(x, y, z);
    }

    function getCFrame(properties, name) {
        const cfNode = properties.querySelector(`[name="${name}"]`);
        if (!cfNode) return { pos: new THREE.Vector3(0,0,0), rot: new THREE.Quaternion() };
        const x = parseFloat(cfNode.querySelector('X')?.textContent || 0);
        const y = parseFloat(cfNode.querySelector('Y')?.textContent || 0);
        const z = parseFloat(cfNode.querySelector('Z')?.textContent || 0);
        const r00 = parseFloat(cfNode.querySelector('R00')?.textContent || 1);
        const r01 = parseFloat(cfNode.querySelector('R01')?.textContent || 0);
        const r02 = parseFloat(cfNode.querySelector('R02')?.textContent || 0);
        const r10 = parseFloat(cfNode.querySelector('R10')?.textContent || 0);
        const r11 = parseFloat(cfNode.querySelector('R11')?.textContent || 1);
        const r12 = parseFloat(cfNode.querySelector('R12')?.textContent || 0);
        const r20 = parseFloat(cfNode.querySelector('R20')?.textContent || 0);
        const r21 = parseFloat(cfNode.querySelector('R21')?.textContent || 0);
        const r22 = parseFloat(cfNode.querySelector('R22')?.textContent || 1);
        const matrix = new THREE.Matrix4();
        matrix.set(r00, r01, r02, x, r10, r11, r12, y, r20, r21, r22, z, 0, 0, 0, 1);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(pos, quat, scale);
        return { pos, rot: quat };
    }

    function getColor(properties) {
        const colorNode = properties.querySelector('[name="Color3uint8"]');
        if (!colorNode) return 0xcccccc;
        const val = parseInt(colorNode.textContent);
        const r = (val >> 16) & 0xFF;
        const g = (val >> 8) & 0xFF;
        const b = val & 0xFF;
        return (r << 16) | (g << 8) | b;
    }

    function getBool(properties, name, fallback) {
        const node = properties.querySelector(`bool[name="${name}"]`);
        if (!node) return fallback;
        return node.textContent.trim().toLowerCase() === 'true';
    }

    function getVortexMaterial(properties) {
        const node = properties.querySelector('token[name="Material"], string[name="Material"]');
        const raw = (node ? node.textContent : '').trim();
        const map = {
            Wood: 'Wood', WoodPlanks: 'Wood',
            Metal: 'Metal', DiamondPlate: 'Metal', CorrodedMetal: 'Metal', Foil: 'Metal',
            Grass: 'Grass', LeafyGrass: 'Grass', Ground: 'Grass',
            Ice: 'Ice', Glacier: 'Ice',
            SmoothPlastic: 'Paint', Neon: 'Paint',
        };
        return map[raw] || 'Plastic';
    }

    const supportedParts = ['Part', 'WedgePart', 'CornerWedgePart', 'Seat', 'VehicleSeat', 'SpawnLocation', 'TrussPart'];

    for (let item of items) {
        const className = item.getAttribute('class');
        const properties = item.querySelector('Properties');
        const nameNode = properties?.querySelector('string[name="Name"]');
        const partName = nameNode ? nameNode.textContent : className;

        if (!properties) continue;
        if (!supportedParts.includes(className)) continue;
        if (className === 'MeshPart') {
            console.log(`Skipping MeshPart "${partName}" - geometry is encrypted/binary`);
            continue;
        }

        const size = getVector3(properties, 'Size');
        const cf = getCFrame(properties, 'CFrame');
        const color = getColor(properties);
        const material = getVortexMaterial(properties);
        const anchored = getBool(properties, 'Anchored', true);
        const canCollide = getBool(properties, 'CanCollide', true);

        if (className === 'WedgePart' || className === 'CornerWedgePart') {
            const sliceCount = Math.max(2, parseInt(document.getElementById('wedgeSteps')?.value, 10) || 6);
            const stepDefs = className === 'WedgePart'
                ? buildWedgeSteps(size, sliceCount)
                : buildCornerWedgeSteps(size, sliceCount);
            stepDefs.forEach((step, i) => {
                const worldPos = stepOffsetToWorld(step.offset, cf);
                const geometry = new THREE.BoxGeometry(step.size.x, step.size.y, step.size.z);
                const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.1 });
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.position.copy(worldPos);
                mesh.quaternion.copy(cf.rot);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.className = 'Part';
                mesh.userData.sourceShape = className;
                mesh.userData.partName = `${partName}_slice${i + 1}`;
                mesh.userData.material = material;
                mesh.userData.anchored = anchored;
                mesh.userData.canCollide = canCollide;
                mesh.userData.truss = false;
                mesh.userData.textures = [];
                meshes.push(mesh);
            });
            continue;
        }

        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.1 });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.copy(cf.pos);
        mesh.quaternion.copy(cf.rot);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.className = className;
        mesh.userData.partName = partName;
        mesh.userData.material = material;
        mesh.userData.anchored = anchored;
        mesh.userData.canCollide = canCollide;
        mesh.userData.truss = className === 'TrussPart';
        mesh.userData.textures = [];
        meshes.push(mesh);
    }

    const group = new THREE.Group();
    meshes.forEach(m => group.add(m));
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 15) {
        const scale = 10 / maxDim;
        group.scale.set(scale, scale, scale);
    }
    return group;
}

function buildWedgeSteps(size, steps) {
    const out = [];
    const stepDepth = size.z / steps;
    for (let i = 0; i < steps; i++) {
        const stepHeight = size.y * (steps - i) / steps;
        if (stepHeight <= 0) continue;
        const localZ = -size.z / 2 + stepDepth * (i + 0.5);
        const localY = -size.y / 2 + stepHeight / 2;
        out.push({
            size: { x: size.x, y: stepHeight, z: stepDepth },
            offset: { x: 0, y: localY, z: localZ }
        });
    }
    return out;
}

function buildCornerWedgeSteps(size, steps) {
    const out = [];
    const cellX = size.x / steps;
    const cellZ = size.z / steps;
    for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
            if (i + j >= steps) continue;
            const stepHeight = size.y * (steps - (i + j)) / steps;
            if (stepHeight <= 0) continue;
            const localX = -size.x / 2 + cellX * (i + 0.5);
            const localZ = -size.z / 2 + cellZ * (j + 0.5);
            const localY = -size.y / 2 + stepHeight / 2;
            out.push({
                size: { x: cellX, y: stepHeight, z: cellZ },
                offset: { x: localX, y: localY, z: localZ }
            });
        }
    }
    return out;
}

function stepOffsetToWorld(offset, cf) {
    const v = new THREE.Vector3(offset.x, offset.y, offset.z);
    v.applyQuaternion(cf.rot);
    v.add(cf.pos);
    return v;
}

function flattenMeshesIntoGroup(root, group) {
    root.updateWorldMatrix(true, true);
    const meshes = [];
    root.traverse((child) => {
        if (child.isMesh) meshes.push(child);
    });
    meshes.forEach((mesh, i) => {
        mesh.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        mesh.matrixWorld.decompose(pos, quat, scale);
        mesh.position.copy(pos);
        mesh.quaternion.copy(quat);
        mesh.scale.copy(scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.className = 'MeshPart';
        mesh.userData.partName = mesh.name && mesh.name.trim() ? mesh.name : `MeshPart_${i + 1}`;
        ensurePartDefaults(mesh);
        group.add(mesh);
    });
    return meshes.length;
}

// ============================================================
// EXPORT
// ============================================================
function generateProjectId() {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * 16)];
    return id;
}

function downloadJSON(filename, dataObj) {
    try {
        const jsonString = JSON.stringify(dataObj, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return true;
    } catch (e) {
        showToast('Export failed: ' + e.message, 'error');
        return false;
    }
}

function exportObjectAsJSON(source) {
    const name = (source.userData && source.userData.partName) || source.name || 'Object';
    let data;
    if (source.isMesh) {
        ensurePartDefaults(source);
        source.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        source.matrixWorld.decompose(worldPos, worldQuat, worldScale);
        let size = new THREE.Vector3(1, 1, 1);
        if (source.geometry) {
            if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
            source.geometry.boundingBox.getSize(size);
            size.set(
                Math.abs(size.x * worldScale.x) || 1,
                Math.abs(size.y * worldScale.y) || 1,
                Math.abs(size.z * worldScale.z) || 1
            );
        }
        const color = (source.material && source.material.color) ? source.material.color : { r: 0.6, g: 0.6, b: 0.6 };
        const opacity = (source.material && source.material.opacity !== undefined) ? source.material.opacity : 1;
        data = {
            name,
            className: source.userData.className || 'Part',
            position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
            rotation: { x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w },
            scale: { x: size.x, y: size.y, z: size.z },
            color: { r: color.r, g: color.g, b: color.b, a: opacity },
            material: source.userData.material,
            anchored: source.userData.anchored,
            can_collide: source.userData.canCollide,
            truss: source.userData.truss,
            textures: (source.userData.textures || []).map(t => ({ face: t.face, texture: t.texture })),
        };
    } else {
        data = { name, className: source.className };
    }
    const filename = name.replace(/[^a-z0-9_\-]+/gi, '_') + '.json';
    if (downloadJSON(filename, data)) {
        statusEl.textContent = `📦 Exported "${name}" to ${filename}`;
        showToast('Exported ' + filename, 'success');
    }
}

function exportSceneToVortexJSON() {
    if (!currentGroup || currentGroup.children.length === 0) {
        showToast('Nothing to export — add or import a part first', 'warn');
        statusEl.textContent = '⚠️ Nothing to export.';
        return;
    }
    const parts = currentGroup.children.map((obj, index) => {
        obj.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        obj.matrixWorld.decompose(worldPos, worldQuat, worldScale);
        let size = new THREE.Vector3(1, 1, 1);
        if (obj.geometry) {
            if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
            obj.geometry.boundingBox.getSize(size);
            size.set(
                Math.abs(size.x * worldScale.x) || 1,
                Math.abs(size.y * worldScale.y) || 1,
                Math.abs(size.z * worldScale.z) || 1
            );
        }
        const color = (obj.material && obj.material.color) ? obj.material.color : { r: 0.6, g: 0.6, b: 0.6 };
        const opacity = (obj.material && obj.material.opacity !== undefined) ? obj.material.opacity : 1;
        ensurePartDefaults(obj);
        return {
            name: obj.userData.partName || obj.userData.className || ('Part_' + index),
            position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
            rotation: { x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w },
            scale: { x: size.x, y: size.y, z: size.z },
            color: { r: color.r, g: color.g, b: color.b, a: opacity },
            material: obj.userData.material,
            group: 0,
            anchored: obj.userData.anchored,
            can_collide: obj.userData.canCollide,
            truss: obj.userData.truss,
            textures: obj.userData.textures.map(t => ({ face: t.face, texture: t.texture })),
        };
    });
    const vortexJson = {
        project_id: generateProjectId(),
        parts: parts,
        lights: [],
        groups: [{ name: 'Group 0', parent_group: null }],
    };
    const baseName = (fileNameEl.textContent && fileNameEl.textContent !== 'No file selected')
        ? fileNameEl.textContent.replace(/\.[^.]+$/, '')
        : 'scene';
    const filename = baseName + '_vortex.json';
    try {
        const jsonString = JSON.stringify(vortexJson, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        statusEl.textContent = `📦 Exported ${parts.length} part${parts.length === 1 ? '' : 's'} to ${filename}`;
        showToast('Exported ' + filename, 'success');
    } catch (e) {
        statusEl.textContent = '❌ Export failed';
        showToast('Export failed: ' + e.message, 'error');
    }
}

// ============================================================
// INSERT MENU
// ============================================================
function renderInsertMenuList(filter = '') {
    const list = document.getElementById('insertObjectList');
    if (!list) return;
    list.innerHTML = '';
    const term = filter.trim().toLowerCase();
    let lastGroup = null;
    INSERTABLE_TYPES.filter(t => t.className.toLowerCase().includes(term)).forEach(t => {
        if (t.group !== lastGroup) {
            const label = document.createElement('div');
            label.className = 'floating-menu-group-label';
            label.textContent = t.group;
            list.appendChild(label);
            lastGroup = t.group;
        }
        const item = document.createElement('div');
        item.className = 'floating-menu-item';
        item.innerHTML = `<span class="fmi-icon">${t.icon}</span><span>${t.className}</span>`;
        item.onclick = () => addInstance(t.className);
        list.appendChild(item);
    });
}

function openInsertMenu(x, y) {
    renderInsertMenuList('');
    const search = document.getElementById('insertObjectSearch');
    const menu = document.getElementById('insertObjectMenu');
    if (!search || !menu) return;
    search.value = '';
    menu.style.display = 'flex';
    const menuW = 230;
    const left = Math.min(x, window.innerWidth - menuW - 10);
    const top = Math.min(y, window.innerHeight - 360);
    menu.style.left = left + 'px';
    menu.style.top = Math.max(top, 10) + 'px';
    search.focus();
}

function closeInsertMenu() {
    const menu = document.getElementById('insertObjectMenu');
    if (menu) menu.style.display = 'none';
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Alt') isAltPressed = true;
    if (e.key === '1') transformControls?.setMode('translate');
    if (e.key === '2') transformControls?.setMode('rotate');
    if (e.key === '3') transformControls?.setMode('scale');
    if (e.key.toLowerCase() === 'f' && selectedObject) {
        const box = new THREE.Box3().setFromObject(selectedObject);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = box.getSize(new THREE.Vector3()).length();
        orbitControls.target.copy(center);
        camera.position.copy(center.clone().add(new THREE.Vector3(size, size * 0.6, size)));
    }
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
    }
    if (e.key === 'Escape') {
        hideContextMenu();
        closeInsertMenu();
        closeCommandPalette();
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'Alt') isAltPressed = false;
});

// ============================================================
// COMMAND PALETTE
// ============================================================
const COMMANDS = [
    { label: 'Move Tool', action: () => transformControls?.setMode('translate') },
    { label: 'Rotate Tool', action: () => transformControls?.setMode('rotate') },
    { label: 'Scale Tool', action: () => transformControls?.setMode('scale') },
    { label: 'Insert Part', action: () => createNewPart('Part') },
    { label: 'Open Toolbox', action: () => dock.open('toolbox') },
    { label: 'Open Explorer', action: () => dock.open('explorer') },
    { label: 'Open Properties', action: () => dock.open('properties') },
    { label: 'Open Output', action: () => dock.open('output') },
    { label: 'Toggle Grid', action: () => { if (window.gridHelper) window.gridHelper.visible = !window.gridHelper.visible; } },
    { label: 'Reset Layout', action: () => dock.resetLayout() },
    { label: 'Save Project', action: () => exportSceneToVortexJSON() },
    { label: 'Clear Scene', action: () => clearModel() },
];

function toggleCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (!palette) return;
    if (palette.style.display === 'flex') {
        palette.style.display = 'none';
    } else {
        palette.style.display = 'flex';
        renderCommands('');
        document.getElementById('commandSearch')?.focus();
    }
}

function closeCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (palette) palette.style.display = 'none';
}

function renderCommands(filter = '') {
    const list = document.getElementById('commandList');
    if (!list) return;
    list.innerHTML = '';
    const term = filter.trim().toLowerCase();
    COMMANDS.filter(c => c.label.toLowerCase().includes(term)).forEach(c => {
        const item = document.createElement('div');
        item.className = 'floating-menu-item';
        item.textContent = c.label;
        item.onclick = () => {
            c.action();
            closeCommandPalette();
        };
        list.appendChild(item);
    });
}

// ============================================================
// UI EVENT BINDING
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files[0]) loadModelFile(e.target.files[0]);
    });

    document.getElementById('clearBtn').addEventListener('click', clearModel);
    document.getElementById('addPartBtn').addEventListener('click', () => createNewPart('Part'));
    document.getElementById('exportBtn').addEventListener('click', exportSceneToVortexJSON);

    document.getElementById('viewToggleExplorer').addEventListener('click', () => dock.toggle('explorer'));
    document.getElementById('viewToggleProperties').addEventListener('click', () => dock.toggle('properties'));
    document.getElementById('viewToggleToolbox').addEventListener('click', () => dock.toggle('toolbox'));
    document.getElementById('viewToggleOutput').addEventListener('click', () => dock.toggle('output'));
    document.getElementById('viewToggleScriptEditor').addEventListener('click', () => dock.toggle('scriptEditor'));
    document.getElementById('viewToggleGrid').addEventListener('click', () => {
        if (window.gridHelper) {
            window.gridHelper.visible = !window.gridHelper.visible;
            document.getElementById('viewToggleGrid').classList.toggle('active', window.gridHelper.visible);
        }
    });
    document.getElementById('resetLayoutBtn').addEventListener('click', () => dock.resetLayout());

    document.getElementById('toolboxBtn').addEventListener('click', () => dock.toggle('toolbox'));

    document.getElementById('playBtn').addEventListener('click', () => {
        showToast('Play mode isn\'t available in the web editor', 'warn');
    });

    document.getElementById('outputClear')?.addEventListener('click', () => {
        const list = document.getElementById('outputList');
        if (list) list.innerHTML = '';
    });

    document.getElementById('newScriptBtn')?.addEventListener('click', () => {
        showToast('New script created', 'info');
    });

    document.querySelectorAll('.ribbon-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ribbon-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ribbon-page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const page = document.querySelector(`.ribbon-page[data-ribbon-page="${btn.dataset.ribbon}"]`);
            if (page) page.classList.add('active');
            setTimeout(() => dock.updateViewport(), 100);
        });
    });

    document.querySelectorAll('[data-alias]').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById(btn.dataset.alias)?.click());
    });

    document.getElementById('workspaceAddBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = e.target.getBoundingClientRect();
        openInsertMenu(rect.left, rect.bottom + 6);
    });

    document.getElementById('workspaceNode').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, [
            { label: 'Insert Object...', icon: '➕', onClick: () => openInsertMenu(e.clientX, e.clientY) },
            { sep: true },
            { label: 'Export Scene JSON', icon: '📦', onClick: () => exportSceneToVortexJSON() },
            { sep: true },
            { label: 'Save Model to Vodevs', icon: '🧩', onClick: () => saveModelToVodevs() },
        ]);
    });

    document.getElementById('insertObjectSearch').addEventListener('input', () => renderInsertMenuList(document.getElementById('insertObjectSearch').value));

    document.querySelectorAll('.toolbox-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toolbox-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderToolbox();
            closeToolboxDetail();
        });
    });
    document.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderToolbox();
            closeToolboxDetail();
        });
    });
    document.getElementById('toolboxSearch').addEventListener('input', () => renderToolbox(document.getElementById('toolboxSearch').value));
    document.getElementById('toolboxDetailBack').addEventListener('click', closeToolboxDetail);

    document.getElementById('searchBox').addEventListener('input', () => updateExplorer(currentGroup));

    document.getElementById('commandSearch').addEventListener('input', () => renderCommands(document.getElementById('commandSearch').value));

    document.addEventListener('click', () => {
        hideContextMenu();
        closeInsertMenu();
    });
});

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    const speed = 0.08;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();

    if (keys['w']) {
        const v = forward.clone().multiplyScalar(speed);
        camera.position.add(v);
        orbitControls.target.add(v);
    }
    if (keys['s']) {
        const v = forward.clone().multiplyScalar(-speed);
        camera.position.add(v);
        orbitControls.target.add(v);
    }
    if (keys['a']) {
        const v = right.clone().multiplyScalar(-speed);
        camera.position.add(v);
        orbitControls.target.add(v);
    }
    if (keys['d']) {
        const v = right.clone().multiplyScalar(speed);
        camera.position.add(v);
        orbitControls.target.add(v);
    }
    if (keys['q']) {
        camera.position.y -= speed;
        orbitControls.target.y -= speed;
    }
    if (keys['e']) {
        camera.position.y += speed;
        orbitControls.target.y += speed;
    }

    if (selectionBox) selectionBox.update();
    orbitControls.update();
    renderer.render(scene, camera);

    const objCount = currentGroup ? currentGroup.children.length : 0;
    const statObj = document.getElementById('statObjectCount');
    const statSel = document.getElementById('statSelection');
    const statCam = document.getElementById('statCamPos');
    if (statObj) statObj.textContent = `${objCount} object${objCount === 1 ? '' : 's'}`;
    if (statSel) statSel.textContent = selectedObject
        ? (selectedObject.userData.partName || selectedObject.userData.className || 'Part')
        : 'No selection';
    if (statCam) statCam.textContent = `Cam: ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
}

// ============================================================
// SAVE MODEL TO VODEVS
// ============================================================
function saveModelToVodevs() {
    if (!currentGroup || currentGroup.children.length === 0) {
        showToast('Nothing to save — add or import a part first', 'warn');
        return;
    }
    const name = prompt('Save whole model to Vodevs as:', fileNameEl.textContent !== 'No file selected' ? fileNameEl.textContent.replace(/\.[^.]+$/, '') : 'Model');
    if (!name) return;
    const partsData = currentGroup.children.filter(c => c.isMesh).map((obj) => {
        ensurePartDefaults(obj);
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const color = (obj.material && obj.material.color) ? obj.material.color.getHex() : 0x888888;
        return {
            name: obj.userData.partName,
            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
            size: { x: size.x || 1, y: size.y || 1, z: size.z || 1 },
            color,
            material: obj.userData.material,
            anchored: obj.userData.anchored,
            canCollide: obj.userData.canCollide,
            truss: obj.userData.truss,
        };
    });
    const entry = {
        id: 'vodevs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name,
        kind: 'model',
        parts: partsData,
        author: 'You',
        private: false,
        savedAt: Date.now(),
    };
    const lib = loadVodevsLibrary();
    lib.unshift(entry);
    saveVodevsLibrary(lib);
    renderToolbox();
    statusEl.textContent = `🧩 Published model "${name}" to Vodevs (${partsData.length} parts).`;
    showToast(`Saved "${name}" to Vodevs`, 'success');
}

// ============================================================
// OUTPUT LOGGING
// ============================================================
function logOutput(message, type = 'info') {
    const list = document.getElementById('outputList');
    if (!list) return;
    const filter = document.getElementById('outputFilter');
    if (filter && filter.value !== 'all' && filter.value !== type) return;
    const entry = document.createElement('div');
    const icons = { info: 'ℹ️', warn: '⚠️', error: '❌' };
    const colors = { info: '#b0b3ba', warn: '#d2a021', error: '#d9534f' };
    entry.style.cssText = `padding:2px 0;color:${colors[type] || '#b0b3ba'};font-size:11px;`;
    entry.textContent = `${icons[type] || 'ℹ️'} ${message}`;
    list.appendChild(entry);
    list.scrollTop = list.scrollHeight;
}

const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;
console.log = (...args) => { origLog(...args); logOutput(args.join(' '), 'info'); };
console.warn = (...args) => { origWarn(...args); logOutput(args.join(' '), 'warn'); };
console.error = (...args) => { origError(...args); logOutput(args.join(' '), 'error'); };

statusEl.textContent = 'Ready. Drop rbxlx/rbxmx/XML, glTF, or OBJ.';
logOutput('Vodevs Studio initialized', 'info');
animate();
