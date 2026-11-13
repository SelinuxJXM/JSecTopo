/* ============================================================
 * 等保拓扑绘图平台 - 合规语义分析（链路感知 / 证据矩阵 / 边界分析）
 * 纯函数模块，不依赖 DOM
 * 依赖：window.TopoTemplates.checks
 * ============================================================ */
(function () {
  'use strict';

  const CHECKS = window.TopoTemplates.checks;
  const EXTERNAL = ['internet', 'branch', 'cloud', 'attacker', 'admin', 'office'];
  const DATA_ASSETS = ['database', 'db-cluster', 'datawarehouse', 'bigdata', 'storage', 'nas'];
  const GUARD = {
    firewall: ['firewall', 'ngfw', 'utm', 'firewall-route'],
    ips: ['ips', 'ids', 'ngfw'],
    waf: ['waf', 'waf-cloud', 'web-tamper'],
    audit: ['log-audit', 'db-audit', 'siem', 'security-audit']
  };

  function zoneOf(n, zones) {
    if (n.zone) return n.zone;
    const p = zones.find(function (z) { return z.id === n.parent; });
    if (p) return p.label;
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const z = zones.find(function (zz) { return cx >= zz.x && cx <= zz.x + zz.w && cy >= zz.y && cy <= zz.y + zz.h; });
    return z ? z.label : '';
  }
  function nodeById(S, id) { return S.nodes.find(function (n) { return n.id === id; }); }

  /* 无向邻接表（区域框也作为可连接端点） */
  function graph(S) {
    const adj = {};
    S.nodes.concat(S.zones).forEach(function (o) { adj[o.id] = []; });
    S.links.forEach(function (l) {
      if (adj[l.from] && adj[l.to]) {
        adj[l.from].push({ id: l.to, link: l });
        adj[l.to].push({ id: l.from, link: l });
      }
    });
    return adj;
  }
  function isConnected(S, id) {
    return S.links.some(function (l) { return l.from === id || l.to === id; });
  }

  /* 识别互联网/外部边界链路与跨安全区域链路 */
  function boundaries(S) {
    return S.links.map(function (l) {
      const a = nodeById(S, l.from), b = nodeById(S, l.to);
      const za = a ? zoneOf(a, S.zones) : '';
      const zb = b ? zoneOf(b, S.zones) : '';
      const ext = (a && EXTERNAL.indexOf(a.icon) >= 0) || (b && EXTERNAL.indexOf(b.icon) >= 0);
      /* 跨不同安全区域，或一端属于某安全区域、另一端未划入任何区域，都视为需要核查的边界 */
      const cross = (!!za !== !!zb) || (!!za && !!zb && za !== zb);
      if (!ext && !cross) return null;
      const icons = [a && a.icon, b && b.icon].filter(Boolean);
      const hasFw = icons.some(function (i) { return GUARD.firewall.indexOf(i) >= 0; });
      const hasAudit = icons.some(function (i) { return GUARD.audit.indexOf(i) >= 0; });
      return {
        link: l, from: a ? a.label : '区域', to: b ? b.label : '区域',
        za: za || '外部', zb: zb || '外部',
        type: ext ? '互联网 / 外部边界' : (za && zb ? '跨安全区域边界' : '区域 ↔ 未划分区边界'),
        hasFirewall: hasFw, hasAudit: hasAudit,
        zoneFrame: !!(S.zones.find(function (z) { return z.id === l.from; }) || S.zones.find(function (z) { return z.id === l.to; }))
      };
    }).filter(Boolean);
  }
  function onBoundary(S, id) {
    return boundaries(S).some(function (b) { return b.link.from === id || b.link.to === id; });
  }

  /* BFS 最短路径：外部入口 -> 数据资产 */
  function shortestPath(adj, from, to, maxDepth) {
    if (from === to) return [from];
    const q = [[from]], seen = {}; seen[from] = 1;
    while (q.length) {
      const p = q.shift();
      if (p.length > (maxDepth || 12)) return null;
      const nb = adj[p[p.length - 1]] || [];
      for (let i = 0; i < nb.length; i++) {
        const nx = nb[i].id;
        if (seen[nx]) continue;
        seen[nx] = 1;
        const np = p.concat([nx]);
        if (nx === to) return np;
        q.push(np);
      }
    }
    return null;
  }
  function paths(S) {
    const adj = graph(S);
    const starts = S.nodes.filter(function (n) { return EXTERNAL.indexOf(n.icon) >= 0; });
    const targets = S.nodes.filter(function (n) { return DATA_ASSETS.indexOf(n.icon) >= 0; });
    const out = [];
    starts.forEach(function (s) {
      targets.forEach(function (t) {
        if (out.length >= 24) return;
        const p = shortestPath(adj, s.id, t.id);
        if (!p || p.length < 2) return;
        const names = p.map(function (id) {
          const n = nodeById(S, id);
          if (n) return n.label;
          const z = S.zones.find(function (zz) { return zz.id === id; });
          return z ? z.label : id;
        });
        const icons = p.map(function (id) { const n = nodeById(S, id); return n ? n.icon : ''; });
        const has = function (arr) { return arr.some(function (i) { return icons.indexOf(i) >= 0; }); };
        const guards = {
          firewall: has(GUARD.firewall), ips: has(GUARD.ips),
          waf: has(GUARD.waf), audit: has(GUARD.audit)
        };
        out.push({
          from: s.label, to: t.label, names: names, length: p.length, guards: guards,
          weak: !guards.firewall || !guards.ips,
          advice: !guards.firewall ? '该路径未见边界访问控制设备' :
            !guards.ips ? '该路径未见入侵防范设备' :
              !guards.waf ? '该路径未见 Web 应用防护（如存在 Web 服务需核实）' : ''
        });
      });
    });
    return out;
  }

  /* 主分析：链路感知自检 + 控制点-资产-证据矩阵 */
  function analyze(S, level) {
    const L = parseInt(level, 10) || 3;
    const rules = CHECKS.filter(function (r) { return r.levels.indexOf(L) >= 0; });
    const checks = rules.map(function (r) {
      let status = null, hits = [], detail = '';
      if (r.need) {
        const applicable = S.nodes.some(function (n) { return r.need.indexOf(n.icon) >= 0; });
        if (!applicable) { status = 'na'; detail = '拓扑中未出现适用资产，本项不适用'; }
      }
      if (!status) {
        if (r.zoneMin) {
          if (S.zones.length >= r.zoneMin) {
            status = 'ok'; detail = '已划分 ' + S.zones.length + ' 个安全区域：' + S.zones.map(function (z) { return z.label; }).join('、');
          } else {
            status = 'miss'; detail = '当前仅 ' + S.zones.length + ' 个安全区域，建议至少 ' + r.zoneMin + ' 个';
          }
        } else {
          hits = S.nodes.filter(function (n) { return r.ids.indexOf(n.icon) >= 0; });
          if (!hits.length) {
            status = 'miss'; detail = '未检测到可满足该控制点的资产';
          } else if (r.min && hits.length < r.min) {
            status = 'miss'; detail = '检测到 ' + hits.length + ' 个相关资产，建议不少于 ' + r.min + ' 个';
          } else {
            const connected = hits.filter(function (n) { return isConnected(S, n.id); });
            const onB = hits.filter(function (n) { return onBoundary(S, n.id); });
            const boundarySensitive = ['boundary', 'ids', 'waf', 'crypto', 'vpn'].indexOf(r.key) >= 0;
            if (!connected.length) {
              status = 'review'; detail = '已绘制 ' + hits.length + ' 个相关资产，但均未接入拓扑链路，部署位置需人工核实';
            } else if (boundarySensitive && !onB.length) {
              status = 'review'; detail = '设备已接入链路，但未位于识别出的边界链路上，需人工核实是否串接在关键路径';
            } else {
              status = 'ok'; detail = '命中 ' + hits.length + ' 个资产：' + hits.map(function (n) { return n.label; }).join('、');
            }
          }
        }
      }
      return {
        key: r.key, title: r.title, clause: r.clause, advice: r.advice,
        status: status, detail: detail, hits: hits,
        levelLabel: L + '级要求'
      };
    });
    const matrix = checks.map(function (c) {
      return {
        key: c.key, title: c.title, clause: c.clause, status: c.status,
        assets: c.hits.map(function (n) {
          return {
            id: n.id, label: n.label, icon: n.icon, zone: zoneOf(n, S.zones),
            ip: n.ip || '', model: n.model || '', osType: n.osType || '', note: n.note || ''
          };
        })
      };
    });
    return {
      level: L, checks: checks, matrix: matrix,
      boundaries: boundaries(S), paths: paths(S),
      counts: {
        ok: checks.filter(function (c) { return c.status === 'ok'; }).length,
        review: checks.filter(function (c) { return c.status === 'review'; }).length,
        miss: checks.filter(function (c) { return c.status === 'miss'; }).length,
        na: checks.filter(function (c) { return c.status === 'na'; }).length,
        total: checks.length
      }
    };
  }

  window.TopoCompliance = {
    analyze: analyze, boundaries: boundaries, paths: paths,
    zoneOf: zoneOf, graph: graph, isConnected: isConnected,
    EXTERNAL: EXTERNAL, DATA_ASSETS: DATA_ASSETS
  };
})();
