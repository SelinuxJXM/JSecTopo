/* ============================================================
 * 等保拓扑绘图平台 - 主程序 v2
 * 依赖顺序：icons.js → schema.js → templates.js → report.js → app.js
 * ============================================================ */
(function () {
  'use strict';

  const ICONS = window.TopoIcons;
  const TPL = window.TopoTemplates;
  const SCHEMA = window.TopoSchema;
  const REPORT = window.TopoReport;
  const NS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'dengbao-topo-project-v2';
  const BASELINE_KEY = 'dengbao-topo-baseline-v2';
  const CUSTOM_KEY = 'dengbao-topo-custom-v2';
  const FONT = 'Microsoft YaHei, PingFang SC, Arial, sans-serif';
  const $ = function (id) { return document.getElementById(id); };

  const svg = $('canvas');
  const viewport = $('viewport');
  const layerZones = $('layer-zones');
  const layerLinks = $('layer-links');
  const layerNodes = $('layer-nodes');
  const overlay = $('layer-overlay');
  const markerDefs = $('marker-defs');

  /* ---------------- 状态 ---------------- */
  function emptyProject() {
    return Object.assign(SCHEMA.normalize({ meta: { name: '未命名拓扑' } }), {
      view: { x: 60, y: 40, zoom: 1 },
      settings: { grid: true, snap: true, minimap: true, readonly: false, arrowDefault: false }
    });
  }
  let S = emptyProject();
  let selection = new Set();
  let tool = 'select', linkStyle = 'ortho', linkDraft = null, pendingIcon = null;
  let history = [], future = [], clipboard = null;
  let drag = null, resize = null, pan = null, marquee = null, endpointDrag = null, spaceDown = false;
  /* v4 交互状态：矩形画区域、从端口拉线、拖动标签、悬停高亮、最后一次指针位置 */
  let zoneDraw = null, portDrag = null, labelDrag = null, hoverId = null, lastWorld = { x: 0, y: 0 };
  const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  let editBefore = null, inspectorKey = '', saveTimer = null;
  let assetFilter = '', activeCat = 'all', flatMode = false;
  const collapsedCats = new Set();
  let diffResult = null;
  let customIcons = [];
  let batchRows = new Set();

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function snapv(v) { return S.settings.snap ? Math.round(v / 20) * 20 : Math.round(v); }
  function iconOf(id) { return ICONS.map[id] || ICONS.map.generic; }
  function colorOf(n) { return n.color || ICONS.catColor(iconOf(n.icon).cat); }
  function nodeById(id) { return S.nodes.find(function (n) { return n.id === id; }); }
  function anchorList() { return S.anchors || (S.anchors = []); }
  function endpointById(id) {
    return S.nodes.find(function (n) { return n.id === id; }) ||
      S.zones.find(function (z) { return z.id === id; }) ||
      anchorList().find(function (a) { return a.id === id; }) || null;
  }
  function findObj(id) {
    let o = S.nodes.find(function (x) { return x.id === id; }); if (o) return { t: 'node', o: o };
    o = S.zones.find(function (x) { return x.id === id; }); if (o) return { t: 'zone', o: o };
    o = anchorList().find(function (x) { return x.id === id; }); if (o) return { t: 'anchor', o: o };
    o = S.links.find(function (x) { return x.id === id; }); if (o) return { t: 'link', o: o };
    return null;
  }
  function zoneOf(n) { const z = S.zones.find(function (zz) { return zz.id === n.parent; }); return z ? z.label : (n.zone || ''); }
  function toast(msg, kind) {
    const el = $('toast');
    el.textContent = msg; el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(el._t); el._t = setTimeout(function () { el.className = 'toast'; }, 2600);
  }
  /* 导出统一入口：自动下载 + 可见确认面板 + 多重兜底
   * 预览面板 / iframe 常会静默拦截程序化 a.click() 下载，因此不能只靠它，
   * 也不能在调用后无条件提示「已导出」。 */
  let exportCtx = null;
  function download(name, blob, opts) {
    const o = opts || {};
    if (exportCtx && exportCtx.url) { try { URL.revokeObjectURL(exportCtx.url); } catch (e) { /* ignore */ } }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a);
    try { a.click(); } catch (e) { /* 被预览面板拦截时由导出面板兜底 */ }
    setTimeout(function () { a.remove(); }, 1500);
    exportCtx = { name: name, blob: blob, url: url, text: o.text == null ? null : String(o.text), kind: o.kind || '文件' };
    if (readStore('dengbao-skip-export-panel', false)) {
      toast('已发起下载：' + name + '（导出菜单 → 查看上次导出结果 可打开面板）');
    } else showExportModal();
  }
  function showExportModal() {
    const c = exportCtx;
    if (!c) return;
    $('exp-name').textContent = c.name;
    const size = (c.blob && c.blob.size) || (c.text ? c.text.length : 0);
    $('exp-meta').textContent = c.kind + ' · ' + (size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B');
    $('exp-status').innerHTML = '<b>文件已生成</b>，已向浏览器发起下载请求。';
    const link = $('exp-link');
    link.setAttribute('href', c.url);
    link.setAttribute('download', c.name);
    const pre = $('exp-preview');
    if (c.text) {
      pre.textContent = c.text.length > 3000
        ? c.text.slice(0, 3000) + '\n…（仅预览前 3000 字符；复制与下载均为完整内容）'
        : c.text;
    } else {
      pre.textContent = '（二进制图片：请用「在新窗口打开」查看并右键另存，或点击「保存到本地…」）';
    }
    $('exp-copy').style.display = c.text ? '' : 'none';
    $('exp-saveas').style.display = window.showSaveFilePicker ? '' : 'none';
    $('exp-noshow').checked = !!readStore('dengbao-skip-export-panel', false);
    $('export-modal').classList.add('show');
    toast('已生成 ' + c.name + '，请在导出面板确认保存');
  }
  function readStore(k, def) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function writeStore(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast('本地存储空间不足，请先导出工程 JSON 保存', 'warn'); return false; }
  }
  function snapshot() { return JSON.stringify(S); }
  function restore(str) {
    const d = typeof str === 'string' ? JSON.parse(str) : str;
    S = Object.assign(SCHEMA.normalize(d), {
      view: d.view || { x: 60, y: 40, zoom: 1 },
      settings: Object.assign({ grid: true, snap: true, minimap: true, readonly: false, arrowDefault: false }, d.settings || {})
    });
    /* v2 及更早的工程曾把「默认带箭头」写进 settings，升级时一并纠正 */
    if (!d.version || d.version < 3) S.settings.arrowDefault = false;
    syncToggles();
  }
  function pushHistory(before, label) {
    if (before === snapshot()) return;
    history.push({ data: before, label: label || '编辑', time: new Date().toLocaleTimeString('zh-CN') });
    if (history.length > 80) history.shift();
    future = [];
    scheduleSave(); renderHistory();
  }
  function mutate(fn, label) {
    if (S.settings.readonly) { toast('只读评审模式下不可编辑', 'warn'); return false; }
    const before = snapshot();
    fn();
    pushHistory(before, label);
    render();
    return true;
  }
  function scheduleSave() {
    $('save-state').textContent = '未保存';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (writeStore(STORE_KEY, JSON.parse(snapshot()))) $('save-state').textContent = '已自动保存';
    }, 600);
  }
  function syncToggles() {
    $('btn-grid').classList.toggle('active', !!S.settings.grid);
    $('btn-snap').classList.toggle('active', !!S.settings.snap);
    $('btn-minimap').classList.toggle('active', !!S.settings.minimap);
    $('btn-readonly').classList.toggle('active', !!S.settings.readonly);
    $('btn-arrow-default').classList.toggle('active', !!S.settings.arrowDefault);
    document.body.classList.toggle('readonly-mode', !!S.settings.readonly);
  }

  /* ---------------- 自定义图标 ---------------- */
  const SVG_TAGS = ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'defs', 'title'];
  const SVG_ATTRS = ['viewBox', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
    'transform', 'points', 'font-size', 'font-weight', 'text-anchor', 'font-family', 'fill-opacity', 'stroke-opacity'];
  function sanitizeSvg(text) {
    if (typeof DOMParser === 'undefined' || text.length > 20000) return null;
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror') || !doc.documentElement || doc.documentElement.tagName.toLowerCase() !== 'svg') return null;
    function walk(node) {
      let out = '';
      Array.prototype.forEach.call(node.childNodes, function (ch) {
        if (ch.nodeType !== 1) return;
        const tag = ch.tagName.toLowerCase();
        if (tag === 'script' || tag === 'foreignobject' || tag === 'image' || tag === 'use' || tag === 'a') return;
        if (SVG_TAGS.indexOf(tag) < 0 || tag === 'svg') return;
        let s = '<' + tag;
        Array.prototype.forEach.call(ch.attributes || [], function (at) {
          const nm = at.name.toLowerCase();
          if (/^on/.test(nm) || /href/i.test(nm) || SVG_ATTRS.indexOf(nm) < 0) return;
          if (/url\s*\(/i.test(at.value) || /javascript:/i.test(at.value)) return;
          s += ' ' + nm + '="' + esc(at.value) + '"';
        });
        s += '>';
        Array.prototype.forEach.call(ch.childNodes, function (t) { if (t.nodeType === 3) s += esc(t.nodeValue); });
        s += walk(ch);
        s += '</' + tag + '>';
        out += s;
      });
      return out;
    }
    return walk(doc.documentElement) || null;
  }
  function registerCustomIcons() {
    customIcons.forEach(function (c) {
      ICONS.map[c.id] = { id: c.id, name: c.name, kw: '自定义 custom', cat: 'custom', sub: '自定义', svg: c.body };
    });
  }
  function loadCustom() {
    customIcons = readStore(CUSTOM_KEY, []);
    if (!Array.isArray(customIcons)) customIcons = [];
    registerCustomIcons();
  }

  /* ---------------- 连线几何（含避障） ---------------- */
  function anchors(a, b) {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const dx = bx - ax, dy = by - ay;
    if (Math.abs(dx) > Math.abs(dy) * 1.15) {
      return [{ x: dx > 0 ? a.x + a.w : a.x, y: ay }, { x: dx > 0 ? b.x : b.x + b.w, y: by }, 'h'];
    }
    return [{ x: ax, y: dy > 0 ? a.y + a.h : a.y }, { x: bx, y: dy > 0 ? b.y : b.y + b.h }, 'v'];
  }
  function segHitsRect(p, q, r) {
    const pad = 4;
    if (Math.abs(p.y - q.y) < 0.5) {
      return p.y > r.y + pad && p.y < r.y + r.h - pad &&
        Math.max(p.x, q.x) > r.x + pad && Math.min(p.x, q.x) < r.x + r.w - pad;
    }
    if (Math.abs(p.x - q.x) < 0.5) {
      return p.x > r.x + pad && p.x < r.x + r.w - pad &&
        Math.max(p.y, q.y) > r.y + pad && Math.min(p.y, q.y) < r.y + r.h - pad;
    }
    return false;
  }
  function pathBlocked(pts, obstacles) {
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = 0; j < obstacles.length; j++) {
        if (segHitsRect(pts[i], pts[i + 1], obstacles[j])) return true;
      }
    }
    return false;
  }
  function linkPath(a, b, style) {
    const A = anchors(a, b), p1 = A[0], p2 = A[1], dir = A[2];
    const obstacles = S.nodes.filter(function (n) { return n !== a && n !== b; });
    let d, pts = [p1, p2];
    if (style === 'straight') {
      d = 'M' + p1.x + ' ' + p1.y + ' L' + p2.x + ' ' + p2.y;
    } else if (style === 'curve') {
      const k = 0.5;
      const c1 = dir === 'h' ? { x: p1.x + (p2.x - p1.x) * k, y: p1.y } : { x: p1.x, y: p1.y + (p2.y - p1.y) * k };
      const c2 = dir === 'h' ? { x: p2.x - (p2.x - p1.x) * k, y: p2.y } : { x: p2.x, y: p2.y - (p2.y - p1.y) * k };
      d = 'M' + p1.x + ' ' + p1.y + ' C' + c1.x + ' ' + c1.y + ' ' + c2.x + ' ' + c2.y + ' ' + p2.x + ' ' + p2.y;
    } else {
      const mid = dir === 'h' ? (p1.x + p2.x) / 2 : (p1.y + p2.y) / 2;
      const cand = dir === 'h'
        ? [mid, a.x + a.w + 30, b.x - 30, mid + 70, mid - 70]
        : [mid, a.y + a.h + 30, b.y - 30, mid + 70, mid - 70];
      let chosen = cand[0], found = false;
      for (let i = 0; i < cand.length; i++) {
        const v = cand[i];
        const p = dir === 'h'
          ? [p1, { x: v, y: p1.y }, { x: v, y: p2.y }, p2]
          : [p1, { x: p1.x, y: v }, { x: p2.x, y: v }, p2];
        if (!pathBlocked(p, obstacles)) { chosen = v; pts = p; found = true; break; }
      }
      if (!found) pts = dir === 'h'
        ? [p1, { x: chosen, y: p1.y }, { x: chosen, y: p2.y }, p2]
        : [p1, { x: p1.x, y: chosen }, { x: p2.x, y: chosen }, p2];
      d = 'M' + pts.map(function (p) { return p.x + ' ' + p.y; }).join(' L');
    }
    return { d: d, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2, p1: p1, p2: p2 };
  }
  function colorId(c) { return String(c || '').replace(/[^a-zA-Z0-9]/g, '') || 'default'; }
  function buildMarkers() {
    const cols = {};
    S.links.forEach(function (l) { cols[l.color || '#64748b'] = 1; });
    if (linkDraft || portDrag) cols['#2563eb'] = 1;
    markerDefs.innerHTML = Object.keys(cols).map(function (c) {
      return '<marker id="arw-' + colorId(c) + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0 0 L10 5 L0 10 z" fill="' + c + '"/></marker>';
    }).join('');
  }

  /* ---------------- v4 区域标注 / 快捷端口 / 手柄 ---------------- */
  function textUnits(s) {
    let u = 0;
    const str = String(s == null ? '' : s);
    for (let i = 0; i < str.length; i++) u += str.charCodeAt(i) > 127 ? 1 : 0.58;
    return u;
  }
  /* 区域标签排版：9 宫格位置 + 自由偏移，支持多行名称与说明文字 */
  function zoneLabelInfo(z) {
    const main = String(z.label || '安全区域').split('\n');
    const kid = S.nodes.filter(function (n) { return n.parent === z.id; }).length;
    let tail = '';
    if (z.showCount !== false && kid) tail += '  (' + kid + ')';
    if (z.locked) tail += '  [锁定]';
    if (tail) main[main.length - 1] += tail;
    const desc = String(z.desc || '').split('\n').filter(function (x) { return x; });
    const fs = clamp(Number(z.labelSize) || 13, 10, 28), dfs = Math.max(9, fs - 3);
    let need = 0;
    main.forEach(function (s) { need = Math.max(need, textUnits(s) * fs); });
    desc.forEach(function (s) { need = Math.max(need, textUnits(s) * dfs); });
    const w = Math.min(Math.max(60, z.w - 16), Math.max(76, need + 20));
    const h = 8 + main.length * (fs + 3) + (desc.length ? desc.length * (dfs + 3) + 2 : 0);
    const pos = SCHEMA.ZONE_LABEL_POS.indexOf(z.labelPos) >= 0 ? z.labelPos : 'tl';
    const row = pos.charAt(0), col = pos.charAt(1);
    let x = col === 'l' ? z.x + 8 : col === 'c' ? z.x + (z.w - w) / 2 : z.x + z.w - w - 8;
    let y = row === 't' ? z.y + 8 : row === 'm' ? z.y + (z.h - h) / 2 : z.y + z.h - h - 8;
    x += Number(z.labelDx) || 0; y += Number(z.labelDy) || 0;
    const anchor = z.labelAlign || (col === 'l' ? 'start' : col === 'c' ? 'middle' : 'end');
    const tx = anchor === 'start' ? x + 10 : anchor === 'middle' ? x + w / 2 : x + w - 10;
    return {
      x: x, y: y, w: w, h: h, tx: tx, ty: y + fs + 4, anchor: anchor,
      main: main, desc: desc, fs: fs, dfs: dfs
    };
  }
  /* 选中对象四边的快捷连线端口：不必切换工具即可从端口拖出连线 */
  function portHandles(x, y, w, h) {
    const pts = [[x + w / 2, y, 'n'], [x + w, y + h / 2, 'e'], [x + w / 2, y + h, 's'], [x, y + h / 2, 'w']];
    return pts.map(function (p) {
      return '<circle class="port" data-handle="port" data-port="' + p[2] + '" cx="' + p[0] + '" cy="' + p[1] +
        '" r="5.5" fill="#ffffff" stroke="#2563eb" stroke-width="1.8" style="cursor:crosshair"/>';
    }).join('');
  }
  const RESIZE_CURSOR = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize'
  };
  /* 四角 + 四边共 8 个缩放手柄；右下角沿用 data-handle="resize" 以兼容旧工程交互 */
  function resizeHandles(x, y, w, h) {
    const pts = {
      nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2],
      se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2]
    };
    return RESIZE_DIRS.map(function (k) {
      const p = pts[k];
      return '<rect data-handle="resize' + (k === 'se' ? '' : '-' + k) + '" x="' + (p[0] - 5) + '" y="' + (p[1] - 5) +
        '" width="10" height="10" rx="2" fill="#2563eb" stroke="#fff" stroke-width="1.6" style="cursor:' +
        RESIZE_CURSOR[k] + '"/>';
    }).join('');
  }
  function haloHTML(id) {
    const o = endpointById(id);
    if (!o) return '';
    const pad = o.w ? 7 : 16;
    return '<rect x="' + (o.x - pad) + '" y="' + (o.y - pad) + '" width="' + (o.w + pad * 2) +
      '" height="' + (o.h + pad * 2) + '" rx="12" fill="#3b82f6" fill-opacity="0.06" stroke="#2563eb" ' +
      'stroke-width="2" stroke-dasharray="6 4" pointer-events="none"/>';
  }

  /* ---------------- 渲染 ---------------- */
  function renderNode(n) {
    const sel = selection.has(n.id), c = colorOf(n);
    const isText = ICONS.textIds.indexOf(n.icon) >= 0;
    let body;
    if (isText) {
      const lines = String(n.label || '双击编辑文本').split('\n');
      body = '<rect x="0.5" y="0.5" width="' + (n.w - 1) + '" height="' + (n.h - 1) + '" rx="6" fill="#fffbeb" stroke="' +
        (sel ? '#2563eb' : '#e8d5a8') + '" stroke-width="' + (sel ? 2 : 1.4) + '" data-selected="' + (sel ? 1 : 0) + '" data-base-stroke="#e8d5a8"/>' +
        lines.slice(0, 8).map(function (ln, i) {
          return '<text x="12" y="' + (22 + i * 19) + '" font-size="13" font-weight="600" fill="#7c4a12" font-family="' + FONT + '">' + esc(ln) + '</text>';
        }).join('');
    } else {
      body = '<rect class="node-bg" data-selected="' + (sel ? 1 : 0) + '" x="1" y="1" width="' + (n.w - 2) + '" height="' + (n.h - 2) +
        '" rx="10" fill="#ffffff" stroke="' + (sel ? '#2563eb' : '#d9e0ea') + '" stroke-width="' + (sel ? 2.2 : 1.4) + '"/>' +
        '<rect x="1" y="10" width="4" height="' + (n.h - 20) + '" rx="2" fill="' + c + '" fill-opacity="0.85"/>' +
        '<g transform="translate(' + ((n.w - 46) / 2) + ', 6)">' + ICONS.svg(n.icon, 46, c) + '</g>' +
        '<text x="' + (n.w / 2) + '" y="' + (n.h - 21) + '" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1e293b" font-family="' + FONT + '">' + esc(n.label) + '</text>' +
        '<text x="' + (n.w / 2) + '" y="' + (n.h - 6) + '" text-anchor="middle" font-size="10.5" fill="#7b8798" font-family="' + FONT + '">' + esc(n.ip) + '</text>' +
        (n.locked ? '<path d="M' + (n.w - 18) + ' 10 v-3 a4 4 0 0 1 8 0 v3" fill="none" stroke="#94a3b8" stroke-width="1.5"/>' : '');
    }
    const handle = sel && !S.settings.readonly ?
      portHandles(0, 0, n.w, n.h) + resizeHandles(0, 0, n.w, n.h) : '';
    return '<g class="node" data-id="' + n.id + '" data-kind="node" transform="translate(' + n.x + ',' + n.y + ')" ' +
      'tabindex="0" role="button" aria-label="' + esc(n.label + '，' + ICONS.catName(iconOf(n.icon).cat) + ' / ' + ICONS.subOf(n.icon)) + '" style="cursor:move">' + body + handle + '</g>';
  }
  function renderZone(z) {
    const sel = selection.has(z.id), c = z.color || '#94a3b8';
    const st = z.style || 'dash';
    const dash = st === 'dot' ? 'stroke-dasharray="2 5"' : st === 'dash' ? 'stroke-dasharray="9 6"' : '';
    const sw = st === 'none' ? 0 : (sel ? 2.4 : 1.6);
    const L = zoneLabelInfo(z), tcol = z.labelColor || c;
    /* 背板：区域内部空白处也能作为连线 / 选中目标（节点层在其上，设备仍优先命中） */
    let body = '<rect class="zone-hit" data-zone-fill="1" x="' + z.x + '" y="' + z.y + '" width="' + z.w +
      '" height="' + z.h + '" rx="12" fill="transparent" pointer-events="fill"/>';
    body += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="12" fill="' + c +
      '" fill-opacity="' + (z.fillOpacity == null ? 0.055 : z.fillOpacity) + '" stroke="' + (sel ? '#2563eb' : c) +
      '" stroke-width="' + sw + '" ' + dash + ' pointer-events="stroke" data-selected="' + (sel ? 1 : 0) +
      '" data-base-stroke="' + c + '"/>';
    if (z.labelBg !== false) {
      body += '<rect data-handle="zone-label" x="' + L.x + '" y="' + L.y + '" width="' + L.w + '" height="' + L.h +
        '" rx="7" fill="#ffffff" fill-opacity="0.84" stroke="' + c + '" stroke-opacity="0.3" stroke-width="1" style="cursor:move"/>';
    }
    let ty = L.ty;
    let txt = L.main.map(function (s) {
      const line = '<tspan x="' + L.tx + '" y="' + ty + '">' + esc(s) + '</tspan>';
      ty += L.fs + 3;
      return line;
    }).join('');
    if (L.desc.length) {
      ty += 2;
      txt += L.desc.map(function (s) {
        const line = '<tspan x="' + L.tx + '" y="' + ty + '" font-size="' + L.dfs +
          '" font-weight="400" fill-opacity="0.8">' + esc(s) + '</tspan>';
        ty += L.dfs + 3;
        return line;
      }).join('');
    }
    body += '<text class="zone-label" data-handle="zone-label" text-anchor="' + L.anchor + '" font-size="' + L.fs +
      '" font-weight="700" fill="' + tcol + '" font-family="' + FONT + '" style="cursor:move">' + txt + '</text>';
    if (sel && !S.settings.readonly) body += portHandles(z.x, z.y, z.w, z.h) + resizeHandles(z.x, z.y, z.w, z.h);
    return '<g class="zone" data-id="' + z.id + '" data-kind="zone">' + body + '</g>';
  }
  /* 自由端点：一个可命名、可拖动、可作为链路端点的小圆点 */
  function renderAnchor(a) {
    const sel = selection.has(a.id), c = a.color || '#2563eb';
    return '<g class="anchor" data-id="' + a.id + '" data-kind="anchor" transform="translate(' + a.x + ',' + a.y + ')" style="cursor:move">' +
      '<circle r="11" fill="#ffffff" stroke="' + (sel ? '#2563eb' : c) + '" stroke-width="' + (sel ? 2.4 : 1.6) + '"/>' +
      '<circle r="4.5" fill="' + c + '"/>' +
      '<text x="0" y="-17" text-anchor="middle" font-size="11" font-weight="600" fill="#334155" font-family="' + FONT +
      '" paint-order="stroke" stroke="#ffffff" stroke-width="3">' + esc(a.label) + '</text>' +
      (sel && !S.settings.readonly ? '<circle data-handle="port" data-port="e" cx="11" cy="0" r="5" fill="#fff" stroke="#2563eb" stroke-width="1.8" style="cursor:crosshair"/>' : '') +
      '</g>';
  }
  function renderLink(l) {
    const a = endpointById(l.from), b = endpointById(l.to);
    if (!a || !b) return '';
    const p = linkPath(a, b, l.style || 'ortho'), sel = selection.has(l.id);
    const c = l.color || '#64748b';
    const marker = l.arrow === true ? ' marker-end="url(#arw-' + colorId(c) + ')"' : '';
    const dash = l.dash ? ' stroke-dasharray="8 5"' : '';
    const hover = hoverId === l.id;
    const w = (sel || hover) ? (l.width || 2) + 1.5 : (l.width || 2);
    const lx = p.mx + (Number(l.labelDx) || 0), ly = p.my - 7 + (Number(l.labelDy) || 0);
    let extra = '';
    if (sel && !S.settings.readonly) {
      extra = '<circle data-handle="ep-from" cx="' + p.p1.x + '" cy="' + p.p1.y + '" r="6" fill="#2563eb" stroke="#fff" stroke-width="2" style="cursor:crosshair"/>' +
        '<circle data-handle="ep-to" cx="' + p.p2.x + '" cy="' + p.p2.y + '" r="6" fill="#16a34a" stroke="#fff" stroke-width="2" style="cursor:crosshair"/>' +
        (l.label ? '<rect data-handle="link-label" x="' + (lx - 7) + '" y="' + (ly - 13) + '" width="14" height="7" rx="2" fill="#2563eb" stroke="#fff" stroke-width="1" style="cursor:move"/>' : '');
    }
    return '<g class="link" data-id="' + l.id + '" data-kind="link" style="cursor:pointer">' +
      '<path d="' + p.d + '" fill="none" stroke="transparent" stroke-width="16" pointer-events="stroke"/>' +
      '<path d="' + p.d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '"' + dash + marker + ' stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>' +
      (l.label ? '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" font-size="11" fill="#475569" font-family="' + FONT + '" ' +
        'paint-order="stroke" stroke="#ffffff" stroke-width="4" pointer-events="none">' + esc(l.label) + '</text>' : '') +
      extra + '</g>';
  }
  function dragPreview(fromId, point, color, marker) {
    const a = endpointById(fromId);
    if (!a) return '';
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    return '<path d="M' + ax + ' ' + ay + ' L' + point.x + ' ' + point.y + '" fill="none" stroke="' + color +
      '" stroke-width="2" stroke-dasharray="7 5" ' + (marker ? 'marker-end="url(#arw-2563eb)" ' : '') + 'pointer-events="none"/>' +
      '<circle cx="' + ax + '" cy="' + ay + '" r="7" fill="none" stroke="' + color + '" stroke-width="2" pointer-events="none"/>';
  }
  function targetTip(point) {
    const o = endpointById(hoverId);
    if (!o) return '';
    return '<text x="' + (point.x + 14) + '" y="' + (point.y - 12) + '" font-size="11" font-weight="600" fill="#1d4ed8" font-family="' + FONT +
      '" paint-order="stroke" stroke="#ffffff" stroke-width="4" pointer-events="none">' + esc(o.label || '连接点') + '</text>';
  }
  function overlayHTML() {
    let ov = '';
    if (marquee) ov += '<rect x="' + marquee.x + '" y="' + marquee.y + '" width="' + marquee.w + '" height="' + marquee.h +
      '" fill="#2563eb" fill-opacity="0.08" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/>';
    if (drag && drag.guides) drag.guides.forEach(function (g) {
      ov += '<line x1="' + (g.axis === 'v' ? g.v : -6000) + '" y1="' + (g.axis === 'v' ? -6000 : g.v) +
        '" x2="' + (g.axis === 'v' ? g.v : 6000) + '" y2="' + (g.axis === 'v' ? 6000 : g.v) +
        '" stroke="#ec4899" stroke-width="1" stroke-dasharray="6 4" pointer-events="none"/>';
    });
    if (zoneDraw) ov += '<rect x="' + zoneDraw.x + '" y="' + zoneDraw.y + '" width="' + zoneDraw.w + '" height="' + zoneDraw.h +
      '" rx="12" fill="#3b82f6" fill-opacity="0.09" stroke="#2563eb" stroke-width="2" stroke-dasharray="7 5" pointer-events="none"/>' +
      '<text x="' + (zoneDraw.x + 10) + '" y="' + (zoneDraw.y + 22) + '" font-size="12" font-weight="700" fill="#1d4ed8" font-family="' + FONT +
      '" pointer-events="none">安全区域 ' + Math.round(zoneDraw.w) + ' × ' + Math.round(zoneDraw.h) + '</text>';
    if (linkDraft) ov += dragPreview(linkDraft.from, linkDraft.point, '#2563eb', true);
    if (portDrag) ov += dragPreview(portDrag.from, portDrag.point, '#2563eb', true);
    if (endpointDrag) ov += dragPreview(
      (S.links.find(function (x) { return x.id === endpointDrag.lid; }) || {})[endpointDrag.which === 'from' ? 'to' : 'from'],
      endpointDrag.point, '#16a34a', false);
    if (hoverId && (linkDraft || portDrag || endpointDrag)) {
      const pt = (portDrag && portDrag.point) || (linkDraft && linkDraft.point) || (endpointDrag && endpointDrag.point);
      ov += haloHTML(hoverId) + (pt ? targetTip(pt) : '');
    }
    return ov;
  }
  function repaint() {
    viewport.setAttribute('transform', 'translate(' + S.view.x + ',' + S.view.y + ') scale(' + S.view.zoom + ')');
    $('grid-bg').setAttribute('fill', S.settings.grid ? 'url(#grid-big)' : 'none');
    buildMarkers();
    layerZones.innerHTML = S.zones.map(renderZone).join('');
    layerLinks.innerHTML = S.links.map(renderLink).join('');
    layerNodes.innerHTML = S.nodes.map(renderNode).join('') + anchorList().map(renderAnchor).join('');
    overlay.innerHTML = overlayHTML();
    renderMinimap();
  }
  /* 拖拽期间增量更新：节点只改 transform，避免整层重建 */
  function repaintDrag() {
    const gs = layerNodes.querySelectorAll('.node');
    Array.prototype.forEach.call(gs, function (g) {
      const n = nodeById(g.getAttribute('data-id'));
      if (n) g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
    });
    Array.prototype.forEach.call(layerNodes.querySelectorAll('.anchor'), function (g) {
      const a = anchorList().find(function (x) { return x.id === g.getAttribute('data-id'); });
      if (a) g.setAttribute('transform', 'translate(' + a.x + ',' + a.y + ')');
    });
    layerZones.innerHTML = S.zones.map(renderZone).join('');
    layerLinks.innerHTML = S.links.map(renderLink).join('');
    overlay.innerHTML = overlayHTML();
    renderMinimap();
  }
  function render() {
    /* 强制刷新属性面板：端点改接、批量编辑等场景下 selection 不变但对象内容已变 */
    repaint(); updateInspector(true); updateStatus(); renderPages(); scheduleSave();
  }
  function updateStatus() {
    $('zoom-label').textContent = Math.round(S.view.zoom * 100) + '%';
    $('status-info').textContent = '资产 ' + S.nodes.length + ' 个 · 连线 ' + S.links.length + ' 条 · 区域 ' + S.zones.length + ' 个' +
      (selection.size ? ' · 已选中 ' + selection.size + ' 项' : '') + (S.settings.readonly ? ' · 只读评审' : '');
    $('btn-undo').disabled = !history.length;
    $('btn-redo').disabled = !future.length;
    $('project-name').textContent = S.meta.name || '未命名拓扑';
  }

  /* ---------------- 迷你地图 ---------------- */
  function renderMinimap() {
    const wrap = $('minimap-wrap');
    wrap.style.display = S.settings.minimap ? 'block' : 'none';
    if (!S.settings.minimap) return;
    const mm = $('minimap'), b = bbox(), W = 196, H = 128, pad = 6;
    const s = clamp(Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h), 0.01, 2);
    const ox = pad + (W - pad * 2 - b.w * s) / 2 - b.x * s;
    const oy = pad + (H - pad * 2 - b.h * s) / 2 - b.y * s;
    mm._mini = { s: s, ox: ox, oy: oy };
    let h = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    S.zones.forEach(function (z) {
      h += '<rect x="' + (z.x * s + ox) + '" y="' + (z.y * s + oy) + '" width="' + (z.w * s) + '" height="' + (z.h * s) +
        '" fill="' + (z.color || '#94a3b8') + '" fill-opacity="0.09" stroke="' + (z.color || '#94a3b8') + '" stroke-width="0.8"/>';
    });
    S.links.forEach(function (l) {
      const a = endpointById(l.from), c = endpointById(l.to);
      if (!a || !c) return;
      h += '<line x1="' + ((a.x + a.w / 2) * s + ox) + '" y1="' + ((a.y + a.h / 2) * s + oy) +
        '" x2="' + ((c.x + c.w / 2) * s + ox) + '" y2="' + ((c.y + c.h / 2) * s + oy) + '" stroke="#cbd5e1" stroke-width="0.7"/>';
    });
    S.nodes.forEach(function (n) {
      h += '<rect x="' + (n.x * s + ox) + '" y="' + (n.y * s + oy) + '" width="' + Math.max(2, n.w * s) + '" height="' + Math.max(2, n.h * s) +
        '" rx="1" fill="' + (selection.has(n.id) ? '#2563eb' : colorOf(n)) + '" fill-opacity="0.75"/>';
    });
    anchorList().forEach(function (a) {
      h += '<circle cx="' + (a.x * s + ox) + '" cy="' + (a.y * s + oy) + '" r="2.2" fill="' +
        (selection.has(a.id) ? '#2563eb' : (a.color || '#2563eb')) + '"/>';
    });
    const r = svg.getBoundingClientRect();
    const vx = -S.view.x / S.view.zoom, vy = -S.view.y / S.view.zoom;
    h += '<rect x="' + (vx * s + ox) + '" y="' + (vy * s + oy) + '" width="' + (r.width / S.view.zoom * s) + '" height="' + (r.height / S.view.zoom * s) +
      '" fill="#3b82f6" fill-opacity="0.08" stroke="#2563eb" stroke-width="1.2"/>';
    mm.innerHTML = h;
  }

  /* ---------------- 坐标 / 视图 ---------------- */
  function toWorld(e) {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left - S.view.x) / S.view.zoom, y: (e.clientY - r.top - S.view.y) / S.view.zoom };
  }
  function toLocal(e) {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function worldToScreen(x, y) {
    return { x: x * S.view.zoom + S.view.x, y: y * S.view.zoom + S.view.y };
  }
  function bbox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, has = false;
    const anchorBoxes = anchorList().map(function (a) { return { x: a.x - 20, y: a.y - 20, w: 40, h: 40 }; });
    S.nodes.concat(S.zones).concat(anchorBoxes).forEach(function (o) {
      has = true;
      minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
    });
    if (!has) return { x: 0, y: 0, w: 900, h: 600 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function fit() {
    const b = bbox(), r = svg.getBoundingClientRect(), pad = 70;
    const z = clamp(Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h, 1.15), 0.15, 2);
    S.view.zoom = z;
    S.view.x = (r.width - b.w * z) / 2 - b.x * z;
    S.view.y = (r.height - b.h * z) / 2 - b.y * z;
    repaint(); updateStatus(); scheduleSave();
  }
  function zoomAt(factor, cx, cy) {
    const r = svg.getBoundingClientRect();
    cx = cx === undefined ? r.width / 2 : cx; cy = cy === undefined ? r.height / 2 : cy;
    const wx = (cx - S.view.x) / S.view.zoom, wy = (cy - S.view.y) / S.view.zoom;
    const z = clamp(S.view.zoom * factor, 0.15, 3);
    S.view.x = cx - wx * z; S.view.y = cy - wy * z; S.view.zoom = z;
    repaint(); updateStatus(); scheduleSave();
  }
  function centerOn(o) { centerOnPoint(o.x + o.w / 2, o.y + o.h / 2); }
  function centerOnPoint(wx, wy) {
    const r = svg.getBoundingClientRect();
    S.view.x = r.width / 2 - wx * S.view.zoom;
    S.view.y = r.height / 2 - wy * S.view.zoom;
    repaint(); updateStatus(); scheduleSave();
  }

  /* ---------------- 资产库 ---------------- */
  function assetItemHTML(i) {
    const c = ICONS.catColor(i.cat);
    return '<div class="asset-item" data-icon="' + i.id + '" draggable="true" title="' +
      esc(i.name + ' · ' + ICONS.catName(i.cat) + ' / ' + (i.sub || '其他')) + '">' +
      '<div class="asset-ico" style="color:' + c + '">' + ICONS.svg(i.id, 34, c) + '</div>' +
      '<span>' + esc(i.name) + '</span></div>';
  }
  function syncAssetTools() {
    $('btn-view-mode').textContent = flatMode ? '▦ 平铺 ⇄' : '☷ 分组 ⇄';
    $('btn-view-mode').classList.toggle('on', !flatMode);
    const all = ICONS.categories.every(function (c) { return collapsedCats.has(c.id); });
    $('btn-collapse-all').textContent = all ? '展开全部' : '折叠全部';
    $('btn-collapse-all').disabled = flatMode || !!assetFilter.trim();
  }
  function renderAssets() {
    const counts = {};
    ICONS.icons.forEach(function (i) { counts[i.cat] = (counts[i.cat] || 0) + 1; });
    $('asset-cats').innerHTML = '<button class="cat-pill' + (activeCat === 'all' ? ' active' : '') +
      '" data-cat="all">全部 <b>' + ICONS.icons.length + '</b></button>' +
      ICONS.categories.map(function (c) {
        return '<button class="cat-pill' + (activeCat === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' +
          '<i style="background:' + c.color + '"></i>' + c.name + ' <b>' + (counts[c.id] || 0) + '</b></button>';
      }).join('');
    const q = assetFilter.trim().toLowerCase();
    const match = function (i) {
      if (activeCat !== 'all' && i.cat !== activeCat) return false;
      if (!q) return true;
      return (i.name + ' ' + i.kw + ' ' + i.id + ' ' + i.sub + ' ' + ICONS.catName(i.cat)).toLowerCase().indexOf(q) >= 0;
    };
    const empty = '<div class="empty-hint">没有匹配的资产图标<br>试试「防火墙」「WAF」「审计」「数据库」</div>';
    let html = '', shown = 0;
    if (flatMode || q) {
      const list = ICONS.icons.filter(match);
      shown = list.length;
      html = list.length ? '<div class="asset-grid">' + list.map(assetItemHTML).join('') + '</div>' : empty;
    } else {
      if (activeCat === 'all' && customIcons.length) {
        const ci = customIcons.map(function (c) { return ICONS.map[c.id]; }).filter(Boolean);
        html += '<section class="asset-group" style="--cat:#a78bfa"><button class="group-hd" data-collapse="__custom__">' +
          '<i></i><strong>自定义图标</strong><em>' + ci.length + '</em><span class="chev">▾</span></button>' +
          '<div class="group-body"><div class="asset-grid">' + ci.map(assetItemHTML).join('') + '</div></div></section>';
        shown += ci.length;
      }
      html += ICONS.categories.filter(function (c) { return activeCat === 'all' || c.id === activeCat; })
        .map(function (c) {
          const groups = ICONS.subgroups.filter(function (g) { return g.cat === c.id; });
          const n = groups.reduce(function (s, g) { return s + g.ids.length; }, 0);
          shown += n;
          const collapsed = collapsedCats.has(c.id);
          return '<section class="asset-group' + (collapsed ? ' collapsed' : '') + '" style="--cat:' + c.color + '">' +
            '<button class="group-hd" data-collapse="' + c.id + '"><i></i><strong>' + c.name + '</strong>' +
            '<em>' + n + '</em><span class="chev">▾</span></button>' +
            '<div class="group-body">' + groups.map(function (g) {
              return '<div class="sub-hd"><span>' + esc(g.name) + '</span><b>' + g.ids.length + '</b></div>' +
                '<div class="asset-grid">' + g.ids.map(function (id) { return assetItemHTML(ICONS.map[id]); }).join('') + '</div>';
            }).join('') + '</div></section>';
        }).join('');
      if (!html) html = empty;
    }
    $('asset-grid').innerHTML = html;
    $('asset-count').textContent = q ? ('匹配 ' + shown + ' 个') :
      (ICONS.icons.length + ' 个 · ' + ICONS.categories.length + ' 类 ' + ICONS.subgroups.length + ' 组');
    syncAssetTools();
  }
  function renderTemplates() {
    $('tpl-list').innerHTML = TPL.list().map(function (t) {
      return '<div class="tpl-card" data-tpl="' + t.id + '"><div class="tpl-head"><span class="tpl-badge">' +
        (t.level || '通用') + '</span><strong>' + esc(t.name) + '</strong></div><p>' + esc(t.desc) +
        '</p><div class="tpl-foot">点击载入 <span>↗</span></div></div>';
    }).join('');
  }

  /* ---------------- 添加 / 编辑对象 ---------------- */
  function addAt(iconId, x, y) {
    if (S.settings.readonly) { toast('只读评审模式下不可添加资产', 'warn'); return; }
    const it = iconOf(iconId);
    if (ICONS.zoneIds.indexOf(iconId) >= 0) {
      mutate(function () {
        const z = Object.assign({}, SCHEMA.ZONE_DEFAULTS, {
          id: SCHEMA.newId('z'), icon: iconId, x: snapv(x), y: snapv(y),
          label: it.name.replace(/（.*?）/, ''), color: ICONS.catColor(it.cat)
        });
        S.zones.push(z); selection = new Set([z.id]);
      }, '添加安全区域');
      return;
    }
    const isText = ICONS.textIds.indexOf(iconId) >= 0;
    mutate(function () {
      const n = Object.assign({}, SCHEMA.NODE_DEFAULTS, {
        id: SCHEMA.newId('n'), icon: iconId, x: snapv(x), y: snapv(y),
        w: isText ? 190 : 108, h: isText ? 76 : 86,
        label: isText ? '双击编辑文本内容' : it.name
      });
      /* 自动归属到所在区域框 */
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      const z = S.zones.find(function (zz) { return cx >= zz.x && cx <= zz.x + zz.w && cy >= zz.y && cy <= zz.y + zz.h; });
      if (z) { n.parent = z.id; n.zone = z.label; }
      S.nodes.push(n); selection = new Set([n.id]);
    }, '添加资产');
  }
  function deleteSelected() {
    if (!selection.size) return;
    mutate(function () {
      const ids = selection;
      S.nodes.forEach(function (n) { if (ids.has(n.parent)) n.parent = ''; });
      S.nodes = S.nodes.filter(function (n) { return !ids.has(n.id); });
      S.zones = S.zones.filter(function (z) { return !ids.has(z.id); });
      S.anchors = anchorList().filter(function (a) { return !ids.has(a.id); });
      S.links = S.links.filter(function (l) { return !ids.has(l.id) && !ids.has(l.from) && !ids.has(l.to); });
      selection = new Set();
    }, '删除对象');
    toast('已删除选中对象');
  }
  function duplicateSelected() {
    if (!selection.size) return;
    mutate(function () {
      const map = {}, nodes = [], zones = [], acs = [];
      S.nodes.forEach(function (n) {
        if (!selection.has(n.id)) return;
        const c = JSON.parse(JSON.stringify(n)); c.id = SCHEMA.newId('n'); c.x += 30; c.y += 30; map[n.id] = c.id; nodes.push(c);
      });
      S.zones.forEach(function (z) {
        if (!selection.has(z.id)) return;
        const c = JSON.parse(JSON.stringify(z)); c.id = SCHEMA.newId('z'); c.x += 30; c.y += 30; map[z.id] = c.id; zones.push(c);
      });
      anchorList().forEach(function (a) {
        if (!selection.has(a.id)) return;
        const c = JSON.parse(JSON.stringify(a)); c.id = SCHEMA.newId('a'); c.x += 30; c.y += 30; map[a.id] = c.id; acs.push(c);
      });
      const links = [];
      S.links.forEach(function (l) {
        if (selection.has(l.id) || (map[l.from] && map[l.to])) {
          const c = JSON.parse(JSON.stringify(l)); c.id = SCHEMA.newId('l');
          c.from = map[l.from] || l.from; c.to = map[l.to] || l.to; links.push(c);
        }
      });
      S.nodes = S.nodes.concat(nodes); S.zones = S.zones.concat(zones);
      S.anchors = anchorList().concat(acs); S.links = S.links.concat(links);
      selection = new Set(nodes.map(function (n) { return n.id; })
        .concat(zones.map(function (z) { return z.id; }))
        .concat(acs.map(function (a) { return a.id; })));
    }, '原地复制');
    toast('已复制 ' + selection.size + ' 个对象');
  }
  function copyToClipboard() {
    const ids = selection;
    clipboard = {
      nodes: S.nodes.filter(function (n) { return ids.has(n.id); }),
      zones: S.zones.filter(function (z) { return ids.has(z.id); }),
      anchors: anchorList().filter(function (a) { return ids.has(a.id); }),
      links: S.links.filter(function (l) { return ids.has(l.id) || (ids.has(l.from) && ids.has(l.to)); })
    };
    toast('已复制（粘贴会落在当前指针位置）');
  }
  function pasteClipboard() {
    const cb = clipboard;
    if (!cb || (!cb.nodes.length && !cb.zones.length && !(cb.anchors || []).length)) { toast('剪贴板为空', 'warn'); return; }
    const all = cb.nodes.concat(cb.zones, cb.anchors || []);
    const minX = Math.min.apply(null, all.map(function (o) { return o.x; }));
    const minY = Math.min.apply(null, all.map(function (o) { return o.y; }));
    /* 粘贴到指针位置，比固定 +40 偏移省去二次搬移 */
    const ox = snapv(lastWorld.x - minX + 20), oy = snapv(lastWorld.y - minY + 20);
    mutate(function () {
      const map = {}, sel = [], acs = [];
      cb.nodes.forEach(function (n) {
        const c = JSON.parse(JSON.stringify(n)); c.id = SCHEMA.newId('n');
        c.x = snapv(n.x + ox); c.y = snapv(n.y + oy); c.parent = '';
        map[n.id] = c.id; S.nodes.push(c); sel.push(c.id);
      });
      cb.zones.forEach(function (z) {
        const c = JSON.parse(JSON.stringify(z)); c.id = SCHEMA.newId('z');
        c.x = snapv(z.x + ox); c.y = snapv(z.y + oy);
        map[z.id] = c.id; S.zones.push(c); sel.push(c.id);
      });
      (cb.anchors || []).forEach(function (a) {
        const c = JSON.parse(JSON.stringify(a)); c.id = SCHEMA.newId('a');
        c.x = snapv(a.x + ox); c.y = snapv(a.y + oy);
        map[a.id] = c.id; acs.push(c); sel.push(c.id);
      });
      S.anchors = anchorList().concat(acs);
      cb.links.forEach(function (l) {
        if (map[l.from] && map[l.to]) {
          const c = JSON.parse(JSON.stringify(l)); c.id = SCHEMA.newId('l');
          c.from = map[l.from]; c.to = map[l.to]; S.links.push(c);
        }
      });
      selection = new Set(sel);
    }, '粘贴');
    toast('已粘贴 ' + selection.size + ' 个对象到指针位置');
  }
  function align(mode) {
    const ns = [];
    selection.forEach(function (id) { const f = findObj(id); if (f && f.t !== 'link') ns.push(f.o); });
    if (ns.length < 2) { toast('请至少选中 2 个对象', 'warn'); return; }
    mutate(function () {
      const xs = ns.map(function (n) { return n.x; }), ys = ns.map(function (n) { return n.y; });
      const l = Math.min.apply(null, xs), r = Math.max.apply(null, xs.map(function (x, i) { return x + ns[i].w; }));
      const t = Math.min.apply(null, ys), b = Math.max.apply(null, ys.map(function (y, i) { return y + ns[i].h; }));
      if (mode === 'left') ns.forEach(function (n) { n.x = l; });
      if (mode === 'right') ns.forEach(function (n) { n.x = r - n.w; });
      if (mode === 'top') ns.forEach(function (n) { n.y = t; });
      if (mode === 'bottom') ns.forEach(function (n) { n.y = b - n.h; });
      if (mode === 'hcenter') ns.forEach(function (n) { n.x = (l + r - n.w) / 2; });
      if (mode === 'vcenter') ns.forEach(function (n) { n.y = (t + b - n.h) / 2; });
      if (mode === 'hdist') {
        ns.sort(function (a, b2) { return a.x - b2.x; });
        const total = ns.reduce(function (s, n) { return s + n.w; }, 0), gap = (r - l - total) / (ns.length - 1);
        let cur = l; ns.forEach(function (n) { n.x = cur; cur += n.w + gap; });
      }
      if (mode === 'vdist') {
        ns.sort(function (a, b2) { return a.y - b2.y; });
        const total = ns.reduce(function (s, n) { return s + n.h; }, 0), gap = (b - t - total) / (ns.length - 1);
        let cur = t; ns.forEach(function (n) { n.y = cur; cur += n.h + gap; });
      }
    }, '对齐分布');
  }
  function zOrder(toTop) {
    const ids = selection;
    if (!ids.size) return;
    mutate(function () {
      const picked = S.nodes.filter(function (n) { return ids.has(n.id); });
      const rest = S.nodes.filter(function (n) { return !ids.has(n.id); });
      S.nodes = toTop ? rest.concat(picked) : picked.concat(rest);
    }, '调整层级');
  }

  /* ---------------- 工具 / 连线 ---------------- */
  function setTool(t) {
    tool = t; linkDraft = null; portDrag = null; zoneDraw = null; hoverId = null;
    if (t !== 'place') pendingIcon = null;
    $('btn-link').classList.toggle('active', t === 'link');
    $('btn-hand').classList.toggle('active', t === 'hand');
    $('btn-zone').classList.toggle('active', t === 'zone');
    $('btn-anchor').classList.toggle('active', t === 'anchor');
    svg.classList.toggle('tool-link', t === 'link');
    svg.classList.toggle('tool-hand', t === 'hand');
    svg.classList.toggle('tool-place', t === 'place');
    svg.classList.toggle('tool-zone', t === 'zone');
    svg.classList.toggle('tool-anchor', t === 'anchor' || t === 'link');
    if (t === 'place') $('hint-text').textContent = '点击画布放置「' + iconOf(pendingIcon).name + '」，Esc 取消';
    else if (t === 'link') $('hint-text').textContent = '点设备连设备 · 点区域空白处连区域 · 点画布空白自动建连接点；按住 Ctrl 强制连区域，Esc 退出';
    else if (t === 'zone') $('hint-text').textContent = '在画布上拖出一个矩形即可创建安全区域；框选资产后右键可一键打包，Esc 返回';
    else if (t === 'anchor') $('hint-text').textContent = '点击空白放置连接点（可作为链路端点、外部系统或注释锚点），Esc 返回';
    else if (t === 'hand') $('hint-text').textContent = '拖动画布平移视图，Esc 返回选择工具';
    else $('hint-text').textContent = '拖拽图标 · 双击改名 · 选中对象拖四边圆点直接连线 · R 画区域 · 空格/中键平移';
    repaint();
  }
  /* 连线终点解析：设备 > 区域 > 自由端点。空白处自动生成一个可命名的连接点 */
  function newAnchorAt(point, label) {
    return Object.assign({}, SCHEMA.ANCHOR_DEFAULTS, {
      id: SCHEMA.newId('a'), x: snapv(point.x), y: snapv(point.y), label: label || '连接点'
    });
  }
  function ensureAnchorAt(point, opts) {
    const id = hitTest(point, opts || {});
    if (id) return { id: id, anchor: null };
    const a = newAnchorAt(point, '外部连接点');
    return { id: a.id, anchor: a };
  }
  function makeLink(from, to, point, opts, pendingAnchor) {
    const res = to ? { id: to, anchor: pendingAnchor || null } : ensureAnchorAt(point, opts);
    const target = res.id;
    if (!target || from === target) { toast('连线需要两个不同的端点', 'warn'); return false; }
    const dup = S.links.find(function (l) {
      return (l.from === from && l.to === target) || (l.from === target && l.to === from);
    });
    if (dup) { toast('两个对象之间已存在连线', 'warn'); return false; }
    mutate(function () {
      if (res.anchor) anchorList().push(res.anchor);
      const l = Object.assign({}, SCHEMA.LINK_DEFAULTS, {
        id: SCHEMA.newId('l'), from: from, to: target, style: linkStyle,
        arrow: !!S.settings.arrowDefault
      });
      S.links.push(l); selection = new Set([l.id]);
    }, res.anchor ? '建立连线（含连接点）' : '建立连线');
    toast('连线已创建' + (res.anchor ? '，并在落点生成连接点' : ''));
    return true;
  }
  function inside(w, o, pad) {
    const p = pad || 0;
    return w.x >= o.x - p && w.x <= o.x + o.w + p && w.y >= o.y - p && w.y <= o.y + o.h + p;
  }
  /* 坐标命中：不再依赖 SVG 元素是否可点，区域内部空白处也能作为端点 */
  function hitTest(w, opts) {
    const o = opts || {};
    const as = anchorList();
    for (let i = as.length - 1; i >= 0; i--) if (inside(w, as[i], 13)) return as[i].id;
    if (!o.preferZone) {
      for (let i = S.nodes.length - 1; i >= 0; i--) if (inside(w, S.nodes[i])) return S.nodes[i].id;
    }
    /* 嵌套区域命中最内层；Ctrl 强制连区域时跳过设备 */
    const zs = S.zones.filter(function (z) { return inside(w, z); })
      .sort(function (a, b) { return a.w * a.h - b.w * b.h; });
    return zs.length ? zs[0].id : null;
  }
  function segmentHitsRect(p, q, r) {
    const minX = Math.min(p.x, q.x), maxX = Math.max(p.x, q.x);
    const minY = Math.min(p.y, q.y), maxY = Math.max(p.y, q.y);
    return maxX >= r.x && minX <= r.x + r.w && maxY >= r.y && minY <= r.y + r.h;
  }
  function computeGuides(primary, others, tx, ty) {
    const lines = [], sx = [tx, tx + primary.w / 2, tx + primary.w], sy = [ty, ty + primary.h / 2, ty + primary.h];
    let snapX = null, snapY = null;
    others.forEach(function (o) {
      const ox = [o.x, o.x + o.w / 2, o.x + o.w];
      sx.forEach(function (v) { ox.forEach(function (u) { if (Math.abs(v - u) < 6) { lines.push({ axis: 'v', v: u }); if (snapX === null) snapX = tx + (u - v); } }); });
      const oy = [o.y, o.y + o.h / 2, o.y + o.h];
      sy.forEach(function (v) { oy.forEach(function (u) { if (Math.abs(v - u) < 6) { lines.push({ axis: 'h', v: u }); if (snapY === null) snapY = ty + (u - v); } }); });
    });
    const uniq = [];
    lines.forEach(function (g) { if (!uniq.some(function (x) { return x.axis === g.axis && Math.abs(x.v - g.v) < 1; })) uniq.push(g); });
    return { lines: uniq.slice(0, 6), snapX: snapX, snapY: snapY };
  }

  /* ---------------- 指针交互 ---------------- */
  function onDown(e) {
    if (e.button === 2) return;
    closeMenus();
    const w = toWorld(e);
    lastWorld = w;
    const hit = e.target.closest ? e.target.closest('[data-id]') : null;
    const id = hit ? hit.getAttribute('data-id') : null;
    const handle = e.target.getAttribute ? e.target.getAttribute('data-handle') : null;
    const zoneFill = e.target.getAttribute ? e.target.getAttribute('data-zone-fill') : null;

    if (e.button === 1 || tool === 'hand' || e.altKey || spaceDown) {
      pan = { sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y };
      e.preventDefault(); return;
    }
    if (S.settings.readonly) {
      if (hit && id) { selection = new Set([id]); render(); }
      return;
    }
    /* 拖矩形快速画区域：比拖固定尺寸图标再调大小顺手得多 */
    if (tool === 'zone') {
      zoneDraw = { x: w.x, y: w.y, w: 0, h: 0, sx: w.x, sy: w.y };
      repaint(); return;
    }
    if (tool === 'anchor') {
      mutate(function () { anchorList().push(newAnchorAt(w)); }, '添加连接点');
      toast('已放置连接点，可双击改名'); repaint(); return;
    }
    if (tool === 'place' && pendingIcon) { addAt(pendingIcon, w.x - 54, w.y - 43); setTool('select'); return; }
    if (tool === 'link') {
      const preferZone = !!(e.ctrlKey || e.metaKey);
      let targetId = null;
      /* DOM 命中优先（精确点到设备时不被大区域覆盖），否则按世界坐标回退 */
      if (!preferZone && hit && id) {
        const kind = hit.getAttribute('data-kind');
        if (kind === 'node' || kind === 'zone' || kind === 'anchor') targetId = id;
      }
      const res = targetId ? { id: targetId, anchor: null } : ensureAnchorAt(w, { preferZone: preferZone });
      if (!linkDraft) {
        if (res.anchor) mutate(function () { anchorList().push(res.anchor); }, '添加连接点');
        linkDraft = { from: res.id, point: w };
      } else {
        const from = linkDraft.from;
        linkDraft = null;
        makeLink(from, res.id, null, null, res.anchor);
      }
      repaint(); return;
    }
    /* 选中对象的四边圆点：直接拖出连线，无需切换到连线工具 */
    if (handle === 'port' && id) {
      portDrag = { from: id, point: w, before: snapshot() };
      hoverId = null; repaint(); return;
    }
    if (handle === 'ep-from' || handle === 'ep-to') {
      endpointDrag = { lid: id, which: handle === 'ep-from' ? 'from' : 'to', point: w, before: snapshot() };
      repaint(); return;
    }
    /* 拖动区域标题 / 连线标注，位置自由摆放并写入工程 */
    if ((handle === 'zone-label' || handle === 'link-label') && id) {
      const fo = findObj(id);
      if (fo) labelDrag = {
        id: id, t: fo.t, sx: w.x, sy: w.y,
        dx: Number(fo.o.labelDx) || 0, dy: Number(fo.o.labelDy) || 0, before: snapshot()
      };
      repaint(); return;
    }
    if (hit && id) {
      if (e.shiftKey) {
        if (selection.has(id)) selection.delete(id); else selection.add(id);
        render(); return;
      }
      if (!selection.has(id)) selection = new Set([id]);
      render();
      if (handle && handle.indexOf('resize') === 0) {
        const fo = findObj(id);
        if (fo && fo.t !== 'link') {
          const dir = handle === 'resize' ? 'se' : handle.slice(7);
          resize = {
            id: id, t: fo.t, sx: w.x, sy: w.y, x: fo.o.x, y: fo.o.y, w: fo.o.w, h: fo.o.h,
            dir: RESIZE_DIRS.indexOf(dir) >= 0 ? dir : 'se', before: snapshot()
          };
        }
      } else if (zoneFill === '1') {
        /* 区域内部空白：单击选中区域；拖动时仍然框选，避免误把整个区域拖走 */
        marquee = { x: w.x, y: w.y, w: 0, h: 0, sx: w.x, sy: w.y, add: e.shiftKey, base: new Set(selection) };
      } else {
        const items = [];
        selection.forEach(function (sid) {
          const f = findObj(sid);
          if (f && f.t !== 'link') items.push({ t: f.t, o: f.o, x: f.o.x, y: f.o.y });
        });
        /* 拖动区域框时带上区域内资产 */
        const zoneIds = items.filter(function (it) { return it.t === 'zone'; }).map(function (it) { return it.o.id; });
        if (zoneIds.length) {
          S.nodes.forEach(function (n) {
            if (zoneIds.indexOf(n.parent) >= 0 && !items.some(function (it) { return it.o === n; })) {
              items.push({ t: 'node', o: n, x: n.x, y: n.y, follower: true });
            }
          });
        }
        const locked = items.some(function (it) {
          if (it.t === 'node') {
            const pz = S.zones.find(function (z) { return z.id === it.o.parent; });
            return it.o.locked || (pz && pz.locked);
          }
          return it.o.locked;
        });
        if (locked) { toast('对象或所属区域已锁定', 'warn'); return; }
        if (items.length) drag = { sx: w.x, sy: w.y, items: items, before: snapshot(), moved: false, guides: null };
      }
      return;
    }
    if (!e.shiftKey) selection.clear();
    marquee = { x: w.x, y: w.y, w: 0, h: 0, sx: w.x, sy: w.y, add: e.shiftKey, base: new Set(selection) };
    render();
  }
  function onMove(e) {
    const w = toWorld(e);
    lastWorld = w;
    if (pan) {
      S.view.x = pan.vx + (e.clientX - pan.sx); S.view.y = pan.vy + (e.clientY - pan.sy);
      repaint(); return;
    }
    if (zoneDraw) {
      zoneDraw.x = Math.min(zoneDraw.sx, w.x); zoneDraw.y = Math.min(zoneDraw.sy, w.y);
      zoneDraw.w = Math.abs(w.x - zoneDraw.sx); zoneDraw.h = Math.abs(w.y - zoneDraw.sy);
      repaint(); return;
    }
    if (portDrag) {
      portDrag.point = w; hoverId = hitTest(w, {});
      overlay.innerHTML = overlayHTML(); return;
    }
    if (linkDraft) {
      linkDraft.point = w; hoverId = hitTest(w, {});
      repaint(); return;
    }
    if (endpointDrag) {
      endpointDrag.point = w; hoverId = hitTest(w, {});
      overlay.innerHTML = overlayHTML(); return;
    }
    if (labelDrag) {
      const f = findObj(labelDrag.id);
      if (f) {
        f.o.labelDx = Math.round(labelDrag.dx + (w.x - labelDrag.sx));
        f.o.labelDy = Math.round(labelDrag.dy + (w.y - labelDrag.sy));
      }
      repaint(); return;
    }
    if (drag) {
      const dx = w.x - drag.sx, dy = w.y - drag.sy;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) drag.moved = true;
      const main = drag.items[0];
      const tx = main.x + dx, ty = main.y + dy;
      const others = S.nodes.filter(function (n) { return !drag.items.some(function (it) { return it.o === n; }); });
      const g = computeGuides(main.o, others, tx, ty);
      const fx = g.snapX !== null ? g.snapX : snapv(tx);
      const fy = g.snapY !== null ? g.snapY : snapv(ty);
      const finalDx = fx - main.x, finalDy = fy - main.y;
      drag.items.forEach(function (it) { it.o.x = snapv(it.x + finalDx); it.o.y = snapv(it.y + finalDy); });
      drag.guides = g.lines;
      repaintDrag(); return;
    }
    if (resize) {
      const f = findObj(resize.id);
      if (!f) return;
      const minW = f.t === 'zone' ? 160 : 70, minH = f.t === 'zone' ? 100 : 56;
      const dx = w.x - resize.sx, dy = w.y - resize.sy, d = resize.dir;
      let nx = resize.x, ny = resize.y, nw = resize.w, nh = resize.h;
      if (d.indexOf('e') >= 0) nw = Math.max(minW, snapv(resize.w + dx));
      if (d.indexOf('s') >= 0) nh = Math.max(minH, snapv(resize.h + dy));
      if (d.indexOf('w') >= 0) { nw = Math.max(minW, snapv(resize.w - dx)); nx = resize.x + resize.w - nw; }
      if (d.indexOf('n') >= 0) { nh = Math.max(minH, snapv(resize.h - dy)); ny = resize.y + resize.h - nh; }
      f.o.x = nx; f.o.y = ny; f.o.w = nw; f.o.h = nh;
      repaint(); return;
    }
    if (marquee) {
      marquee.x = Math.min(marquee.sx, w.x); marquee.y = Math.min(marquee.sy, w.y);
      marquee.w = Math.abs(w.x - marquee.sx); marquee.h = Math.abs(w.y - marquee.sy);
      repaint(); return;
    }
    /* 连线工具下的悬停提示：让「可连到什么」一目了然 */
    const h = tool === 'link' ? hitTest(w, {}) : null;
    if (h !== hoverId) { hoverId = h; overlay.innerHTML = overlayHTML(); }
  }
  function onUp() {
    if (zoneDraw) {
      const m = zoneDraw; zoneDraw = null;
      if (m.w > 40 && m.h > 40) {
        const x = snapv(m.x), y = snapv(m.y), zw = snapv(m.w), zh = snapv(m.h);
        mutate(function () {
          const z = Object.assign({}, SCHEMA.ZONE_DEFAULTS, {
            id: SCHEMA.newId('z'), x: x, y: y, w: zw, h: zh, label: '安全区域', color: '#3b82f6'
          });
          S.zones.push(z);
          /* 落入新区域的资产自动归属 */
          S.nodes.forEach(function (n) {
            const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
            if (cx >= x && cx <= x + zw && cy >= y && cy <= y + zh) { n.parent = z.id; if (!n.zone) n.zone = z.label; }
          });
          selection = new Set([z.id]);
        }, '绘制安全区域');
        toast('已创建安全区域，双击标签可改名');
      }
      render(); return;
    }
    if (portDrag) {
      const pd = portDrag; portDrag = null; hoverId = null;
      const res = ensureAnchorAt(pd.point, {});
      makeLink(pd.from, res.id, null, null, res.anchor);
      render(); return;
    }
    if (labelDrag) {
      pushHistory(labelDrag.before, '移动标注');
      labelDrag = null; render(); return;
    }
    if (drag) {
      if (drag.moved) {
        /* 重新推断节点归属区域 */
        S.nodes.forEach(function (n) {
          const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
          const z = S.zones.find(function (zz) { return cx >= zz.x && cx <= zz.x + zz.w && cy >= zz.y && cy <= zz.y + zz.h; });
          n.parent = z ? z.id : '';
          if (z && !n.zone) n.zone = z.label;
        });
        pushHistory(drag.before, '移动对象');
      }
      drag = null; render(); return;
    }
    if (endpointDrag) {
      const l = S.links.find(function (x) { return x.id === endpointDrag.lid; });
      const which = endpointDrag.which, before = endpointDrag.before, pt = endpointDrag.point;
      endpointDrag = null; hoverId = null;
      /* 松手在空白处时，自动生成一个连接点并把端点改接过去 */
      let target = hitTest(pt, {});
      const pending = target ? null : newAnchorAt(pt, '外部连接点');
      if (pending) target = pending.id;
      if (l && target) {
        const other = which === 'from' ? l.to : l.from;
        if (target !== other && target !== l[which]) {
          const lid = l.id;
          mutate(function () {
            if (pending) anchorList().push(pending);
            const ll = S.links.find(function (x) { return x.id === lid; });
            if (ll) ll[which] = target;
          }, '改接连线端点');
          toast('连线端点已改接' + (pending ? '，并生成连接点' : ''));
          return;
        }
      }
      pushHistory(before, '改接连线端点');
      render(); return;
    }
    if (resize) { pushHistory(resize.before, '调整尺寸'); resize = null; render(); return; }
    if (pan) { pan = null; updateStatus(); scheduleSave(); return; }
    if (marquee) {
      const m = marquee;
      if (m.w > 4 && m.h > 4) {
        const sel = new Set(m.add ? m.base : []);
        const r = { x: m.x, y: m.y, w: m.w, h: m.h };
        const overlaps = function (o) {
          return o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y;
        };
        S.nodes.forEach(function (n) { if (overlaps(n)) sel.add(n.id); });
        /* 区域只在被完整框住时才入选，避免框选设备时误选到外层大框 */
        S.zones.forEach(function (z) {
          if (z.x >= r.x && z.y >= r.y && z.x + z.w <= r.x + r.w && z.y + z.h <= r.y + r.h) sel.add(z.id);
        });
        anchorList().forEach(function (a) { if (inside({ x: a.x, y: a.y }, r)) sel.add(a.id); });
        S.links.forEach(function (l) {
          const a = endpointById(l.from), b = endpointById(l.to);
          if (a && b && segmentHitsRect(
            { x: a.x + a.w / 2, y: a.y + a.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, r)) sel.add(l.id);
        });
        selection = sel;
      }
      marquee = null; render(); return;
    }
  }
  function onWheel(e) {
    e.preventDefault();
    const p = toLocal(e);
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  }
  let lastContextWorld = { x: 0, y: 0 };
  function onContext(e) {
    e.preventDefault();
    lastContextWorld = toWorld(e);
    const hit = e.target.closest ? e.target.closest('[data-id]') : null;
    if (hit) { const id = hit.getAttribute('data-id'); if (!selection.has(id)) { selection = new Set([id]); render(); } }
    const menu = $('context-menu');
    /* CSS 按上下文裁剪菜单项，空白处右键只显示「在此新建」类命令 */
    menu.setAttribute('data-ctx', !hit ? 'blank' : (hit.getAttribute('data-kind') === 'link' ? 'link' : 'object'));
    menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.add('show');
  }
  function onDblClick(e) {
    if (S.settings.readonly) return;
    const hit = e.target.closest ? e.target.closest('[data-id]') : null;
    if (!hit) { $('asset-search').focus(); toast('已定位到资产搜索，输入名称后点击图标放置'); return; }
    const f = findObj(hit.getAttribute('data-id'));
    if (!f) return;
    openInlineEditor(f.o, f.t);
  }
  function openInlineEditor(o, t) {
    const ed = $('inline-editor');
    let wx = 0, wy = 0, ww = 140;
    if (t === 'link') {
      /* 连线没有 x/y，用路径中点定位，避免出现 NaN 坐标的编辑框 */
      const a = endpointById(o.from), b = endpointById(o.to);
      const p = a && b ? linkPath(a, b, o.style || 'ortho') : null;
      wx = p ? p.mx - 80 : 0; wy = p ? p.my - 24 : 0; ww = 160;
    } else if (t === 'zone') {
      const L = zoneLabelInfo(o); wx = L.x; wy = L.y; ww = L.w;
    } else if (t === 'anchor') {
      wx = o.x - 70; wy = o.y - 30; ww = 140;
    } else {
      wx = o.x + 6; wy = o.y + o.h - 34; ww = o.w - 12;
    }
    const p = worldToScreen(wx, wy);
    ed.style.left = p.x + 'px'; ed.style.top = p.y + 'px';
    ed.style.width = Math.max(120, ww * S.view.zoom) + 'px';
    ed.value = o.label || '';
    ed.dataset.target = o.id; ed.dataset.kind = t;
    ed.style.display = 'block'; ed.focus(); ed.select();
  }
  function commitInlineEditor() {
    const ed = $('inline-editor');
    if (ed.style.display === 'none') return;
    const id = ed.dataset.target, val = ed.value;
    ed.style.display = 'none';
    const f = findObj(id);
    if (!f || f.o.label === val) return;
    mutate(function () { f.o.label = val; }, '修改名称');
  }

  /* ---------------- 属性面板 ---------------- */
  const CAT_SHORT = { net: '网络', sec: '安全', host: '计算', data: '数据', zone: '区域', custom: '自定义' };
  function iconOptions(sel) {
    let h = ICONS.subgroups.map(function (g) {
      return '<optgroup label="' + (CAT_SHORT[g.cat] || '') + ' · ' + esc(g.name) + '">' +
        g.ids.map(function (id) { const i = ICONS.map[id]; return '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(i.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    if (customIcons.length) {
      h += '<optgroup label="自定义 · 自定义图标">' + customIcons.map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') + '</optgroup>';
    }
    return h;
  }
  function fldHTML(f, o, multi) {
    const v = multi ? '' : (o[f.k] == null ? '' : o[f.k]);
    const ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    let ctl;
    if (f.t === 'textarea') ctl = '<textarea data-field="' + f.k + '" rows="3"' + ph + '>' + esc(v) + '</textarea>';
    else if (f.t === 'select') ctl = '<select data-field="' + f.k + '">' + (multi ? '<option value="">不修改</option>' : '') +
      f.opts.map(function (x) { return '<option value="' + esc(x) + '"' + (String(v) === x ? ' selected' : '') + '>' + esc(x || '未指定') + '</option>'; }).join('') + '</select>';
    else if (f.t === 'ip') ctl = '<input data-field="' + f.k + '" type="text" value="' + esc(v) + '" placeholder="如 10.0.0.1">';
    else ctl = '<input data-field="' + f.k + '" type="text" value="' + esc(v) + '"' + ph + '>';
    return '<label class="fld" data-fld="' + f.k + '"><span>' + esc(f.n) + (f.req ? ' <i>*</i>' : '') + '</span>' + ctl +
      '<em class="fld-err"></em></label>';
  }
  function updateInspector(force) {
    const key = [...selection].sort().join('|') + '#' + selection.size;
    if (!force && key === inspectorKey) return;
    inspectorKey = key;
    const p = $('panel-prop');
    if (!selection.size) {
      p.innerHTML = '<div class="panel-empty"><div class="pe-ico">▣</div><h4>未选中对象</h4>' +
        '<p>单击资产、区域或连线编辑属性；双击名称可就地改名；从左侧拖拽图标添加资产。</p>' +
        '<div class="quick-tips"><b>快捷操作</b><span>拖拽图标 → 添加资产</span><span>连线工具 → 点击两个对象</span>' +
        '<span>选中连线拖端点 → 改接</span><span>拖动区域框 → 连框带设备一起移动</span>' +
        '<span>Shift 单击 → 多选</span><span>空格 / 中键拖动 → 平移</span></div></div>';
      return;
    }
    if (selection.size > 1) {
      const batchFields = ['zone', 'model', 'osType', 'note'];
      p.innerHTML = '<div class="panel-hd">批量编辑 <span>已选中 ' + selection.size + ' 项</span></div><div class="panel-body">' +
        '<div class="tip-box">以下字段留空则不修改，填写后统一应用到选中资产。</div>' +
        batchFields.map(function (k) { return fldHTML(SCHEMA.fieldByKey(k), null, true); }).join('') +
        '<label class="fld"><span>图标颜色</span><input data-field="color" type="text" data-lazy="1" placeholder="#2563eb，回车生效"></label>' +
        '<div class="btn-row"><button class="btn ghost" data-act="align-left">左对齐</button><button class="btn ghost" data-act="align-top">顶部对齐</button>' +
        '<button class="btn ghost" data-act="duplicate">复制</button><button class="btn danger" data-act="delete">删除</button></div></div>';
      return;
    }
    const f = findObj([...selection][0]);
    if (!f) { selection.clear(); updateInspector(true); return; }
    const o = f.o;
    if (f.t === 'node') {
      const isText = ICONS.textIds.indexOf(o.icon) >= 0;
      let h = '<div class="panel-hd">资产属性 <span title="' + esc(ICONS.catName(iconOf(o.icon).cat) + ' / ' + ICONS.subOf(o.icon)) + '">' +
        esc(ICONS.catName(iconOf(o.icon).cat) + ' · ' + ICONS.subOf(o.icon)) + '</span></div><div class="panel-body">';
      if (isText) {
        h += fldHTML({ k: 'label', n: '文本内容', t: 'textarea' }, o, false) + '<div class="tip-box">文本标注不进入资产清单与合规自检。</div>';
      } else {
        h += '<div class="fld-section"><div class="fld-sec-hd">基础信息</div>' +
          SCHEMA.ASSET_FIELDS.filter(function (x) { return x.g === 'basic'; }).map(function (x) { return fldHTML(x, o, false); }).join('') +
          '<label class="fld"><span>资产图标</span><select data-field="icon">' + iconOptions(o.icon) + '</select></label></div>';
      }
      h += '<div class="fld-section"><div class="fld-sec-hd">外观与尺寸</div><div class="fld-grid">' +
        '<label class="fld"><span>宽度</span><input data-field="w" type="number" min="60" step="2" value="' + o.w + '"></label>' +
        '<label class="fld"><span>高度</span><input data-field="h" type="number" min="50" step="2" value="' + o.h + '"></label></div>' +
        '<label class="fld"><span>图标颜色</span><div class="color-row"><input data-field="color" type="color" value="' +
        esc(o.color || ICONS.catColor(iconOf(o.icon).cat)) + '"><button class="btn tiny" data-act="reset-color">恢复默认</button></div></label>' +
        '<label class="fld fld-check"><span>锁定该资产（禁止拖动）</span><input data-field="locked" type="checkbox"' + (o.locked ? ' checked' : '') + '></label></div>';
      h += '<div class="btn-row"><button class="btn ghost" data-act="duplicate">复制资产</button><button class="btn ghost" data-act="center">定位居中</button>' +
        '<button class="btn danger" data-act="delete">删除</button></div></div>';
      p.innerHTML = h;
    } else if (f.t === 'zone') {
      const posIcon = { tl: '↖', tc: '↑', tr: '↗', ml: '←', mc: '·', mr: '→', bl: '↙', bc: '↓', br: '↘' };
      const posName = {
        tl: '左上', tc: '顶部居中', tr: '右上', ml: '左侧居中', mc: '正中',
        mr: '右侧居中', bl: '左下', bc: '底部居中', br: '右下'
      };
      const st = o.style || 'dash';
      p.innerHTML = '<div class="panel-hd">安全区域属性 <span>容器 / 标注</span></div><div class="panel-body">' +
        '<div class="fld-section"><div class="fld-sec-hd">标注内容 <small>可拖动画布上的标签</small></div>' +
        '<label class="fld"><span>区域名称（支持回车换行）</span><textarea data-field="label" rows="2">' + esc(o.label) + '</textarea></label>' +
        '<label class="fld"><span>说明文字 / 副标题</span><textarea data-field="desc" rows="2" placeholder="如 等保三级 · 边界访问控制">' + esc(o.desc || '') + '</textarea></label>' +
        '<div class="fld"><span>标签位置</span><div class="pos-grid">' +
        SCHEMA.ZONE_LABEL_POS.map(function (k) {
          return '<button data-pos="' + k + '" class="' + (o.labelPos === k ? 'active' : '') + '" title="' + posName[k] + '">' + posIcon[k] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="fld-grid">' +
        '<label class="fld"><span>字号</span><input data-field="labelSize" type="number" min="10" max="28" value="' + (o.labelSize || 13) + '"></label>' +
        '<label class="fld"><span>文字颜色</span><input data-field="labelColor" type="color" value="' + esc(o.labelColor || o.color || '#94a3b8') + '"></label></div>' +
        '<div class="fld-grid">' +
        '<label class="fld fld-check"><span>标签底色</span><input data-field="labelBg" type="checkbox"' + (o.labelBg !== false ? ' checked' : '') + '></label>' +
        '<label class="fld fld-check"><span>显示资产数</span><input data-field="showCount" type="checkbox"' + (o.showCount !== false ? ' checked' : '') + '></label></div>' +
        '<div class="fld-grid">' +
        '<label class="fld"><span>横向微调</span><input data-field="labelDx" type="number" step="2" value="' + (o.labelDx || 0) + '"></label>' +
        '<label class="fld"><span>纵向微调</span><input data-field="labelDy" type="number" step="2" value="' + (o.labelDy || 0) + '"></label></div>' +
        '<button class="btn ghost sm" data-act="reset-label">重置标签偏移</button></div>' +
        '<div class="fld-section"><div class="fld-sec-hd">外框与尺寸</div>' +
        '<label class="fld"><span>边框样式</span><select data-field="style">' +
        [['dash', '虚线边界'], ['solid', '实线边界'], ['dot', '点线边界'], ['none', '无边框']].map(function (x) {
          return '<option value="' + x[0] + '"' + (st === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
        }).join('') + '</select></label>' +
        '<label class="fld"><span>填充深浅（0 = 透明）</span><input data-field="fillOpacity" type="number" min="0" max="0.5" step="0.01" value="' +
        (o.fillOpacity == null ? 0.055 : o.fillOpacity) + '"></label>' +
        '<div class="fld-grid"><label class="fld"><span>宽度</span><input data-field="w" type="number" min="160" step="10" value="' + o.w + '"></label>' +
        '<label class="fld"><span>高度</span><input data-field="h" type="number" min="100" step="10" value="' + o.h + '"></label></div>' +
        '<label class="fld"><span>区域颜色</span><div class="color-row"><input data-field="color" type="color" value="' +
        esc(o.color || '#94a3b8') + '"><button class="btn tiny" data-act="reset-color">恢复默认</button></div></label>' +
        '<label class="fld fld-check"><span>锁定区域内全部资产</span><input data-field="locked" type="checkbox"' + (o.locked ? ' checked' : '') + '></label></div>' +
        '<div class="tip-box">区域是容器：拖动标签或边框会带上区域内资产；点内部空白处可选中 / 连线；八向手柄可自由改尺寸。区域内资产 ' +
        S.nodes.filter(function (n) { return n.parent === o.id; }).length + ' 个，相接链路 ' +
        S.links.filter(function (l) { return l.from === o.id || l.to === o.id; }).length + ' 条。</div>' +
        '<div class="btn-row"><button class="btn ghost" data-act="select-children">选中区域内资产</button>' +
        '<button class="btn ghost" data-act="center">定位居中</button>' +
        '<button class="btn danger" data-act="delete">删除区域</button></div></div>';
    } else if (f.t === 'anchor') {
      const used = S.links.filter(function (l) { return l.from === o.id || l.to === o.id; }).length;
      p.innerHTML = '<div class="panel-hd">连接点属性 <span>自由链路端点</span></div><div class="panel-body">' +
        '<label class="fld"><span>名称</span><input data-field="label" type="text" value="' + esc(o.label) + '" placeholder="如 外部系统 / 互联网 / 上行链路"></label>' +
        '<div class="fld-grid"><label class="fld"><span>X 坐标</span><input data-field="x" type="number" step="2" value="' + o.x + '"></label>' +
        '<label class="fld"><span>Y 坐标</span><input data-field="y" type="number" step="2" value="' + o.y + '"></label></div>' +
        '<label class="fld"><span>颜色</span><div class="color-row"><input data-field="color" type="color" value="' +
        esc(o.color || '#2563eb') + '"><button class="btn tiny" data-act="reset-color">恢复默认</button></div></label>' +
        '<label class="fld fld-check"><span>锁定（禁止拖动）</span><input data-field="locked" type="checkbox"' + (o.locked ? ' checked' : '') + '></label>' +
        '<div class="tip-box">连接点可作为链路端点，用来表示未画出的系统、云、外部网络或注释锚点；当前接入 ' + used +
        ' 条链路。拖动右侧蓝色小圆点可直接拉出新连线。</div>' +
        '<div class="btn-row"><button class="btn ghost" data-act="select-links">选中相关连线</button>' +
        '<button class="btn danger" data-act="delete">删除连接点</button></div></div>';
    } else {
      const a = endpointById(o.from), b = endpointById(o.to);
      const endOpts = function (sel) {
        const grp = function (title, arr) {
          return '<optgroup label="' + title + '">' + arr.map(function (x) {
            return '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.label) + '</option>';
          }).join('') + '</optgroup>';
        };
        return grp('资产', S.nodes) + grp('安全区域', S.zones) + grp('连接点', anchorList());
      };
      p.innerHTML = '<div class="panel-hd">连线属性 <span>链路</span></div><div class="panel-body">' +
        '<div class="link-fromto">' + esc(a ? a.label : '?') + ' <b>→</b> ' + esc(b ? b.label : '?') + '</div>' +
        '<div class="fld-section"><div class="fld-sec-hd">两端连接对象 <small>可直接改接</small></div>' +
        '<label class="fld"><span>起点</span><select data-field="from">' + endOpts(o.from) + '</select></label>' +
        '<label class="fld"><span>终点</span><select data-field="to">' + endOpts(o.to) + '</select></label>' +
        '<button class="btn ghost sm" data-act="swap-link">⇄ 交换起止方向</button></div>' +
        '<label class="fld"><span>链路标注</span><input data-field="label" type="text" value="' + esc(o.label) + '" placeholder="如 加密隧道 / 日志采集"></label>' +
        '<div class="fld-grid"><label class="fld"><span>标注横向微调</span><input data-field="labelDx" type="number" step="2" value="' + (o.labelDx || 0) + '"></label>' +
        '<label class="fld"><span>标注纵向微调</span><input data-field="labelDy" type="number" step="2" value="' + (o.labelDy || 0) + '"></label></div>' +
        '<label class="fld"><span>布线方式</span><select data-field="style"><option value="ortho"' + (o.style === 'ortho' ? ' selected' : '') +
        '>正交折线（自动避障）</option><option value="straight"' + (o.style === 'straight' ? ' selected' : '') + '>直线</option>' +
        '<option value="curve"' + (o.style === 'curve' ? ' selected' : '') + '>曲线</option></select></label>' +
        '<label class="fld"><span>线宽</span><input data-field="width" type="number" min="1" max="8" step="0.5" value="' + (o.width || 2) + '"></label>' +
        '<label class="fld fld-check"><span>虚线（管理 / 逻辑链路）</span><input data-field="dash" type="checkbox"' + (o.dash ? ' checked' : '') + '></label>' +
        '<label class="fld fld-check"><span>显示箭头</span><input data-field="arrow" type="checkbox"' + (o.arrow !== false ? ' checked' : '') + '></label>' +
        '<label class="fld"><span>线条颜色</span><div class="color-row"><input data-field="color" type="color" value="' +
        esc(o.color || '#64748b') + '"><button class="btn tiny" data-act="reset-color">恢复默认</button></div></label>' +
        '<div class="tip-box">端点可连资产、安全区域或连接点：拖动两端圆点改接，松手在空白处会自动新建连接点；标注可直接拖动。</div>' +
        '<div class="btn-row"><button class="btn ghost" data-act="apply-arrow-all">箭头应用到全部</button>' +
        '<button class="btn ghost" data-act="apply-style-all">线型应用到全部</button>' +
        '<button class="btn ghost" data-act="reset-label">重置标注位置</button>' +
        '<button class="btn danger" data-act="delete">删除连线</button></div></div>';
    }
  }
  function applyField(k, v, src) {
    const objs = [];
    selection.forEach(function (id) { const f = findObj(id); if (f) objs.push(f.o); });
    objs.forEach(function (o) {
      if (k === 'w' || k === 'h') o[k] = clamp(parseFloat(v) || 60, 60, 2000);
      else if (k === 'width') o.width = clamp(parseFloat(v) || 2, 1, 8);
      else if (k === 'dash' || k === 'arrow' || k === 'locked') o[k] = !!v;
      else if (selection.size > 1 && String(v) === '') return;
      else o[k] = v;
    });
  }
  function onPropInput(e) {
    const k = e.target.getAttribute('data-field');
    if (!k) return;
    const tag = e.target.tagName, type = (e.target.type || '').toLowerCase();
    if (e.target.hasAttribute('data-lazy')) return;
    if (!(tag === 'TEXTAREA' || type === 'text' || type === 'color')) return;
    if (!editBefore) editBefore = snapshot();
    const f = findObj([...selection][0]);
    const err = f && f.t === 'node' ? SCHEMA.validateField(f.o, k, e.target.value, S.nodes) : '';
    const box = e.target.closest('.fld');
    if (box) { const em = box.querySelector('.fld-err'); if (em) em.textContent = err; box.classList.toggle('invalid', !!err); }
    applyField(k, e.target.value);
    repaint();
  }
  function onPropChange(e) {
    const k = e.target.getAttribute('data-field');
    if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (editBefore) { pushHistory(editBefore, '编辑属性'); editBefore = null; render(); return; }
    const before = snapshot();
    applyField(k, v);
    pushHistory(before, '编辑属性');
    if (k === 'icon' || k === 'style') inspectorKey = '';
    render();
  }

  /* ---------------- 资产清单 ---------------- */
  function assetRows() { return S.nodes.filter(function (n) { return ICONS.textIds.indexOf(n.icon) < 0; }); }
  function renderAssetTable() {
    const rows = assetRows();
    /* label 已作为「资产名称」列单独渲染，字段循环中排除以免重复列 */
    const fields = SCHEMA.ASSET_FIELDS.filter(function (f) { return f.list && f.k !== 'label'; });
    $('asset-table-count').textContent = rows.length + ' 项资产';
    if (!rows.length) { $('asset-table-wrap').innerHTML = '<div class="empty-hint">画布中还没有资产，先从左侧资产库添加，或载入一个等保模板。</div>'; return; }
    $('asset-table-wrap').innerHTML = '<table class="asset-table"><thead><tr><th><input type="checkbox" id="check-all-rows" title="全选"></th><th>#</th>' +
      '<th>资产名称</th><th>资产分类</th>' + fields.map(function (f) { return '<th>' + esc(f.n) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (n, i) {
        return '<tr data-node="' + n.id + '"><td><input type="checkbox" class="row-check" data-row="' + n.id + '"' +
          (batchRows.has(n.id) ? ' checked' : '') + '></td><td>' + (i + 1) + '</td><td><b>' + esc(n.label) + '</b></td>' +
          '<td>' + esc(ICONS.subOf(n.icon)) + '</td>' + fields.map(function (f) {
            const v = f.k === 'zone' ? zoneOf(n) : (n[f.k] == null ? '' : n[f.k]);
            return '<td>' + esc(v) + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function exportCSV() {
    const rows = assetRows(), fields = SCHEMA.ASSET_FIELDS.filter(function (f) { return f.csv; });
    const head = ['序号', '资产名称', '资产大类', '资产子类', '资产类型'].concat(fields.filter(function (f) { return f.k !== 'label'; }).map(function (f) { return f.n; }));
    const q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    const body = rows.map(function (n, i) {
      const vals = [i + 1, n.label, ICONS.catName(iconOf(n.icon).cat), ICONS.subOf(n.icon), iconOf(n.icon).name];
      fields.filter(function (f) { return f.k !== 'label'; }).forEach(function (f) {
        vals.push(f.k === 'zone' ? zoneOf(n) : (n[f.k] == null ? '' : n[f.k]));
      });
      return vals.map(q).join(',');
    });
    const csv = '\ufeff' + head.map(q).join(',') + '\r\n' + body.join('\r\n');
    download('资产清单_' + (S.meta.name || '拓扑') + '.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      { text: csv, kind: 'CSV 资产清单 · ' + rows.length + ' 项' });
  }
  function applyBatch() {
    if (!batchRows.size) { toast('请先在清单中勾选资产', 'warn'); return; }
    const vals = {};
    $('batch-box').querySelectorAll('[data-batch]').forEach(function (el) { if (el.value) vals[el.getAttribute('data-batch')] = el.value; });
    if (!Object.keys(vals).length) { toast('没有填写要批量设置的内容', 'warn'); return; }
    mutate(function () {
      S.nodes.forEach(function (n) { if (batchRows.has(n.id)) Object.keys(vals).forEach(function (k) { n[k] = vals[k]; }); });
    }, '批量设置资产字段');
    toast('已更新 ' + batchRows.size + ' 项资产');
    renderAssetTable();
  }

  /* ---------------- 导出（裸图 / 报告版式） ---------------- */
  function buildExportSVG() {
    const b = bbox(), pad = 40, x = b.x - pad, y = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    clone.removeAttribute('class');
    const vp = clone.querySelector('#viewport'); if (vp) vp.setAttribute('transform', 'translate(0,0) scale(1)');
    const gb = clone.querySelector('#grid-bg'); if (gb) gb.remove();
    const ov = clone.querySelector('#layer-overlay'); if (ov) ov.innerHTML = '';
    clone.querySelectorAll('[data-handle]').forEach(function (e) { e.remove(); });
    clone.querySelectorAll('[tabindex]').forEach(function (e) { e.removeAttribute('tabindex'); });
    clone.querySelectorAll('[data-selected="1"]').forEach(function (e) {
      if (e.classList.contains('node-bg')) { e.setAttribute('stroke', '#d9e0ea'); e.setAttribute('stroke-width', '1.4'); }
      else { e.setAttribute('stroke', e.getAttribute('data-base-stroke') || '#94a3b8'); e.setAttribute('stroke-width', '1.6'); }
    });
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', h);
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
    return { xml: new XMLSerializer().serializeToString(clone), w: w, h: h, box: { x: x, y: y, w: w, h: h } };
  }
  function framedXml() {
    const o = buildExportSVG();
    return { xml: REPORT.frameSVG(o.xml, o.box, S.meta, S, ICONS), w: 1123, h: 794 };
  }
  function exportSVG(framed) {
    const o = framed ? framedXml() : buildExportSVG();
    download((S.meta.name || '拓扑') + (framed ? '_报告版式' : '') + '.svg',
      new Blob([o.xml], { type: 'image/svg+xml;charset=utf-8' }),
      { text: o.xml, kind: framed ? '报告版式 SVG（A4 横向）' : 'SVG 矢量图' });
  }
  function exportPNG(framed) {
    const o = framed ? framedXml() : buildExportSVG();
    const scale = framed ? 2 : 2;
    const url = URL.createObjectURL(new Blob([o.xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = function () {
      const cv = document.createElement('canvas');
      cv.width = o.w * scale; cv.height = o.h * scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (b) download((S.meta.name || '拓扑') + (framed ? '_报告版式' : '') + '.png', b,
          { kind: framed ? '报告版式 PNG（2×）' : 'PNG 图片（2×）' });
        else toast('PNG 导出失败，可改用 SVG', 'warn');
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('PNG 导出失败，可改用 SVG', 'warn'); };
    img.src = url;
  }
  function exportProject() {
    const d = JSON.parse(snapshot()); d.version = SCHEMA.VERSION; d.exportedAt = new Date().toISOString();
    const txt = JSON.stringify(d, null, 2);
    download((S.meta.name || '拓扑') + '.json', new Blob([txt], { type: 'application/json' }),
      { text: txt, kind: '工程 JSON v' + SCHEMA.VERSION });
  }
  function importProject(file) {
    const fr = new FileReader();
    fr.onload = function () {
      const v = SCHEMA.validate(fr.result);
      if (!v.ok) {
        alert('工程导入失败：\n\n' + v.errors.join('\n') + '\n\n请确认文件为本平台导出的 JSON。');
        toast('导入失败：' + v.errors[0], 'warn'); return;
      }
      const before = snapshot();
      const d = JSON.parse(fr.result);
      S = Object.assign(v.data, {
        view: v.view || d.view || { x: 60, y: 40, zoom: 1 },
        settings: Object.assign(S.settings, v.settings || d.settings || {})
      });
      selection = new Set(); history = []; future = [];
      pushHistory(before, '导入工程');
      syncToggles(); render(); renderAssets(); fit();
      toast('导入成功：' + S.nodes.length + ' 个资产' + (v.warnings.length ? '（' + v.warnings.join('；') + '）' : ''));
    };
    fr.readAsText(file, 'utf-8');
  }

  /* ---------------- 多页工程 / 基线 / 历史 ---------------- */
  function pageSnapshot() {
    return {
      id: SCHEMA.newId('page'), name: S.meta.name || '未命名页',
      data: { nodes: JSON.parse(JSON.stringify(S.nodes)), links: JSON.parse(JSON.stringify(S.links)),
        zones: JSON.parse(JSON.stringify(S.zones)), anchors: JSON.parse(JSON.stringify(anchorList())),
        notes: JSON.parse(JSON.stringify(S.notes)), meta: JSON.parse(JSON.stringify(S.meta)) },
      view: JSON.parse(JSON.stringify(S.view))
    };
  }
  function saveCurrentAsPage() { const p = pageSnapshot(); S.pages.push(p); return p; }
  function switchPage(id) {
    if (!id) return;
    const idx = S.pages.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return;
    const before = snapshot();
    saveCurrentAsPage();
    const target = S.pages.splice(idx, 1)[0];
    S.nodes = target.data.nodes; S.links = target.data.links; S.zones = target.data.zones;
    S.anchors = (target.data.anchors || []).slice();
    S.notes = target.data.notes; S.meta = target.data.meta; S.view = target.view;
    selection = new Set(); pushHistory(before, '切换页面'); render(); fit();
    toast('已切换到：' + target.name);
  }
  function addPage() {
    if (S.settings.readonly) { toast('只读评审模式下不可新增页面', 'warn'); return; }
    const before = snapshot();
    saveCurrentAsPage();
    const name = '第 ' + (S.pages.length + 1) + ' 页';
    S.nodes = []; S.links = []; S.zones = []; S.anchors = []; S.notes = [];
    S.meta = Object.assign({}, SCHEMA.META_DEFAULTS, { name: name, docNo: S.meta.docNo });
    S.view = { x: 60, y: 40, zoom: 1 };
    selection = new Set(); pushHistory(before, '新增页面'); render();
    toast('已新建 ' + name);
  }
  function deletePage(id) {
    mutate(function () { S.pages = S.pages.filter(function (p) { return p.id !== id; }); }, '删除页面');
    renderPages();
  }
  function renderPages() {
    const el = $('page-tabs');
    if (!el) return;
    el.innerHTML = '<button class="page-tab active" data-page="__current__" title="当前页">' + esc(S.meta.name || '当前页') + '</button>' +
      S.pages.map(function (p) {
        return '<button class="page-tab" data-page="' + p.id + '" title="' + esc(p.name) + '">' + esc(p.name) +
          '<span class="page-del" data-del="' + p.id + '">×</span></button>';
      }).join('') + '<button class="page-add" id="btn-add-page" title="新建页面">＋</button>';
  }
  function renderHistory() {
    const el = $('history-list');
    if (!el) return;
    const items = history.slice(-14).reverse();
    el.innerHTML = items.length ? items.map(function (h, i) {
      return '<div class="hist-item" data-hist="' + (history.length - 1 - i) + '"><span>' + esc(h.label) + '</span><em>' + esc(h.time) + '</em></div>';
    }).join('') : '<div class="empty-hint">暂无操作记录</div>';
  }
  function rollbackTo(idx) {
    if (idx < 0 || idx >= history.length) return;
    const label = history[idx].label;
    future.push(snapshot());
    restore(history[idx].data);
    history = history.slice(0, idx);
    selection = new Set(); render();
    toast('已回退到「' + label + '」之前');
  }
  function saveBaseline() {
    if (writeStore(BASELINE_KEY, JSON.parse(snapshot()))) toast('已保存整改前基线快照');
  }
  function compareBaseline() {
    const base = readStore(BASELINE_KEY, null);
    if (!base) { toast('还没有基线快照，请先点击「存为整改前基线」', 'warn'); return; }
    diffResult = SCHEMA.diff(base, S);
    const d = diffResult;
    $('diff-result').innerHTML = '<div class="diff-sum">' + esc(d.summary) + '</div>' +
      (d.added.length ? '<div class="diff-sec">新增：' + esc(d.added.map(function (x) { return x.label; }).join('、')) + '</div>' : '') +
      (d.removed.length ? '<div class="diff-sec">移除：' + esc(d.removed.map(function (x) { return x.label; }).join('、')) + '</div>' : '') +
      (d.changed.length ? '<div class="diff-sec">变更：' + esc(d.changed.slice(0, 6).map(function (x) { return x.label + '/' + x.field; }).join('、')) +
        (d.changed.length > 6 ? ' 等 ' + d.changed.length + ' 处' : '') + '</div>' : '') +
      '<button class="btn sm" id="btn-export-diff">导出差异清单</button>';
    $('btn-export-diff').onclick = function () {
      const txt = '\ufeff' + REPORT.diffText(d);
      download('整改前后差异_' + (S.meta.name || '拓扑') + '.txt',
        new Blob([txt], { type: 'text/plain;charset=utf-8' }), { text: txt, kind: '整改前后差异清单' });
    };
    switchLeft('project');
    toast('对比完成：' + d.summary);
  }

  /* ---------------- 菜单 / 标签 ---------------- */
  function closeMenus() {
    document.querySelectorAll('.menu.show, #context-menu.show').forEach(function (m) { m.classList.remove('show'); });
  }
  function switchLeft(which) {
    ['assets', 'templates', 'project'].forEach(function (k) {
      $('tab-' + k).classList.toggle('active', k === which);
      $('panel-' + k).classList.toggle('active', k === which);
    });
    if (which === 'project') { renderPages(); renderHistory(); }
  }
  function switchRight(which) {
    ['prop', 'list'].forEach(function (k) {
      $('tab-' + k).classList.toggle('active', k === which);
      $('panel-' + k).classList.toggle('active', k === which);
    });
    if (which === 'list') renderAssetTable();
  }
  function newProject(name) {
    const before = snapshot();
    S = emptyProject();
    S.meta.name = name || '未命名拓扑';
    selection = new Set(); history = []; future = [];
    pushHistory(before, '新建空白拓扑');
    syncToggles(); render(); toast('已新建空白拓扑');
  }
  function loadTemplate(id, silent) {
    const d = TPL.build(id);
    if (!d) return;
    const before = snapshot();
    S = Object.assign(d, { view: S.view, settings: S.settings, pages: S.pages, pageId: S.pageId });
    S.anchors = [];
    selection = new Set(); linkDraft = null;
    if (!silent) pushHistory(before, '载入模板：' + d.meta.name);
    setTool('select'); render();
    setTimeout(fit, 30);
    if (!silent) toast('已载入模板：' + d.meta.name + '（' + d.nodes.length + ' 个资产）');
  }
  function openReportModal() {
    ['docNo', 'security', 'author', 'org', 'date', 'name'].forEach(function (k) {
      const el = $('meta-' + k); if (el) el.value = S.meta[k] || '';
    });
    const groups = REPORT.legendData(S, ICONS);
    $('legend-preview').innerHTML = groups.length ? groups.map(function (g) {
      return '<div class="lg-group"><b style="color:' + esc(g.cat.color) + '">' + esc(g.cat.name) + '</b><span>' +
        esc(g.items.slice(0, 10).map(function (i) { return i.name; }).join('、')) + (g.items.length > 10 ? ' 等 ' + g.items.length + ' 项' : '') + '</span></div>';
    }).join('') : '<div class="empty-hint">画布中还没有资产</div>';
    $('report-modal').classList.add('show');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    svg.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', onContext);
    svg.addEventListener('dblclick', onDblClick);
    svg.addEventListener('dragover', function (e) { e.preventDefault(); });
    svg.addEventListener('drop', function (e) {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id || !ICONS.map[id]) return;
      const w = toWorld(e);
      addAt(id, w.x - 54, w.y - 43);
      toast('已添加：' + iconOf(id).name);
    });
    $('inline-editor').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitInlineEditor(); }
      if (e.key === 'Escape') { e.preventDefault(); this.style.display = 'none'; }
    });
    $('inline-editor').addEventListener('blur', commitInlineEditor);

    $('asset-grid').addEventListener('dragstart', function (e) {
      const it = e.target.closest('.asset-item'); if (!it) return;
      e.dataTransfer.setData('text/plain', it.getAttribute('data-icon'));
      e.dataTransfer.effectAllowed = 'copy';
    });
    $('asset-grid').addEventListener('click', function (e) {
      const hd = e.target.closest('.group-hd');
      if (hd) {
        const c = hd.getAttribute('data-collapse');
        if (collapsedCats.has(c)) collapsedCats.delete(c); else collapsedCats.add(c);
        renderAssets(); return;
      }
      const it = e.target.closest('.asset-item'); if (!it) return;
      pendingIcon = it.getAttribute('data-icon'); setTool('place');
    });
    $('asset-search').addEventListener('input', function (e) { assetFilter = e.target.value; renderAssets(); });
    $('asset-cats').addEventListener('click', function (e) {
      const b = e.target.closest('.cat-pill'); if (!b) return;
      activeCat = b.getAttribute('data-cat');
      if (activeCat !== 'all') collapsedCats.delete(activeCat);
      renderAssets();
    });
    $('btn-view-mode').onclick = function () { flatMode = !flatMode; renderAssets(); toast(flatMode ? '已切换为平铺视图' : '已切换为分组视图'); };
    $('btn-collapse-all').onclick = function () {
      const all = ICONS.categories.every(function (c) { return collapsedCats.has(c.id); });
      collapsedCats.clear();
      if (!all) ICONS.categories.forEach(function (c) { collapsedCats.add(c.id); });
      renderAssets();
    };
    $('tpl-list').addEventListener('click', function (e) {
      const c = e.target.closest('.tpl-card'); if (c) loadTemplate(c.getAttribute('data-tpl'));
    });
    $('btn-blank').onclick = function () { newProject('空白拓扑'); };
    ['assets', 'templates', 'project'].forEach(function (k) { $('tab-' + k).onclick = function () { switchLeft(k); }; });
    ['prop', 'list'].forEach(function (k) { $('tab-' + k).onclick = function () { switchRight(k); }; });

    $('btn-new').onclick = function () {
      if (S.settings.readonly) { toast('只读评审模式下不可新建', 'warn'); return; }
      if (!confirm('新建将清空当前页（其他页面与历史仍保留，可用撤销找回），确定继续？')) return;
      const before = snapshot();
      S.nodes = []; S.links = []; S.zones = []; S.anchors = []; S.notes = [];
      S.meta = Object.assign({}, SCHEMA.META_DEFAULTS, { name: '未命名拓扑' });
      selection = new Set(); S.view = { x: 60, y: 40, zoom: 1 };
      pushHistory(before, '清空画布'); render();
    };
    $('btn-undo').onclick = function () {
      if (!history.length) return;
      future.push(snapshot()); restore(history.pop().data); selection = new Set(); render();
    };
    $('btn-redo').onclick = function () {
      if (!future.length) return;
      history.push({ data: snapshot(), label: '重做前', time: new Date().toLocaleTimeString('zh-CN') });
      restore(future.pop()); selection = new Set(); render();
    };
    $('btn-link').onclick = function () { setTool(tool === 'link' ? 'select' : 'link'); };
    $('btn-hand').onclick = function () { setTool(tool === 'hand' ? 'select' : 'hand'); };
    $('btn-zone').onclick = function () { setTool(tool === 'zone' ? 'select' : 'zone'); };
    $('btn-anchor').onclick = function () { setTool(tool === 'anchor' ? 'select' : 'anchor'); };
    $('link-style').onchange = function () { linkStyle = this.value; };
    $('btn-arrow-default').onclick = function () {
      const cur = !!S.settings.arrowDefault;
      S.settings.arrowDefault = !cur;
      syncToggles(); scheduleSave();
      toast('新建连线将' + (S.settings.arrowDefault ? '带箭头' : '不带箭头') + '（已有连线不受影响）');
    };
    $('btn-delete').onclick = deleteSelected;
    $('btn-copy').onclick = copyToClipboard;
    $('btn-paste').onclick = pasteClipboard;
    $('btn-duplicate').onclick = duplicateSelected;
    $('btn-grid').onclick = function () { S.settings.grid = !S.settings.grid; syncToggles(); repaint(); scheduleSave(); };
    $('btn-snap').onclick = function () { S.settings.snap = !S.settings.snap; syncToggles(); toast('网格吸附已' + (S.settings.snap ? '开启' : '关闭')); scheduleSave(); };
    $('btn-minimap').onclick = function () { S.settings.minimap = !S.settings.minimap; syncToggles(); repaint(); scheduleSave(); };
    $('btn-readonly').onclick = function () {
      S.settings.readonly = !S.settings.readonly; syncToggles(); render();
      toast(S.settings.readonly ? '已进入只读评审模式（可选择、缩放，不能编辑）' : '已退出只读评审模式');
    };
    $('btn-zoom-out').onclick = function () { zoomAt(1 / 1.2); };
    $('btn-zoom-in').onclick = function () { zoomAt(1.2); };
    $('btn-fit').onclick = fit;
    /* 画布内浮动缩放按钮（原为 HTML 内联脚本，移入此处后可启用严格 CSP） */
    $('btn-zoom-out2').onclick = function () { $('btn-zoom-out').click(); };
    $('btn-zoom-in2').onclick = function () { $('btn-zoom-in').click(); };
    $('btn-import').onclick = function () { $('file-import').click(); };
    $('file-import').onchange = function () { if (this.files[0]) importProject(this.files[0]); this.value = ''; };
    $('btn-rename').onclick = function () {
      const v = prompt('项目名称 / 当前页名称', S.meta.name || '未命名拓扑');
      if (v && v.trim()) mutate(function () { S.meta.name = v.trim(); }, '重命名项目');
    };
    $('btn-report').onclick = openReportModal;
    $('report-close').onclick = function () { $('report-modal').classList.remove('show'); };
    $('btn-save-meta').onclick = function () {
      mutate(function () {
        ['docNo', 'security', 'author', 'org', 'date', 'name'].forEach(function (k) {
          const el = $('meta-' + k); if (el) S.meta[k] = el.value;
        });
      }, '设置报告版式');
      $('report-modal').classList.remove('show');
      toast('报告版式信息已保存');
    };
    $('btn-export-framed-png').onclick = function () { exportPNG(true); };
    $('btn-export-framed-svg').onclick = function () { exportSVG(true); };

    /* 导出结果面板：自动下载被拦截时的可见兜底 */
    $('export-close').onclick = function () { $('export-modal').classList.remove('show'); };
    $('exp-noshow').onchange = function () { writeStore('dengbao-skip-export-panel', !!this.checked); };
    $('export-modal').onclick = function (e) { if (e.target === this) this.classList.remove('show'); };
    $('exp-open').onclick = function () {
      if (exportCtx && exportCtx.url) { try { window.open(exportCtx.url, '_blank', 'noopener'); } catch (err) { toast('新窗口被拦截，请改用「保存到本地…」或「下载副本」', 'warn'); } }
    };
    $('exp-saveas').onclick = function () {
      if (!exportCtx || !window.showSaveFilePicker) return;
      window.showSaveFilePicker({ suggestedName: exportCtx.name }).then(function (h) {
        return h.createWritable().then(function (w) {
          return w.write(exportCtx.blob).then(function () { return w.close(); });
        });
      }).then(function () {
        toast('已保存到你选择的位置');
        $('export-modal').classList.remove('show');
      }).catch(function (err) {
        if (!err || err.name !== 'AbortError') toast('保存失败：' + ((err && err.message) || '未知错误'), 'warn');
      });
    };
    $('exp-copy').onclick = function () {
      if (!exportCtx || !exportCtx.text) return;
      const done = function () { toast('内容已复制到剪贴板，可直接粘贴到 Excel 或文本编辑器'); };
      const fallback = function () {
        try {
          const r = document.createRange(); r.selectNodeContents($('exp-preview'));
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          document.execCommand('copy');
          toast('已复制预览内容（完整内容请点「下载副本」）');
        } catch (e) { toast('复制失败，请手动选中预览框内容', 'warn'); }
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(exportCtx.text).then(done).catch(fallback);
        else fallback();
      } catch (e) { fallback(); }
    };

    $('help-modal').onclick = function (e) { if (e.target === this) this.classList.remove('show'); };
    $('btn-help').onclick = function () { $('help-modal').classList.add('show'); };
    $('help-close').onclick = function () { $('help-modal').classList.remove('show'); };

    document.querySelectorAll('[data-toggle-menu]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        const m = $(b.getAttribute('data-toggle-menu')), show = !m.classList.contains('show');
        closeMenus();
        if (!show) return;
        m.classList.add('show');
        /* 按按钮实际位置定位，避免被 .toolbar 的 overflow 裁剪；并做视口边界校正 */
        const r = b.getBoundingClientRect();
        const mw = m.offsetWidth || 190, mh = m.offsetHeight || 220;
        const vw = (typeof window.innerWidth === 'number' && window.innerWidth) || 1200;
        const vh = (typeof window.innerHeight === 'number' && window.innerHeight) || 800;
        let left = r.left, top = r.bottom + 4;
        if (left + mw > vw - 8) left = Math.max(8, vw - mw - 8);
        if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 4);
        m.style.left = left + 'px'; m.style.top = top + 'px';
      };
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.menu-wrap')) closeMenus(); });
    document.querySelectorAll('[data-align]').forEach(function (b) { b.onclick = function () { align(b.getAttribute('data-align')); closeMenus(); }; });
    document.querySelectorAll('[data-export]').forEach(function (b) {
      b.onclick = function () {
        const k = b.getAttribute('data-export'); closeMenus();
        if (k === 'png') exportPNG(false);
        else if (k === 'svg') exportSVG(false);
        else if (k === 'json') exportProject();
        else if (k === 'csv') exportCSV();
        else if (k === 'framed-png') exportPNG(true);
        else if (k === 'framed-svg') exportSVG(true);
        else if (k === 'diff-txt') compareBaseline();
        else if (k === 'last') { if (exportCtx) showExportModal(); else toast('还没有导出记录', 'warn'); }
      };
    });
    $('context-menu').addEventListener('click', function (e) {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.getAttribute('data-act'); closeMenus();
      if (a === 'copy') copyToClipboard();
      if (a === 'paste') pasteClipboard();
      if (a === 'duplicate') duplicateSelected();
      if (a === 'delete') deleteSelected();
      if (a === 'front') zOrder(true);
      if (a === 'back') zOrder(false);
      if (a === 'arrow-on' || a === 'arrow-off') {
        const ids = new Set(selection), val = a === 'arrow-on';
        mutate(function () {
          S.links.forEach(function (l) {
            /* 直接选中的连线，或与选中资产相连的连线，一并生效 */
            if (ids.has(l.id) || ids.has(l.from) || ids.has(l.to)) l.arrow = val;
          });
        }, '批量设置箭头');
        toast('已' + (val ? '显示' : '隐藏') + '所选及相关连线的箭头');
      }
      if (a === 'clear') { selection.clear(); render(); }
      if (a === 'pack-zone') {
        const ns = S.nodes.filter(function (n) { return selection.has(n.id); });
        if (!ns.length) { toast('请先选中至少一个资产再打包为区域', 'warn'); return; }
        const minX = Math.min.apply(null, ns.map(function (n) { return n.x; })) - 24;
        const minY = Math.min.apply(null, ns.map(function (n) { return n.y; })) - 44;
        const maxX = Math.max.apply(null, ns.map(function (n) { return n.x + n.w; })) + 24;
        const maxY = Math.max.apply(null, ns.map(function (n) { return n.y + n.h; })) + 24;
        mutate(function () {
          const z = Object.assign({}, SCHEMA.ZONE_DEFAULTS, {
            id: SCHEMA.newId('z'), x: Math.max(0, minX), y: Math.max(0, minY),
            w: maxX - minX, h: maxY - minY, label: '安全区域'
          });
          S.zones.push(z);
          ns.forEach(function (n) { n.parent = z.id; if (!n.zone) n.zone = z.label; });
          selection = new Set([z.id]);
        }, '打包为区域');
        toast('已将 ' + ns.length + ' 个资产打包进安全区域');
      }
      if (a === 'add-anchor') {
        mutate(function () { anchorList().push(newAnchorAt(lastContextWorld, '外部连接点')); }, '放置连接点');
        toast('已在空白处放置连接点，可改名并连入链路');
      }
    });

    $('panel-prop').addEventListener('input', onPropInput);
    $('panel-prop').addEventListener('change', onPropChange);
    $('panel-prop').addEventListener('click', function (e) {
      /* 区域标签九宫格位置选择 */
      const posEl = e.target.closest ? e.target.closest('[data-pos]') : null;
      if (posEl && posEl.getAttribute && posEl.getAttribute('data-pos')) {
        const k = posEl.getAttribute('data-pos');
        mutate(function () {
          selection.forEach(function (id) { const f = findObj(id); if (f && (f.t === 'zone')) f.o.labelPos = k; });
        }, '设置标签位置');
        return;
      }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.getAttribute('data-act');
      if (a === 'delete') deleteSelected();
      if (a === 'duplicate') duplicateSelected();
      if (a === 'center') { const f = findObj([...selection][0]); if (f) centerOn(f.o); }
      if (a === 'align-left') align('left');
      if (a === 'align-top') align('top');
      if (a === 'reset-color') mutate(function () { applyField('color', ''); }, '恢复默认颜色');
      if (a === 'reset-label') {
        const before = snapshot();
        mutate(function () {
          selection.forEach(function (id) {
            const f = findObj(id);
            if (f && (f.t === 'zone' || f.t === 'link')) { f.o.labelDx = 0; f.o.labelDy = 0; }
          });
        }, '重置标签偏移');
      }
      if (a === 'swap-link') {
        const cur = findObj([...selection][0]);
        if (cur && cur.t === 'link') {
          const lid = cur.o.id, f = cur.o.from, t = cur.o.to;
          mutate(function () { const l = S.links.find(function (x) { return x.id === lid; }); if (l) { l.from = t; l.to = f; } }, '交换连线方向');
          toast('已交换连线起止方向');
        }
      }
      if (a === 'select-links') {
        const cur = findObj([...selection][0]);
        if (cur && cur.t === 'anchor') {
          selection = new Set(S.links.filter(function (l) { return l.from === cur.o.id || l.to === cur.o.id; }).map(function (l) { return l.id; }));
          switchRight('prop'); render();
        }
      }
      if (a === 'apply-style-all') {
        const cur = findObj([...selection][0]);
        if (cur && cur.t === 'link') {
          const ref = cur.o;
          mutate(function () {
            S.links.forEach(function (l) {
              l.style = ref.style; l.dash = ref.dash; l.arrow = ref.arrow; l.width = ref.width;
              if (ref.color) l.color = ref.color;
            });
          }, '统一全图线型');
          toast('已把当前线型 / 虚线 / 箭头 / 颜色应用到全部 ' + S.links.length + ' 条连线');
        }
      }
      if (a === 'apply-arrow-all') {
        const cur = findObj([...selection][0]);
        if (cur && cur.t === 'link') {
          const val = cur.o.arrow !== false;
          mutate(function () { S.links.forEach(function (l) { l.arrow = val; }); }, '统一全图箭头');
          toast('已将 ' + S.links.length + ' 条连线设为' + (val ? '显示' : '隐藏') + '箭头');
        }
      }
      if (a === 'select-children') {
        const z = findObj([...selection][0]);
        if (z) { selection = new Set(S.nodes.filter(function (n) { return n.parent === z.o.id; }).map(function (n) { return n.id; })); render(); }
      }
    });
    $('asset-table-wrap').addEventListener('click', function (e) {
      const cb = e.target.closest('.row-check');
      if (cb) { if (cb.checked) batchRows.add(cb.getAttribute('data-row')); else batchRows.delete(cb.getAttribute('data-row')); return; }
      if (e.target.id === 'check-all-rows') {
        const on = e.target.checked; batchRows = new Set(on ? assetRows().map(function (n) { return n.id; }) : []);
        renderAssetTable(); $('check-all-rows').checked = on; return;
      }
      const tr = e.target.closest('[data-node]'); if (!tr) return;
      const n = nodeById(tr.getAttribute('data-node')); if (!n) return;
      selection = new Set([n.id]); switchRight('prop'); updateInspector(true); render(); centerOn(n);
    });
    $('btn-export-assets').onclick = exportCSV;
    $('btn-batch').onclick = function () { $('batch-box').classList.toggle('show'); };
    $('btn-batch-apply').onclick = applyBatch;
    $('page-tabs').addEventListener('click', function (e) {
      const del = e.target.closest('[data-del]');
      if (del) { if (confirm('删除该页面？此操作不可撤销。')) deletePage(del.getAttribute('data-del')); return; }
      if (e.target.closest('#btn-add-page')) { addPage(); return; }
      const tab = e.target.closest('[data-page]');
      if (tab && tab.getAttribute('data-page') !== '__current__') switchPage(tab.getAttribute('data-page'));
    });
    $('history-list').addEventListener('click', function (e) {
      const it = e.target.closest('[data-hist]');
      if (it) rollbackTo(parseInt(it.getAttribute('data-hist'), 10));
    });
    $('btn-save-baseline').onclick = saveBaseline;
    $('btn-diff-baseline').onclick = compareBaseline;
    $('btn-upload-icon').onclick = function () { $('file-icon').click(); };
    $('file-icon').onchange = function () {
      const f = this.files[0]; this.value = '';
      if (!f) return;
      const fr = new FileReader();
      fr.onload = function () {
        const body = sanitizeSvg(String(fr.result));
        if (!body) { toast('SVG 无法解析或含不安全内容，已拒绝导入', 'warn'); return; }
        const name = f.name.replace(/\.svg$/i, '').slice(0, 20) || '自定义设备';
        const c = { id: 'custom_' + Date.now().toString(36), name: name, body: body };
        customIcons.push(c); writeStore(CUSTOM_KEY, customIcons); registerCustomIcons(); renderAssets();
        toast('已导入自定义图标：' + name);
      };
      fr.readAsText(f, 'utf-8');
    };

    $('minimap').addEventListener('pointerdown', function (e) {
      const m = this._mini; if (!m) return;
      const r = this.getBoundingClientRect();
      const wx = (e.clientX - r.left - m.ox) / m.s, wy = (e.clientY - r.top - m.oy) / m.s;
      centerOnPoint(wx, wy);
    });

    $('start-l3').onclick = function () { $('start-modal').classList.remove('show'); loadTemplate('l3', true); };
    $('start-l2').onclick = function () { $('start-modal').classList.remove('show'); loadTemplate('l2', true); };
    $('start-blank').onclick = function () { $('start-modal').classList.remove('show'); newProject('空白拓扑'); };

    window.addEventListener('keydown', function (e) {
      const tag = (e.target.tagName || '').toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === 'Escape') {
        $('help-modal').classList.remove('show'); $('report-modal').classList.remove('show');
        $('start-modal').classList.remove('show'); $('export-modal').classList.remove('show');
        $('inline-editor').style.display = 'none'; closeMenus();
        linkDraft = null; portDrag = null; zoneDraw = null; labelDrag = null; hoverId = null;
        if (tool !== 'select') setTool('select'); else { selection.clear(); render(); }
        return;
      }
      if (editing) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? $('btn-redo').click() : $('btn-undo').click(); return; }
      if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); $('btn-redo').click(); return; }
      if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copyToClipboard(); return; }
      if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return; }
      if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); exportProject(); return; }
      if (ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selection = new Set(S.nodes.map(function (n) { return n.id; })
          .concat(S.zones.map(function (z) { return z.id; }))
          .concat(anchorList().map(function (a) { return a.id; }))
          .concat(S.links.map(function (l) { return l.id; })));
        render(); return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
      if (e.key === 'l' || e.key === 'L') { setTool(tool === 'link' ? 'select' : 'link'); return; }
      if (e.key === 'h' || e.key === 'H') { setTool(tool === 'hand' ? 'select' : 'hand'); return; }
      if (e.key === 'r' || e.key === 'R') { setTool(tool === 'zone' ? 'select' : 'zone'); return; }
      if (e.key === 'a' || e.key === 'A') { setTool(tool === 'anchor' ? 'select' : 'anchor'); return; }
      if (e.key === 'v' || e.key === 'V') { setTool('select'); return; }
      if (e.key === 't' || e.key === 'T') { pendingIcon = ICONS.textIds[0] || 'generic'; setTool('place'); return; }
      if (e.key === 'F2' && selection.size === 1) {
        const f = findObj([...selection][0]); if (f) openInlineEditor(f.o, f.t); return;
      }
      if (e.key === '0') { fit(); return; }
      if (e.key === '+' || e.key === '=') { zoomAt(1.2); return; }
      if (e.key === '-') { zoomAt(1 / 1.2); return; }
      if (e.key === ' ' && !e.repeat) { spaceDown = true; svg.classList.add('panning'); e.preventDefault(); return; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0 && selection.size) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 2, dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        mutate(function () {
          selection.forEach(function (id) { const f = findObj(id); if (f && f.t !== 'link') { f.o.x += dx; f.o.y += dy; } });
        }, '微调位置');
      }
    });
    window.addEventListener('keyup', function (e) { if (e.key === ' ') { spaceDown = false; svg.classList.remove('panning'); } });
    window.addEventListener('resize', function () { repaint(); });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadCustom();
    let loaded = false;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const v = SCHEMA.validate(parsed);
        if (v.ok && (v.data.nodes.length || v.data.zones.length)) {
          S = Object.assign(v.data, {
            view: parsed.view || { x: 60, y: 40, zoom: 1 },
            settings: Object.assign(S.settings, parsed.settings || {})
          });
          /* v2 及更早的工程把「默认带箭头」写进了 settings，升级 v3 时一并纠正 */
          if (!parsed.version || parsed.version < 3) S.settings.arrowDefault = false;
          loaded = true;
        }
      }
    } catch (err) {
      if (window.console) console.warn('本地工程恢复失败，已重置：', err);
      toast('上次工程恢复失败，已打开新画布（原数据未删除）', 'warn');
    }
    bind();
    syncToggles();
    renderAssets(); renderTemplates(); renderPages(); renderHistory();
    if (!loaded) {
      render();
      $('start-modal').classList.add('show');
      $('save-state').textContent = '新工程';
    } else {
      render(); setTimeout(fit, 30); toast('已恢复上次自动保存的工程');
    }
  }
  try { init(); }
  catch (err) {
    if (window.console) console.error(err);
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="padding:16px;background:#7f1d1d;color:#fff;font:14px sans-serif">初始化失败：' + esc(err && err.message) +
      '。请刷新页面，或清除浏览器本地数据后重试。</div>');
  }
})();
