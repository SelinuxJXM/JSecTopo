/* ============================================================
 * 等保拓扑绘图平台 - 数据模型 / 字段定义 / 校验 / 版本对比
 * 纯函数模块，不依赖 DOM，可被测试直接加载
 * ============================================================ */
(function () {
  'use strict';

  const VERSION = 4;

  /* 资产字段定义：属性面板、资产清单、CSV 导出、整改差异对比共用同一份定义
   * 按用户确认，仅保留 6 个可填写字段（另有「资产图标」由属性面板单独渲染） */
  const ASSET_FIELDS = [
    { k: 'label',  n: '资产名称',      t: 'text',     g: 'basic', req: true,  list: true,  csv: true },
    { k: 'ip',     n: 'IP / 地址',     t: 'ip',       g: 'basic', list: true,  csv: true },
    { k: 'model',  n: '设备型号',      t: 'text',     g: 'basic', list: true,  csv: true },
    { k: 'osType', n: '系统 / 版本',   t: 'text',     g: 'basic', list: true,  csv: true },
    { k: 'zone',   n: '所属安全区域',  t: 'text',     g: 'basic', list: true,  csv: true },
    { k: 'note',   n: '备注说明',      t: 'textarea', g: 'basic', list: false, csv: true }
  ];
  const FIELD_GROUPS = [
    { id: 'basic', name: '基础信息' },
    { id: 'style', name: '外观与尺寸' }
  ];
  const fieldByKey = function (k) { return ASSET_FIELDS.find(function (f) { return f.k === k; }); };

  const NODE_DEFAULTS = {
    icon: 'generic', x: 0, y: 0, w: 108, h: 86,
    label: '', ip: '', model: '', osType: '', zone: '', note: '',
    color: '', parent: '', locked: false
  };
  /* v3 起连线默认不带箭头：物理链路用无箭头连线，需要方向时再单独开启 */
  const LINK_DEFAULTS = {
    from: '', to: '', style: 'ortho', label: '', dash: false, arrow: false, color: '', width: 2,
    /* v4：链路标注可拖动离开默认位置 */
    labelDx: 0, labelDy: 0,
    /* v4 兼容增强：正交折线手动拐点（沿走线轴的坐标）；null 表示仍由自动避障选点 */
    bend: null
  };
  /* v4 区域框标注：位置、多行说明、字号 / 颜色 / 底色、边框变体均可调 */
  const ZONE_LABEL_POS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
  const ZONE_STYLES = ['dash', 'solid', 'dot', 'none'];
  const ZONE_DEFAULTS = {
    icon: 'zone-box', x: 0, y: 0, w: 340, h: 220, label: '安全区域', color: '',
    style: 'dash', locked: false,
    desc: '', labelPos: 'tl', labelSize: 13, labelColor: '', labelBg: true,
    fillOpacity: 0.055, showCount: true, labelDx: 0, labelDy: 0
  };
  /* v4 自由端点：连线可以落在画布空白处，形成可命名、可拖动的「连接点」 */
  const ANCHOR_DEFAULTS = { x: 0, y: 0, w: 0, h: 0, label: '连接点', color: '', locked: false };
  const META_DEFAULTS = {
    name: '未命名拓扑', version: VERSION,
    docNo: '图 1 被测系统网络拓扑图', security: '内部资料', author: '', org: '', date: ''
  };

  let seq = 0;
  function newId(p) {
    seq += 1;
    return (p || 'x') + '_' + seq.toString(36) + Math.random().toString(36).slice(2, 6);
  }
  /* 模板/导入等场景使用的确定性 ID，保证同一模板重复载入 ID 一致 */
  function stableId(prefix, index) { return prefix + '_' + index; }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /* 补全旧版工程、迁移字段、生成稳定 ID */
  function normalize(raw, opts) {
    const d = raw && typeof raw === 'object' ? raw : {};
    /* v2 及更早的工程 / 模板里连线默认带箭头，升级到 v3 时一次性去掉 */
    const legacyArrows = !d.version || d.version < 3;
    const nodes = (Array.isArray(d.nodes) ? d.nodes : []).map(function (n, i) {
      const o = Object.assign({}, NODE_DEFAULTS, n || {});
      o.id = o.id || stableId('n', i);
      o.x = isNum(o.x) ? o.x : 0; o.y = isNum(o.y) ? o.y : 0;
      o.w = isNum(o.w) && o.w > 0 ? o.w : 108; o.h = isNum(o.h) && o.h > 0 ? o.h : 86;
      o.label = String(o.label || '未命名资产');
      return o;
    });
    const bounded = function (v, def, lo, hi) {
      return isNum(v) ? Math.max(lo, Math.min(hi, v)) : def;
    };
    const zones = (Array.isArray(d.zones) ? d.zones : []).map(function (z, i) {
      const o = Object.assign({}, ZONE_DEFAULTS, z || {});
      o.id = o.id || stableId('z', i);
      o.x = isNum(o.x) ? o.x : 0; o.y = isNum(o.y) ? o.y : 0;
      o.w = isNum(o.w) && o.w > 0 ? o.w : 340; o.h = isNum(o.h) && o.h > 0 ? o.h : 220;
      o.label = String(o.label || '安全区域');
      o.desc = String(o.desc || '');
      o.labelPos = ZONE_LABEL_POS.indexOf(o.labelPos) >= 0 ? o.labelPos : 'tl';
      o.style = ZONE_STYLES.indexOf(o.style) >= 0 ? o.style : 'dash';
      o.labelSize = bounded(o.labelSize, 13, 10, 28);
      o.fillOpacity = bounded(o.fillOpacity, 0.055, 0, 0.5);
      o.labelDx = bounded(o.labelDx, 0, -2000, 2000);
      o.labelDy = bounded(o.labelDy, 0, -2000, 2000);
      o.labelBg = o.labelBg !== false;
      o.showCount = o.showCount !== false;
      o.labelColor = String(o.labelColor || '');
      return o;
    });
    /* 自由端点：旧工程没有该数组，补空即可；连线端点引用它时不会被剔除 */
    const anchors = (Array.isArray(d.anchors) ? d.anchors : []).map(function (a, i) {
      const o = Object.assign({}, ANCHOR_DEFAULTS, a || {});
      o.id = o.id || stableId('a', i);
      o.x = isNum(o.x) ? o.x : 0; o.y = isNum(o.y) ? o.y : 0;
      o.w = 0; o.h = 0;
      o.label = String(o.label || '连接点');
      return o;
    });
    /* 自动推断节点归属（旧版工程没有 parent 字段）。
     * 已有 zone 文本时优先按同名区域建立归属；无同名区域则保留该自由文本，
     * 避免模板预设 / 手工填写的「网络边界」等逻辑区域在保存重载后被位置推断清空。 */
    /* 归属推断只适用于导入旧工程：撤销/重做恢复快照时必须原样还原，
     * 否则用户在属性面板刻意清空归属后，一撤销就会被坐标推断重新挂回区域。 */
    const hasParent = nodes.some(function (n) { return !!n.parent; });
    if (!hasParent && !(opts && opts.inferParent === false)) {
      nodes.forEach(function (n) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const zs = zones.filter(function (zz) { return cx >= zz.x && cx <= zz.x + zz.w && cy >= zz.y && cy <= zz.y + zz.h; })
          .sort(function (a, b) { return a.w * a.h - b.w * b.h; });
        const z = zs[0];
        if (n.zone) {
          const same = zones.find(function (zz) { return zz.label === n.zone; });
          if (same) n.parent = same.id;
          else if (z) { n.parent = z.id; n.zone = z.label; }
        } else if (z) {
          n.parent = z.id; n.zone = z.label;
        }
      });
    }
    const ids = {};
    nodes.forEach(function (n) { ids[n.id] = 1; });
    zones.forEach(function (z) { ids[z.id] = 1; });
    anchors.forEach(function (a) { ids[a.id] = 1; });
    const links = (Array.isArray(d.links) ? d.links : []).map(function (l, i) {
      const o = Object.assign({}, LINK_DEFAULTS, l || {});
      o.id = o.id || stableId('l', i);
      if (legacyArrows) o.arrow = false;
      o.labelDx = bounded(o.labelDx, 0, -2000, 2000);
      o.labelDy = bounded(o.labelDy, 0, -2000, 2000);
      o.bend = bounded(o.bend, null, -6000, 6000);
      return o;
    }).filter(function (l) { return ids[l.from] && ids[l.to]; });

    const meta = Object.assign({}, META_DEFAULTS, d.meta || {});
    meta.version = VERSION;
    if (!meta.date) meta.date = new Date().toLocaleDateString('zh-CN');
    return {
      version: VERSION, nodes: nodes, links: links, zones: zones, anchors: anchors,
      notes: Array.isArray(d.notes) ? d.notes : [], meta: meta,
      pages: Array.isArray(d.pages) ? d.pages : [], pageId: d.pageId || ''
    };
  }

  /* 视图参数兜底：手工篡改 / 损坏工程里的 zoom="abc" 会让画布 transform 变成 scale(abc)，整张图消失 */
  function sanitizeView(v) {
    const d = { x: 60, y: 40, zoom: 1 };
    if (!v || typeof v !== 'object' || Array.isArray(v)) return d;
    const num = function (n, def) { const f = parseFloat(n); return isFinite(f) ? f : def; };
    const z = num(v.zoom, d.zoom);
    return { x: num(v.x, d.x), y: num(v.y, d.y), zoom: Math.max(0.15, Math.min(3, z)) };
  }

  /* 导入校验：坏 JSON / 结构异常不会白屏 */
  function validate(input) {
    const errors = [], warnings = [];
    let raw = input;
    if (typeof input === 'string') {
      try { raw = JSON.parse(input); }
      catch (e) { return { ok: false, errors: ['文件不是合法的 JSON：' + e.message], warnings: [], data: null }; }
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, errors: ['工程根节点必须是对象'], warnings: [], data: null };
    }
    const p = raw.project && typeof raw.project === 'object' ? raw.project : raw;
    if (!Array.isArray(p.nodes)) errors.push('缺少 nodes 数组');
    if (p.links !== undefined && !Array.isArray(p.links)) warnings.push('links 不是数组，已忽略');
    if (p.zones !== undefined && !Array.isArray(p.zones)) warnings.push('zones 不是数组，已忽略');
    if (p.anchors !== undefined && !Array.isArray(p.anchors)) warnings.push('anchors 不是数组，已忽略');
    if (Array.isArray(p.anchors) && p.anchors.length > 500) errors.push('连接点数量超过 500，拒绝导入');
    if (Array.isArray(p.nodes) && p.nodes.length > 2000) errors.push('资产数量超过 2000，拒绝导入');
    if (Array.isArray(p.nodes)) {
      p.nodes.forEach(function (n, i) {
        if (!n || typeof n !== 'object') errors.push('第 ' + (i + 1) + ' 个资产不是对象');
        else if (!isNum(n.x) || !isNum(n.y)) warnings.push('第 ' + (i + 1) + ' 个资产坐标无效，已置为 0');
      });
    }
    if (errors.length) return { ok: false, errors: errors, warnings: warnings, data: null };
    const data = normalize(p);
    if (raw.version && raw.version !== VERSION) warnings.push('工程版本 v' + raw.version + ' 已自动迁移到 v' + VERSION);
    if (data.links.length < (Array.isArray(p.links) ? p.links.length : 0)) {
      warnings.push('已剔除 ' + ((p.links || []).length - data.links.length) + ' 条端点不存在的连线');
    }
    return { ok: true, errors: [], warnings: warnings, data: data, view: raw.view, settings: raw.settings };
  }

  /* 整改前 / 后差异对比 */
  function diff(base, curr) {
    const a = normalize(base), b = normalize(curr);
    const key = function (n) { return String(n.label || '').trim() || n.id; };
    const am = {}, bm = {};
    a.nodes.forEach(function (n) { am[key(n)] = n; });
    b.nodes.forEach(function (n) { bm[key(n)] = n; });
    const added = [], removed = [], changed = [];
    Object.keys(bm).forEach(function (k) { if (!am[k]) added.push({ key: k, label: bm[k].label, type: bm[k].icon }); });
    Object.keys(am).forEach(function (k) { if (!bm[k]) removed.push({ key: k, label: am[k].label, type: am[k].icon }); });
    Object.keys(bm).forEach(function (k) {
      if (!am[k]) return;
      ASSET_FIELDS.forEach(function (f) {
        const before = String(am[k][f.k] == null ? '' : am[k][f.k]);
        const after = String(bm[k][f.k] == null ? '' : bm[k][f.k]);
        if (before !== after) changed.push({ key: k, label: bm[k].label, field: f.n, from: before, to: after });
      });
    });
    return {
      added: added, removed: removed, changed: changed,
      linkDelta: b.links.length - a.links.length,
      zoneDelta: b.zones.length - a.zones.length,
      anchorDelta: b.anchors.length - a.anchors.length,
      summary: '新增 ' + added.length + ' 项 / 删除 ' + removed.length + ' 项 / 变更 ' + changed.length + ' 处 / 连线 ' +
        (b.links.length - a.links.length >= 0 ? '+' : '') + (b.links.length - a.links.length)
    };
  }

  /* 字段级校验：IP、资产编号重复 */
  function validateField(node, key, value, allNodes) {
    const f = fieldByKey(key);
    if (f && f.req && !String(value || '').trim()) return '「' + f.n + '」不能为空';
    if (key === 'ip' && String(value || '').trim()) {
      const v = String(value).trim();
      const ok = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v) || /^([0-9a-fA-F:]+)$/.test(v) ||
        /^[a-zA-Z0-9.\-]+$/.test(v);
      if (!ok) return 'IP / 地址格式看起来不正确';
    }
    return '';
  }

  window.TopoSchema = {
    VERSION: VERSION, ASSET_FIELDS: ASSET_FIELDS, FIELD_GROUPS: FIELD_GROUPS,
    NODE_DEFAULTS: NODE_DEFAULTS, LINK_DEFAULTS: LINK_DEFAULTS, ZONE_DEFAULTS: ZONE_DEFAULTS,
    ANCHOR_DEFAULTS: ANCHOR_DEFAULTS, ZONE_LABEL_POS: ZONE_LABEL_POS, ZONE_STYLES: ZONE_STYLES,
    META_DEFAULTS: META_DEFAULTS,
    newId: newId, stableId: stableId, fieldByKey: fieldByKey,
    normalize: normalize, sanitizeView: sanitizeView,
    validate: validate, diff: diff, validateField: validateField
  };
})();
