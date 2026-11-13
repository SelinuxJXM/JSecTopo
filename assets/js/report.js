/* ============================================================
 * 等保拓扑绘图平台 - 报告版式 / 图例 / 文本报告
 * 纯函数模块，不依赖 DOM（输出 SVG 字符串或文本）
 * ============================================================ */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const FONT = 'Microsoft YaHei, PingFang SC, Arial, sans-serif';
  const esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* 图例数据：只列图中实际出现的资产，按大类 / 子类组织 */
  function legendData(S, ICONS) {
    const used = {};
    S.nodes.forEach(function (n) {
      if (ICONS.textIds.indexOf(n.icon) >= 0) return;
      used[n.icon] = (used[n.icon] || 0) + 1;
    });
    return ICONS.categories.map(function (c) {
      const items = Object.keys(used).filter(function (id) { return ICONS.map[id] && ICONS.map[id].cat === c.id; })
        .map(function (id) { return { id: id, name: ICONS.map[id].name, sub: ICONS.map[id].sub, count: used[id] }; });
      return { cat: c, items: items };
    }).filter(function (g) { return g.items.length; });
  }

  function metaLine(meta) {
    return [meta.docNo, meta.security].filter(Boolean).map(esc).join('　|　');
  }

  /* 生成 A4 横向带标题栏 + 图例 + 页脚的完整 SVG */
  function frameSVG(innerXml, box, meta, S, ICONS, opts) {
    const o = opts || {};
    const m = Object.assign({ docNo: '', security: '', author: '', org: '', date: '', name: '' }, meta || {});
    const vbMatch = /viewBox="([^"]+)"/.exec(innerXml);
    const viewBox = vbMatch ? vbMatch[1] : [box.x, box.y, box.w, box.h].join(' ');
    const body = innerXml.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const groups = o.noLegend ? [] : legendData(S, ICONS);

    let out = '<svg xmlns="' + NS + '" viewBox="0 0 1123 794" width="1123" height="794" font-family="' + FONT + '">';
    out += '<rect x="0" y="0" width="1123" height="794" fill="#ffffff"/>';
    out += '<rect x="16" y="16" width="1091" height="762" fill="none" stroke="#94a3b8" stroke-width="1.2"/>';
    /* 标题栏 */
    out += '<rect x="16" y="16" width="1091" height="62" fill="#eef2f8" stroke="none"/>';
    out += '<path d="M16 78 H1107" stroke="#94a3b8" stroke-width="1"/>';
    out += '<text x="32" y="45" font-size="19" font-weight="700" fill="#0f172a">' + esc(m.name || '网络拓扑图') + '</text>';
    out += '<text x="32" y="66" font-size="11" fill="#475569">' + esc((m.org || '') + (m.author ? '　编制：' + m.author : '')) + '</text>';
    out += '<text x="1091" y="42" text-anchor="end" font-size="12" font-weight="600" fill="#1e293b">' + esc(m.docNo || '') + '</text>';
    out += '<text x="1091" y="62" text-anchor="end" font-size="11" fill="#475569">' +
      esc((m.security || '') + (m.date ? '　' + m.date : '')) + '</text>';
    /* 主图区 */
    out += '<rect x="30" y="88" width="780" height="606" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>';
    out += '<svg x="30" y="88" width="780" height="606" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet">' + body + '</svg>';
    /* 图例区 */
    out += '<rect x="826" y="88" width="272" height="606" fill="#fbfcfe" stroke="#cbd5e1" stroke-width="1"/>';
    out += '<text x="842" y="112" font-size="13" font-weight="700" fill="#0f172a">图　例</text>';
    out += '<path d="M842 120 H1082" stroke="#cbd5e1" stroke-width="0.8"/>';
    let y = 140;
    let omitted = 0;
    groups.forEach(function (g) {
      if (y > 650) { omitted += g.items.length; return; }
      out += '<rect x="842" y="' + (y - 9) + '" width="4" height="12" rx="1" fill="' + esc(g.cat.color) + '"/>';
      out += '<text x="852" y="' + y + '" font-size="11" font-weight="700" fill="' + esc(g.cat.color) + '">' + esc(g.cat.name) + '</text>';
      y += 19;
      g.items.forEach(function (it) {
        if (y > 668) { omitted += 1; return; }
        out += '<text x="848" y="' + y + '" font-size="10" fill="#334155">· ' + esc(it.name.length > 13 ? it.name.slice(0, 13) : it.name) + '</text>';
        if (it.count > 1) out += '<text x="1080" y="' + y + '" text-anchor="end" font-size="9" fill="#94a3b8">×' + it.count + '</text>';
        y += 15;
      });
      y += 7;
    });
    if (omitted) out += '<text x="848" y="' + Math.min(y, 680) + '" font-size="10" fill="#94a3b8">… 其余 ' + omitted + ' 项见资产清单</text>';
    /* 页脚 */
    out += '<path d="M16 706 H1107" stroke="#94a3b8" stroke-width="1"/>';
    out += '<text x="32" y="732" font-size="11" fill="#475569">' + esc(m.docNo || '网络拓扑图') + '</text>';
    out += '<text x="561" y="732" text-anchor="middle" font-size="11" fill="#475569">' + esc(m.security || '') + '</text>';
    out += '<text x="1091" y="732" text-anchor="end" font-size="11" fill="#475569">' + esc((m.date || '') + '　第 1 页') + '</text>';
    out += '<text x="32" y="756" font-size="9.5" fill="#94a3b8">本图依据拓扑绘制工具导出，边界与控制点结论需结合现场核查确认</text>';
    out += '</svg>';
    return out;
  }

  /* 合规自检文本报告 */
  function reportText(S, analysis, meta) {
    const L = ['', '一级', '二级', '三级', '四级'][analysis.level] || (analysis.level + '级');
    const lines = [
      '网络安全等级保护拓扑合规自检报告',
      '项目名称：' + (meta && meta.name || '未命名拓扑'),
      '等保级别：' + L,
      '图号：' + (meta && meta.docNo || ''),
      '生成时间：' + new Date().toLocaleString('zh-CN'),
      '',
      '一、自检汇总',
      '  符合 ' + analysis.counts.ok + ' 项 / 待人工核实 ' + analysis.counts.review + ' 项 / 待核查（缺失）' +
        analysis.counts.miss + ' 项 / 不适用 ' + analysis.counts.na + ' 项，共 ' + analysis.counts.total + ' 个检查项',
      ''
    ];
    lines.push('二、检查项明细');
    analysis.checks.forEach(function (c, i) {
      const badge = { ok: '符合', review: '待人工核实', miss: '待核查', na: '不适用' }[c.status];
      lines.push('  ' + (i + 1) + '. [' + badge + '] ' + c.title);
      lines.push('     依据：' + c.clause + '（' + c.levelLabel + '）');
      lines.push('     ' + c.detail);
      if (c.status === 'miss') lines.push('     建议：' + c.advice);
      if (c.hits.length) lines.push('     关联资产：' + c.hits.map(function (n) { return n.label; }).join('、'));
      lines.push('');
    });
    lines.push('三、边界链路识别（共 ' + analysis.boundaries.length + ' 条）');
    analysis.boundaries.forEach(function (b, i) {
      lines.push('  ' + (i + 1) + '. [' + b.type + '] ' + b.za + ' → ' + b.zb + '：' + b.from + ' → ' + b.to +
        (b.hasFirewall ? '' : '（未见边界访问控制设备）'));
    });
    lines.push('');
    lines.push('四、外部到数据资产可达路径（共 ' + analysis.paths.length + ' 条）');
    analysis.paths.forEach(function (p, i) {
      lines.push('  ' + (i + 1) + '. ' + p.from + ' → ' + p.to + '（' + p.length + ' 跳）：' + p.names.join(' → '));
      if (p.advice) lines.push('     提示：' + p.advice);
    });
    lines.push('');
    lines.push('五、资产概况');
    lines.push('  资产 ' + S.nodes.length + ' 个，链路 ' + S.links.length + ' 条，安全区域 ' + S.zones.length + ' 个');
    lines.push('');
    lines.push('说明：本报告由拓扑图静态分析生成，仅作为测评准备与现场核查线索，不能替代配置检查、渗透验证与人工判定。');
    return lines.join('\r\n');
  }

  /* 整改前后差异文本 */
  function diffText(d) {
    const lines = [
      '整改前 / 后拓扑差异清单',
      '生成时间：' + new Date().toLocaleString('zh-CN'),
      '',
      d.summary,
      ''
    ];
    lines.push('一、新增资产（' + d.added.length + '）');
    d.added.forEach(function (a, i) { lines.push('  ' + (i + 1) + '. ' + a.label + '（' + a.key + '）'); });
    lines.push('');
    lines.push('二、移除资产（' + d.removed.length + '）');
    d.removed.forEach(function (a, i) { lines.push('  ' + (i + 1) + '. ' + a.label + '（' + a.key + '）'); });
    lines.push('');
    lines.push('三、属性变更（' + d.changed.length + '）');
    d.changed.forEach(function (c, i) {
      lines.push('  ' + (i + 1) + '. ' + c.label + ' / ' + c.field + '：' + (c.from || '空') + ' → ' + (c.to || '空'));
    });
    lines.push('');
    lines.push('四、结构变化');
    lines.push('  连线增减：' + (d.linkDelta >= 0 ? '+' : '') + d.linkDelta + '　安全区域增减：' + (d.zoneDelta >= 0 ? '+' : '') + d.zoneDelta);
    return lines.join('\r\n');
  }

  window.TopoReport = {
    legendData: legendData, frameSVG: frameSVG,
    reportText: reportText, diffText: diffText
  };
})();
