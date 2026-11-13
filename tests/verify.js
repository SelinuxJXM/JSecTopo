/* ============================================================
 * 等保拓扑绘图平台 - 回归测试（node tests/verify.js）
 * 用轻量 DOM 桩在 Node 中真实执行全部 JS，覆盖数据模型、画布交互、
 * 报告导出、合规语义、工程管理等主要路径。无需浏览器。
 * ============================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['assets/js/icons.js', 'assets/js/schema.js', 'assets/js/templates.js',
  'assets/js/report.js', 'assets/js/app.js'];

class El {
  constructor(id) {
    this.id = id || ''; this._attrs = {}; this._html = ''; this.children = [];
    this.style = {}; this.listeners = {}; this.textContent = ''; this.value = '';
    this.disabled = false; this.tagName = 'DIV'; this.type = 'text'; this.checked = false;
    this.dataset = {}; this.files = []; this._content = '';
    const set = new Set();
    this.classList = {
      add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c),
      toggle: (c, f) => { if (f === undefined) f = !set.has(c); f ? set.add(c) : set.delete(c); return f; },
      _set: set
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k] === undefined ? null : this._attrs[k]; }
  removeAttribute(k) { delete this._attrs[k]; }
  hasAttribute(k) { return this._attrs[k] !== undefined; }
  addEventListener(t, f) { (this.listeners[t] || (this.listeners[t] = [])).push(f); }
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  insertBefore(c) { this.children.unshift(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); return c; }
  remove() {}
  cloneNode() { const e = new El(this.id); e._html = this._html; e._attrs = Object.assign({}, this._attrs); return e; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }; }
  click() { if (this.onclick) this.onclick({ target: this, preventDefault() {}, stopPropagation() {} }); }
  focus() {} select() {}
  insertAdjacentHTML() {}
}
function fake(attr, val, kind) {
  const e = new El();
  e.getAttribute = k => k === attr ? val : (k === 'data-kind' ? (kind || 'node') : null);
  e.closest = () => e;
  return e;
}

function createApp(preset, extraStore) {
  const els = {}, store = Object.assign({}, extraStore || {}), qsa = {};
  let lastBlob = null, lastUrlBlob = null, alerts = [];
  const winListeners = {};
  const document = {
    body: new El('body'),
    getElementById(id) { if (!els[id]) els[id] = new El(id); return els[id]; },
    createElement: () => new El(), createElementNS: () => new El(),
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll(sel) {
      if (sel.indexOf('data-toggle-menu') >= 0) return qsa.toggle || (qsa.toggle = [
        fake('data-toggle-menu', 'align-menu'), fake('data-toggle-menu', 'export-menu')]);
      if (sel.indexOf('data-align') >= 0) return qsa.align || (qsa.align = ['left', 'top'].map(a => fake('data-align', a)));
      if (sel.indexOf('data-export') >= 0) return qsa.export || (qsa.export =
        ['png', 'svg', 'framed-png', 'framed-svg', 'json', 'csv', 'diff-txt', 'last'].map(a => fake('data-export', a)));
      return [];
    }
  };
  const sandbox = {
    window: {
      addEventListener(t, f) { (winListeners[t] || (winListeners[t] = [])).push(f); },
      removeEventListener() {}, console: console
    },
    document,
    localStorage: {
      getItem: k => (store[k] === undefined ? null : store[k]),
      setItem: (k, v) => { store[k] = String(v); }
    },
    console, setTimeout, clearTimeout, Date, JSON, Math, Set, Map, RegExp, Error,
    parseInt, parseFloat, isNaN, Infinity, Promise,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    confirm: () => true, prompt: () => '重命名后的项目', alert: m => alerts.push(String(m)),
    Blob: class { constructor(p) { this.parts = p; lastBlob = this; } },
    URL: {
      createObjectURL: b => { lastUrlBlob = b; return 'blob:fake'; },
      revokeObjectURL() {}
    },
    XMLSerializer: class { serializeToString() { return '<svg/>'; } },
    Image: class {},
    FileReader: class {
      readAsText(file) { this.result = file._content || ''; if (this.onload) this.onload(); }
    }
  };
  vm.createContext(sandbox);
  if (preset) store['dengbao-topo-project-v2'] = JSON.stringify(preset);
  FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }));
  const G = id => (els[id] ? els[id].innerHTML : '');
  const count = (s, re) => (String(s).match(re) || []).length;
  const fire = (id, evt, target) => (els[id].listeners[evt] || [])[0] &&
    els[id].listeners[evt][0]({ target: target, preventDefault() {}, stopPropagation() {} });
  const winFire = (evt, e) => (winListeners[evt] || []).forEach(f => f(e));
  const svgFire = (evt, e) => (els.canvas.listeners[evt] || []).forEach(f => f(e));
  const click = id => els[id] && els[id].onclick && els[id].onclick({ target: els[id], preventDefault() {}, stopPropagation() {} });
  return {
    els, store, sandbox, G, count, fire, winFire, svgFire, click,
    alerts, alertsRef: () => alerts,
    blob: () => lastBlob, urlBlob: () => lastUrlBlob,
    qsa: () => qsa,
    winListeners
  };
}

/* 预置工程：坐标与 id 完全可控，便于精确断言交互结果 */
const PROJ = {
  version: 3,
  nodes: [
    { id: 'n1', icon: 'firewall', x: 100, y: 100, w: 108, h: 86, label: '边界防火墙', ip: '10.0.0.1', parent: 'z1', zone: 'DMZ区', osType: 'CentOS 7.9' },
    { id: 'n2', icon: 'web', x: 300, y: 100, w: 108, h: 86, label: 'Web服务器', ip: '10.0.1.10', parent: 'z1', zone: 'DMZ区' },
    { id: 'n3', icon: 'database', x: 600, y: 100, w: 108, h: 86, label: '业务数据库', ip: '10.0.2.1' }
  ],
  zones: [{ id: 'z1', icon: 'dmz', x: 60, y: 60, w: 400, h: 200, label: 'DMZ区', color: '#f59e0b' }],
  links: [
    { id: 'l1', from: 'n1', to: 'n2', style: 'ortho' },
    { id: 'l2', from: 'n2', to: 'n3', style: 'ortho' }
  ],
  notes: [],
  meta: { name: '测试工程', level: '三级', docNo: '图 1 被测系统拓扑图', security: '内部资料', author: '示例编制人', org: '示例单位', date: '2026-11-13' },
  view: { x: 0, y: 0, zoom: 1 },
  settings: { grid: true, snap: false, minimap: true, readonly: false }
};

const results = [];
function t(name, fn) {
  try { fn(); results.push(['OK  ', name]); }
  catch (e) { results.push(['FAIL', name + ' -> ' + e.message + (e.stack ? '\n      ' + e.stack.split('\n')[1].trim() : '')]); }
}

/* ---------- A. 纯模块层 ---------- */
const M = createApp(null).sandbox;
t('模块加载：图标 137 / 大类 5 / 子类 23', () => {
  const I = M.window.TopoIcons;
  if (I.icons.length !== 137 || I.categories.length !== 5 || I.subgroups.length !== 23) throw new Error('数量不符');
  const seen = {};
  I.subgroups.forEach(g => g.ids.forEach(id => { if (seen[id]) throw new Error('重复归类 ' + id); seen[id] = 1; }));
  if (I.icons.some(i => !i.sub || i.sub === '其他')) throw new Error('存在未归类图标');
});
t('schema：字段集仅保留 6 项且 normalize 补默认值', () => {
  const S = M.window.TopoSchema;
  const keys = S.ASSET_FIELDS.map(f => f.k).join(',');
  if (keys !== 'label,ip,model,osType,zone,note') throw new Error('字段集不符：' + keys);
  const p = S.normalize({ nodes: [{ id: 'a', icon: 'web', x: 10, y: 10, label: 'Web' }], zones: [{ id: 'z', x: 0, y: 0, w: 200, h: 200, label: 'DMZ' }] });
  if (p.nodes[0].osType !== '' || p.nodes[0].note !== '') throw new Error('字段未补齐');
  if (p.nodes[0].parent !== 'z') throw new Error('归属未推断');
  if (p.version !== S.VERSION) throw new Error('版本未升级');
});
t('schema：v3 默认去箭头，v2 工程一次性迁移', () => {
  const S = M.window.TopoSchema;
  if (S.VERSION < 3 || S.LINK_DEFAULTS.arrow !== false) throw new Error('全局默认值未改');
  const old = S.normalize({ version: 2, nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    links: [{ id: 'l', from: 'a', to: 'b', arrow: true }] });
  if (old.links.length !== 1 || old.links[0].arrow !== false) throw new Error('旧工程箭头未迁移');
  const now = S.normalize({ version: 3, nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    links: [{ id: 'l', from: 'a', to: 'b', arrow: true }] });
  if (now.links[0].arrow !== true) throw new Error('v3 中显式开启的箭头被误改');
});
t('schema：坏 JSON / 坏结构不白屏', () => {
  const S = M.window.TopoSchema;
  if (S.validate('{bad json').ok) throw new Error('坏 JSON 未拦截');
  if (S.validate({ nodes: 'x' }).ok) throw new Error('坏结构未拦截');
  const v = S.validate({ nodes: [{ id: 'a', x: 1, y: 2 }], links: [{ id: 'l', from: 'a', to: 'missing' }] });
  if (!v.ok || v.data.links.length !== 0 || !v.warnings.length) throw new Error('孤立连线未剔除');
});
t('schema：整改前后 diff 识别增删改', () => {
  const S = M.window.TopoSchema;
  const a = { nodes: [{ id: 'a', label: 'FW', model: 'AF-1000', note: '旧版' }] };
  const b = { nodes: [{ id: 'a', label: 'FW', model: 'AF-2000', note: '旧版' }, { id: 'b', label: 'WAF', model: 'WAF-500' }] };
  const d = S.diff(a, b);
  if (d.added.length !== 1 || d.changed.length !== 1) throw new Error('差异统计错误');
});
t('schema：IP 与必填校验', () => {
  const S = M.window.TopoSchema;
  if (!S.validateField({}, 'ip', '!!bad##', [])) throw new Error('非法 IP 未拦截');
  if (!S.validateField({}, 'label', '', [])) throw new Error('必填项未拦截');
  if (S.validateField({}, 'ip', '10.0.0.1', [])) throw new Error('合法 IP 被误判');
});
t('report：A4 版式含标题栏 / 图例 / 页脚', () => {
  const R = M.window.TopoReport;
  const xml = R.frameSVG('<svg viewBox="0 0 900 600"><rect x="0" y="0" width="900" height="600" fill="#fff"/></svg>',
    { x: 0, y: 0, w: 900, h: 600 }, PROJ.meta, PROJ, M.window.TopoIcons);
  if (!xml.includes('viewBox="0 0 1123 794"') || !xml.includes('图　例') || !xml.includes('内部资料')) throw new Error('版式要素缺失');
  if (!xml.includes('第 1 页')) throw new Error('页脚缺失');
});
t('templates：稳定 ID 与完整字段', () => {
  const T = M.window.TopoTemplates;
  const a = T.build('l3'), b = T.build('l3');
  if (a.nodes.length !== 29 || a.links.length !== 26 || a.zones.length !== 4) throw new Error('模板规模不符');
  if (a.nodes[0].id !== b.nodes[0].id) throw new Error('ID 不稳定');
  if (a.nodes[0].osType !== '' || a.nodes[0].note !== '') throw new Error('字段未补齐');
  if (a.nodes.filter(n => n.parent).length < 10) throw new Error('区域归属未推断');
  if (a.links.some(l => l.arrow !== false)) throw new Error('模板连线仍带箭头');
});

t('CSS：下拉定位 / 弹窗层级 / 侧栏宽度', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
  if (!/\.menu\{position:fixed/.test(css)) throw new Error('下拉菜单仍为 absolute 定位');
  if (!/\.toolbar\{[^}]*overflow-y:hidden/.test(css)) throw new Error('工具栏 overflow 规则异常');
  if (!/\.modal\{[^}]*z-index:300/.test(css)) throw new Error('弹窗层级低于浮层');
  if (!/\.workspace\{[^}]*grid-template-columns:232px minmax\(0,1fr\) 276px/.test(css)) throw new Error('侧边栏未压缩');
});

t('发布准备：仓库基础文件齐备且无敏感占位', () => {
  ['README.md', 'LICENSE', '.gitignore', 'package.json', '.github/workflows/test.yml', 'tests/check-release.js'].forEach(f => {
    if (!fs.existsSync(path.join(ROOT, f))) throw new Error('缺少 ' + f);
  });
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts['check:release']) throw new Error('缺少发布前自检入口');
  const tpl = fs.readFileSync(path.join(ROOT, 'assets/js/templates.js'), 'utf8');
  if (tpl.includes('1.1.1.' + '1')) throw new Error('模板仍含真实公网示例地址');
  if (!tpl.includes('198.51.100.1')) throw new Error('模板未改用 RFC5737 文档地址');
  const ign = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  if (!ign.includes('.workbuddy/')) throw new Error('未忽略本地工作数据');
  if (!ign.includes('/*.json') || !ign.includes('!/package.json')) throw new Error('未忽略根目录工程导出 JSON');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (/<script>[^<]*getElementById\('btn-zoom/.test(html)) throw new Error('仍存在内联脚本');
  const app = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  if (!app.includes("'btn-zoom-out2'") || !app.includes("'btn-zoom-in2'")) throw new Error('缩放按钮绑定丢失');
  const tv = fs.readFileSync(path.join(ROOT, 'tests/verify.js'), 'utf8');
  ['张' + '工', '测评' + '中心', 'C:' + '\\Users'].forEach(s => {
    if (tv.includes(s)) throw new Error('仍含示例单位 / 人员 / 本地路径：' + s);
  });
});

/* ---------- B. 首次启动 ---------- */
const A0 = createApp(null);
t('首次启动：显示起点选择而非强制灌入模板', () => {
  if (!A0.els['start-modal'].classList.contains('show')) throw new Error('未显示启动选择');
  if (A0.count(A0.G('layer-nodes'), /data-id=/g) !== 0) throw new Error('空白画布被填入内容');
});
t('启动选择：载入等保三级模板', () => {
  A0.click('start-l3');
  if (A0.count(A0.G('layer-nodes'), /data-id=/g) !== 29) throw new Error('模板节点数不符');
  if (A0.count(A0.G('layer-links'), /class="link"/g) !== 26) throw new Error('模板连线数不符');
});

const A2 = createApp({
  version: 2,
  nodes: [
    { id: 'oa', icon: 'router', x: 100, y: 100, w: 108, h: 86, label: '旧路由器' },
    { id: 'ob', icon: 'switch', x: 300, y: 100, w: 108, h: 86, label: '旧交换机' }
  ],
  links: [{ id: 'ol', from: 'oa', to: 'ob', style: 'ortho', arrow: true }],
  meta: { name: '旧工程' },
  settings: { grid: true, snap: false, minimap: true, readonly: false, arrowDefault: true },
  view: { x: 0, y: 0, zoom: 1 }
});
t('旧工程恢复：v2 箭头与默认开关一并迁移', () => {
  if (!A2.G('layer-nodes').includes('旧路由器')) throw new Error('旧工程未恢复');
  if (A2.els['btn-arrow-default'].classList.contains('active')) throw new Error('旧工程的默认箭头开关未纠正');
  if (A2.count(A2.G('layer-links'), /marker-end=/g) !== 0) throw new Error('旧工程连线仍带箭头');
});

/* ---------- C. 应用主体 ---------- */
const A = createApp(PROJ, {
  'dengbao-topo-custom-v2': JSON.stringify([{ id: 'custom_x1', name: '单位专用设备', body: '<rect x="2" y="2" width="44" height="44" rx="4" fill="none" stroke="currentColor"/>' }]),
  /* 故意残留旧版「最近使用」缓存，验证界面已彻底不读取它 */
  'dengbao-topo-recent-v2': JSON.stringify(['firewall', 'waf', 'ips'])
});
const ptrTarget = (id, kind, handle) => {
  const e = new El();
  e.getAttribute = k => k === 'data-id' ? id : k === 'data-kind' ? (kind || 'node') : k === 'data-handle' ? handle : null;
  e.closest = () => e;
  return e;
};
function pdown(target, x, y) {
  A.svgFire('pointerdown', { button: 0, clientX: x, clientY: y, target, shiftKey: false, altKey: false, preventDefault() {}, stopPropagation() {} });
}
function pmove(x, y) { A.winFire('pointermove', { clientX: x, clientY: y, target: {}, preventDefault() {} }); }
function pup() { A.winFire('pointerup', { clientX: 0, clientY: 0, target: {}, preventDefault() {} }); }

t('初始化：恢复预置工程并渲染三层', () => {
  if (A.count(A.G('layer-nodes'), /data-id=/g) !== 3) throw new Error('节点数不符');
  if (A.count(A.G('layer-links'), /class="link"/g) !== 2) throw new Error('连线数不符');
  if (!A.G('layer-zones').includes('DMZ区')) throw new Error('区域未渲染');
});
t('连线箭头：默认不带 / 开关 / 批量显示 / 应用到全部', () => {
  if (A.els['btn-arrow-default'].classList.contains('active')) throw new Error('全局默认仍为带箭头');
  if (A.count(A.G('layer-links'), /marker-end=/g) !== 0) throw new Error('初始连线仍带箭头');
  /* 开启默认后新建一条连线，应带箭头 */
  A.click('btn-arrow-default');
  if (!A.els['btn-arrow-default'].classList.contains('active')) throw new Error('默认箭头开关未开启');
  const c0 = A.count(A.G('layer-links'), /class="link"/g);
  A.click('btn-link');
  pdown(ptrTarget('n1', 'node', null), 150, 150);
  pdown(ptrTarget('n3', 'node', null), 650, 150);
  A.click('btn-link');
  if (A.count(A.G('layer-links'), /class="link"/g) !== c0 + 1) throw new Error('新连线未创建');
  if (A.count(A.G('layer-links'), /marker-end=/g) !== 1) throw new Error('开启默认后新连线未带箭头');
  A.click('btn-arrow-default');
  /* 选中资产 n1，右键批量显示：与该资产相连的 2 条连线生效 */
  pdown(ptrTarget('n1', 'node', null), 150, 150); pup();
  A.fire('context-menu', 'click', fake('data-act', 'arrow-on'));
  if (A.count(A.G('layer-links'), /marker-end=/g) !== 2) throw new Error('批量显示箭头未生效');
  /* 选中一条无箭头连线，把该样式应用到全部 */
  pdown(ptrTarget('l2', 'link', null), 450, 150); pup();
  A.fire('panel-prop', 'click', fake('data-act', 'apply-arrow-all'));
  if (A.count(A.G('layer-links'), /marker-end=/g) !== 0) throw new Error('应用到全部连线未生效');
});
t('资产库：5 大类 / 23 子类 / 137 图标 + 自定义分组', () => {
  const h = A.G('asset-grid');
  if (A.count(h, /class="asset-group/g) < 5) throw new Error('大类分组缺失');
  if (A.count(h, /class="sub-hd"/g) !== 23) throw new Error('子类数不符');
  const iconCount = A.count(h, /data-icon=/g);
  if (iconCount < 137 || iconCount > 142) throw new Error('内置图标未全部渲染：' + iconCount);
  if (!h.includes('自定义图标') || !h.includes('单位专用设备')) throw new Error('自定义图标未注册');
  if (h.includes('最近使用')) throw new Error('仍显示已移除的「最近使用」分组');
});
t('页面标签 / 迷你地图渲染', () => {
  if (!A.G('page-tabs').includes('测试工程')) throw new Error('页面标签缺失');
  if (!A.G('minimap').includes('<rect')) throw new Error('迷你地图未渲染');
});
t('真容器：拖动区域框带动区域内资产', () => {
  pdown(ptrTarget('z1', 'zone', null), 100, 70);
  pmove(140, 110); pup();
  const z = A.G('layer-zones'), n = A.G('layer-nodes');
  if (!z.includes('x="100" y="100"')) throw new Error('区域未移动：' + z.slice(0, 160));
  if (!n.includes('translate(140,140)')) throw new Error('子资产未跟随');
  if (!n.includes('translate(600,100)')) throw new Error('区域外资产被误移动');
});
t('智能对齐参考线：拖动时出现辅助线', () => {
  pdown(ptrTarget('n3', 'node', null), 650, 140);
  pmove(190, 140);
  if (!A.G('layer-overlay').includes('<line')) throw new Error('未生成对齐参考线');
  pup();
});
t('连线端点改接：拖到另一个资产', () => {
  pdown(ptrTarget('l2', 'link', null), 450, 140); pup();
  pdown(ptrTarget('l2', 'link', 'ep-to'), 660, 140);
  pmove(190, 210); pup();
  if (!A.G('panel-prop').includes('边界防火墙')) throw new Error('端点未改接：' + A.G('panel-prop').slice(0, 200));
});
t('双击内联编辑：改名写回画布', () => {
  A.svgFire('dblclick', { target: ptrTarget('n1', 'node', null), preventDefault() {}, stopPropagation() {} });
  const ed = A.els['inline-editor'];
  if (ed.style.display !== 'block' || ed.dataset.target !== 'n1') throw new Error('内联编辑器未打开');
  ed.value = '改造后的防火墙';
  (ed.listeners.keydown || [])[0]({ key: 'Enter', preventDefault() {} });
  if (!A.G('layer-nodes').includes('改造后的防火墙')) throw new Error('名称未写回');
});
t('属性面板：仅保留 7 项（6 字段 + 资产图标）', () => {
  pdown(ptrTarget('n1', 'node', null), 190, 180); pup();
  const p = A.G('panel-prop');
  const must = ['基础信息', '外观与尺寸', '资产名称', 'IP / 地址', '设备型号', '系统 / 版本', '所属安全区域', '备注说明', '资产图标'];
  must.forEach(k => { if (!p.includes(k)) throw new Error('缺少字段 ' + k); });
  const removed = ['测评信息', '测评对象编号', '责任部门', '责任人', '等保级别', '资产编号', '重要程度',
    '测评范围', '备份情况', '关联条款号', '测评结论', '证据 / 核查记录'];
  removed.forEach(k => { if (p.includes(k)) throw new Error('仍显示已移除字段 ' + k); });
});
t('批量编辑面板（多选）：字段同步精简', () => {
  A.winFire('keydown', { key: 'a', ctrlKey: true, target: { tagName: 'BODY' }, preventDefault() {} });
  const p = A.G('panel-prop');
  if (!p.includes('批量编辑') || !p.includes('系统 / 版本') || !p.includes('备注说明')) throw new Error('多选面板字段缺失');
  if (p.includes('责任部门') || p.includes('测评结论')) throw new Error('多选面板仍含已移除字段');
  A.winFire('keydown', { key: 'Escape', target: { tagName: 'BODY' }, preventDefault() {} });
  /* 恢复单选状态，供后续字段校验用例使用 */
  pdown(ptrTarget('n1', 'node', null), 190, 180); pup();
});
t('字段校验：非法 IP 显示错误提示', () => {
  const errEl = new El(); const box = new El();
  box.querySelector = () => errEl;
  const inp = { getAttribute: () => 'ip', tagName: 'INPUT', type: 'text', value: '!!bad##',
    hasAttribute: () => false, closest: () => box };
  A.fire('panel-prop', 'input', inp);
  if (!errEl.textContent) throw new Error('未产生校验提示');
  if (!box.classList.contains('invalid')) throw new Error('未标记无效状态');
});
t('资产清单：保留列与批量设置', () => {
  A.click('tab-list');
  const table = A.G('asset-table-wrap');
  if (!table.includes('系统 / 版本') || !table.includes('设备型号')) throw new Error('清单缺少保留字段列');
  if (table.includes('责任部门') || table.includes('测评结论')) throw new Error('清单仍含已移除列');
  if (A.count(table, /资产名称/g) !== 1) throw new Error('资产名称列重复');
  const cb = new El(); cb.checked = true; cb.getAttribute = () => 'n1'; cb.closest = () => cb;
  A.fire('asset-table-wrap', 'click', cb);
  const bb = A.sandbox.document.getElementById('batch-box');
  bb.querySelectorAll = () => [{ value: 'AF-9000', getAttribute: () => 'model' }];
  A.click('btn-batch-apply');
  if (!A.G('asset-table-wrap').includes('AF-9000')) throw new Error('批量设置未生效');
});
t('CSV：仅含保留字段列', () => {
  A.click('btn-export-assets');
  const txt = String((A.blob() && A.blob().parts[0]) || '');
  ['资产大类', '资产子类', '资产名称', 'IP / 地址', '设备型号', '系统 / 版本', '所属安全区域', '备注说明'].forEach(k => {
    if (!txt.includes(k)) throw new Error('CSV 缺列 ' + k);
  });
  ['测评对象编号', '责任部门', '证据 / 核查记录', '等保级别', '资产编号', '重要程度'].forEach(k => {
    if (txt.includes(k)) throw new Error('CSV 仍含已移除列 ' + k);
  });
  if (!A.els['export-modal'].classList.contains('show')) throw new Error('未显示导出结果面板');
  if (!/\.csv$/.test(A.els['exp-name'].textContent)) throw new Error('面板文件名不符');
  if (!A.els['exp-preview'].textContent.includes('资产名称')) throw new Error('内容预览为空');
  if (A.els['exp-copy'].style.display === 'none') throw new Error('文本导出未提供复制兜底');
  if (!A.els['exp-link'].getAttribute('download')) throw new Error('手动下载链接未设置');
  if (!A.els['toast'].textContent.includes('导出面板')) throw new Error('反馈仍误导为已下载');
});
t('导出兜底：查看上次导出 / 不再自动弹出开关', () => {
  A.els['export-modal'].classList.remove('show');
  const last = A.qsa().export.find(b => b.getAttribute('data-export') === 'last');
  last.onclick();
  if (!A.els['export-modal'].classList.contains('show')) throw new Error('查看上次导出未打开面板');
  const sw = A.els['exp-noshow'];
  sw.checked = true; sw.onchange.call(sw);
  A.els['export-modal'].classList.remove('show');
  A.click('btn-export-assets');
  if (A.els['export-modal'].classList.contains('show')) throw new Error('不再弹出开关未生效');
  if (!A.els['toast'].textContent.includes('查看上次导出')) throw new Error('未给出兜底入口提示');
  sw.checked = false; sw.onchange.call(sw);
});
t('工具栏下拉：fixed 定位并按按钮坐标显示', () => {
  const btn = A.qsa().toggle.find(b => b.getAttribute('data-toggle-menu') === 'export-menu');
  btn.onclick({ target: btn, stopPropagation() {}, preventDefault() {} });
  const m = A.els['export-menu'];
  if (!m.classList.contains('show')) throw new Error('导出菜单未打开');
  if (!m.style.left || !m.style.top) throw new Error('菜单未写入 fixed 定位坐标');
  m.classList.remove('show');
});
t('报告版式 SVG：含标题栏 / 图例 / 密级', () => {
  const btn = A.qsa().export.find(b => b.getAttribute('data-export') === 'framed-svg');
  btn.onclick();
  const txt = String((A.blob() && A.blob().parts[0]) || '');
  if (!txt.includes('viewBox="0 0 1123 794"') || !txt.includes('图　例') || !txt.includes('内部资料')) throw new Error('版式导出内容不符');
});
t('版式设置模态：图例预览与保存', () => {
  A.click('btn-report');
  if (!A.G('legend-preview').includes('安全防护设备')) throw new Error('图例预览为空');
  A.click('btn-save-meta');
});
t('基线与整改前后差异', () => {
  A.click('btn-save-baseline');
  const ed = A.els['inline-editor'];
  A.svgFire('dblclick', { target: ptrTarget('n2', 'node', null), preventDefault() {}, stopPropagation() {} });
  ed.value = '改造后的Web服务器';
  (ed.listeners.keydown || [])[0]({ key: 'Enter', preventDefault() {} });
  A.click('btn-diff-baseline');
  if (!A.G('diff-result').includes('变更') && !A.G('diff-result').includes('新增')) throw new Error('差异结果为空');
});
t('多页工程：新增页面后存档当前页', () => {
  const add = new El();
  add.closest = sel => (sel === '#btn-add-page' ? add : null);
  add.getAttribute = () => null;
  A.fire('page-tabs', 'click', add);
  const h = A.G('page-tabs');
  if (A.count(h, /class="page-tab/g) < 2) throw new Error('页面未增加：' + h.slice(0, 200));
});
t('操作历史面板有记录', () => {
  if (!A.G('history-list').includes('hist-item')) throw new Error('历史为空');
});
t('只读评审：拦截编辑且允许查看', () => {
  A.click('btn-readonly');
  if (!A.sandbox.document.body.classList.contains('readonly-mode')) throw new Error('只读标记缺失');
  const before = A.count(A.G('layer-nodes'), /data-id=/g);
  A.click('btn-new');
  if (A.count(A.G('layer-nodes'), /data-id=/g) !== before) throw new Error('只读模式仍被清空');
  A.click('btn-readonly');
});
t('导入校验：坏 JSON 被拒绝且不白屏', () => {
  const fi = A.els['file-import'];
  fi.files = [{ _content: '{ 不是合法 JSON' }];
  fi.onchange.call(fi);
  if (!A.alertsRef().length) throw new Error('未给出导入失败提示');
});
t('导入校验：合法工程可迁移', () => {
  const fi = A.els['file-import'];
  fi.files = [{ _content: JSON.stringify({ version: 1, nodes: [{ id: 'x', icon: 'router', x: 20, y: 20, label: '旧版路由器' }], meta: { name: '旧工程' } }) }];
  fi.onchange.call(fi);
  if (!A.G('layer-nodes').includes('旧版路由器')) throw new Error('旧版工程未导入');
});
t('数据模型 v4：区域标签九宫格 / 连接点 / 端点迁移', () => {
  const Sch = M.window.TopoSchema;
  if (Sch.VERSION !== 4) throw new Error('VERSION 应为 4，实际 ' + Sch.VERSION);
  if (!Sch.ZONE_DEFAULTS.labelPos) throw new Error('区域缺少 labelPos（标签位置）');
  if (Sch.ZONE_DEFAULTS.desc !== '') throw new Error('区域缺少多行说明字段');
  if (!Sch.ANCHOR_DEFAULTS) throw new Error('缺少 ANCHOR_DEFAULTS（连接点）');
  /* 含区域端点与连接点端点的连线应能通过校验 */
  const v = Sch.validate({
    version: 4, nodes: [{ id: 'n', icon: 'router', x: 0, y: 0, label: '路由器' }],
    zones: [{ id: 'z', x: 0, y: 0, w: 100, h: 100, label: '安全区' }],
    anchors: [{ id: 'a', x: 0, y: 0, label: '外部系统' }],
    links: [{ id: 'l', from: 'n', to: 'z', style: 'ortho' }, { id: 'l2', from: 'n', to: 'a', style: 'ortho' }],
    meta: { name: '迁移工程' }
  });
  if (!v.ok) throw new Error('含区域 / 连接点端点的连线校验失败：' + JSON.stringify(v.warnings));
  if (v.data.anchors.length !== 1) throw new Error('连接点未保留');
});
/* 以下交互用例各自使用干净工程实例，避免依赖测试顺序对全局画布状态的累积 */
function ptrFires(B, target, x, y) { B.svgFire('pointerdown', { button: 0, clientX: x, clientY: y, target: target, shiftKey: false, altKey: false, preventDefault() {}, stopPropagation() {} }); }
function pupFires(B) { B.winFire('pointerup', { clientX: 0, clientY: 0, target: {}, preventDefault() {} }); }
t('交互：连线可连到区域框（边界链路）', () => {
  const B = createApp(PROJ);
  B.click('btn-link');
  ptrFires(B, ptrTarget('n3', 'node', null), 650, 150);
  ptrFires(B, ptrTarget('z1', 'zone', null), 200, 150);
  const p = B.G('panel-prop');
  if (!p.includes('DMZ区')) throw new Error('连线未连到区域框：' + p.slice(0, 160));
  if (p.includes('?')) throw new Error('端点未正确解析');
});
t('交互：右键打包选中资产为区域', () => {
  const B = createApp(PROJ);
  ptrFires(B, ptrTarget('n3', 'node', null), 650, 150); pupFires(B);
  B.fire('context-menu', 'click', fake('data-act', 'pack-zone'));
  if (!B.G('layer-zones').includes('安全区域')) throw new Error('打包后未生成新区域');
});
t('交互：连线属性交换起止方向', () => {
  const B = createApp(PROJ);
  ptrFires(B, ptrTarget('l1', 'link', null), 250, 150); pupFires(B);
  const ftBefore = (B.G('panel-prop').match(/link-fromto">([\s\S]*?)<\/div>/) || [])[1] || '';
  B.fire('panel-prop', 'click', fake('data-act', 'swap-link'));
  const ftAfter = (B.G('panel-prop').match(/link-fromto">([\s\S]*?)<\/div>/) || [])[1] || '';
  if (ftAfter.indexOf('Web服务器') >= ftAfter.indexOf('边界防火墙')) throw new Error('方向未交换：before=' + ftBefore + ' after=' + ftAfter);
});
t('交互：连线属性线型应用到全部', () => {
  const B = createApp(PROJ);
  ptrFires(B, ptrTarget('l2', 'link', null), 450, 150); pupFires(B);
  B.fire('panel-prop', 'click', fake('data-act', 'apply-style-all'));
  if (B.count(B.G('layer-links'), /class="link"/g) < 2) throw new Error('应用线型后连线异常');
});
t('撤销 / 重做 / 复制粘贴 / 删除 / 对齐 / 网格 / 缩放不抛错', () => {
  ['btn-undo', 'btn-redo', 'btn-copy', 'btn-paste', 'btn-duplicate', 'btn-delete',
    'btn-grid', 'btn-snap', 'btn-minimap', 'btn-zoom-in', 'btn-zoom-out', 'btn-fit',
    'btn-link', 'btn-link', 'btn-hand', 'btn-hand', 'btn-help'].forEach(id => A.click(id));
  A.qsa().align.forEach(b => b.onclick && b.onclick());
});
t('四种普通导出与差异不抛错', () => {
  A.qsa().export.forEach(b => b.onclick && b.onclick());
});

setTimeout(() => {
  t('自动保存写入 localStorage（当前 schema 版本）', () => {
    if (!A.store['dengbao-topo-project-v2']) throw new Error('未保存');
    const d = JSON.parse(A.store['dengbao-topo-project-v2']);
    if (d.version !== M.window.TopoSchema.VERSION || !Array.isArray(d.nodes)) throw new Error('保存结构不正确');
  });
  let fail = 0;
  console.log('\n===== 等保拓扑平台回归测试 =====');
  results.forEach(r => { if (r[0] === 'FAIL') fail++; console.log(' ', r[0], r[1]); });
  console.log('================================');
  console.log('  通过 ' + (results.length - fail) + ' / ' + results.length + ' 项' + (fail ? '，存在失败项' : '，全部通过'));
  process.exitCode = fail ? 1 : 0;
}, 950);
