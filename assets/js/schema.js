/* ============================================================
 * 等保拓扑绘图平台 - 数据模型 / 字段定义 / 校验 / 版本对比
 * 纯函数模块，不依赖 DOM，可被测试直接加载
 * ============================================================ */
(function () {
  'use strict';

  const VERSION = 3;

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
  const LINK_DEFAULTS = { from: '', to: '', style: 'ortho', label: '', dash: false, arrow: false, color: '', width: 2 };
  const ZONE_DEFAULTS = { icon: 'zone-box', x: 0, y: 0, w: 340, h: 220, label: '安全区域', color: '', style: 'dash', locked: false };
  const META_DEFAULTS = {
    name: '未命名拓扑', level: '三级', version: VERSION,
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
  function normalize(raw) {
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
    const zones = (Array.isArray(d.zones) ? d.zones : []).map(function (z, i) {
      const o = Object.assign({}, ZONE_DEFAULTS, z || {});
      o.id = o.id || stableId('z', i);
      o.x = isNum(o.x) ? o.x : 0; o.y = isNum(o.y) ? o.y : 0;
      o.w = isNum(o.w) && o.w > 0 ? o.w : 340; o.h = isNum(o.h) && o.h > 0 ? o.h : 220;
      return o;
    });
    /* 自动推断节点归属（旧版工程没有 parent 字段） */
    const hasParent = nodes.some(function (n) { return !!n.parent; });
    if (!hasParent) {
      nodes.forEach(function (n) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const z = zones.find(function (zz) { return cx >= zz.x && cx <= zz.x + zz.w && cy >= zz.y && cy <= zz.y + zz.h; });
        if (z) { n.parent = z.id; if (!n.zone) n.zone = z.label; }
      });
    }
    const ids = {};
    nodes.forEach(function (n) { ids[n.id] = 1; });
    zones.forEach(function (z) { ids[z.id] = 1; });
    const links = (Array.isArray(d.links) ? d.links : []).map(function (l, i) {
      const o = Object.assign({}, LINK_DEFAULTS, l || {});
      o.id = o.id || stableId('l', i);
      if (legacyArrows) o.arrow = false;
      return o;
    }).filter(function (l) { return ids[l.from] && ids[l.to]; });

    const meta = Object.assign({}, META_DEFAULTS, d.meta || {});
    meta.version = VERSION;
    if (!meta.date) meta.date = new Date().toLocaleDateString('zh-CN');
    return {
      version: VERSION, nodes: nodes, links: links, zones: zones,
      notes: Array.isArray(d.notes) ? d.notes : [], meta: meta,
      pages: Array.isArray(d.pages) ? d.pages : [], pageId: d.pageId || ''
    };
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
    NODE_DEFAULTS: NODE_DEFAULTS, LINK_DEFAULTS: LINK_DEFAULTS, ZONE_DEFAULTS: ZONE_DEFAULTS, META_DEFAULTS: META_DEFAULTS,
    newId: newId, stableId: stableId, fieldByKey: fieldByKey,
    normalize: normalize, validate: validate, diff: diff, validateField: validateField
  };
})();
