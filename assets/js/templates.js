/* ============================================================
 * 等保拓扑绘图平台 - 预置拓扑模板 + 等级保护合规自检规则
 * ============================================================ */
(function () {
  'use strict';

  /* ID 由模板 id + 索引确定，保证同一模板重复载入 ID 一致（便于整改前后 diff） */
  const sid = (def, p, i) => def.id + '_' + p + i;

  /* 模板紧凑定义 -> 标准工程对象（经 schema.normalize 补齐字段 / 推断归属） */
  function build(def) {
    const nodes = [];
    const byLabel = {};
    (def.nodes || []).forEach(function (a, i) {
      const icon = a[0], x = a[1], y = a[2], label = a[3], ip = a[4] || '';
      const extra = a[5] || {};
      const n = {
        id: sid(def, 'n', i), icon: icon, x: x, y: y, w: 108, h: 86,
        label: label, ip: ip, zone: extra.zone || '', color: extra.color || ''
      };
      nodes.push(n);
      byLabel[label] = n.id;
    });
    const zones = (def.zones || []).map(function (a, i) {
      return { id: sid(def, 'z', i), icon: a[0], x: a[1], y: a[2], w: a[3], h: a[4], label: a[5], color: a[6] || '', style: a[7] || 'dash' };
    });
    const links = (def.links || []).map(function (a, i) {
      const from = byLabel[a[0]], to = byLabel[a[1]];
      if (!from || !to) return null;
      return {
        id: sid(def, 'l', i), from: from, to: to, style: a[2] || 'ortho',
        label: a[3] || '', dash: !!a[4], arrow: a[5] === undefined ? false : !!a[5],
        color: a[6] || '', width: 2
      };
    }).filter(Boolean);
    const raw = {
      version: window.TopoSchema ? window.TopoSchema.VERSION : 3,
      nodes: nodes, links: links, zones: zones, notes: [],
      meta: { name: def.name, level: def.level || '' }
    };
    return window.TopoSchema ? window.TopoSchema.normalize(raw) : raw;
  }

  const DEFS = [
    {
      id: 'l3', name: '等保三级 · 典型系统拓扑', level: '三级',
      desc: '互联网边界 → DMZ → 核心交换 → 业务/数据库区，旁路安全管理中心，覆盖三级主要控制点',
      zones: [
        ['dmz', 30, 400, 560, 160, 'DMZ 隔离区', '#f59e0b'],
        ['core-zone', 610, 420, 430, 160, '核心业务区', '#2563eb'],
        ['db-zone', 610, 610, 430, 160, '数据库区', '#0d9488'],
        ['sec-zone', 1070, 150, 310, 470, '安全管理区', '#d9463d']
      ],
      nodes: [
        ['internet', 60, 40, '互联网', '公网'],
        ['branch', 250, 40, '分支机构', '专线接入'],
        ['admin', 440, 40, '远程运维人员', 'VPN 接入'],
        ['router', 60, 165, '出口路由器', '192.168.0.1', { zone: '网络边界' }],
        ['ddos', 205, 165, 'DDoS 防护', '清洗设备', { zone: '网络边界' }],
        ['firewall', 60, 290, '边界防火墙', '10.0.0.1', { zone: '网络边界' }],
        ['ips', 205, 290, '入侵防御 IPS', '10.0.0.2', { zone: '网络边界' }],
        ['vpn', 350, 290, 'VPN 网关', '10.0.0.3', { zone: '网络边界' }],
        ['waf', 495, 290, 'WAF', '10.0.0.4', { zone: 'DMZ 隔离区' }],
        ['lb', 55, 435, '负载均衡', '172.16.1.10', { zone: 'DMZ 隔离区' }],
        ['web', 185, 435, 'Web 服务器', '172.16.1.21', { zone: 'DMZ 隔离区' }],
        ['portal', 315, 435, '门户网站', 'www.example.com', { zone: 'DMZ 隔离区' }],
        ['mail-gw', 445, 435, '邮件安全网关', '172.16.1.30', { zone: 'DMZ 隔离区' }],
        ['switch-core', 760, 285, '核心交换机', '10.10.0.1', { zone: '核心网络' }],
        ['appsys', 635, 455, '应用系统', '10.10.1.21', { zone: '核心业务区' }],
        ['middleware', 765, 455, '中间件', '10.10.1.22', { zone: '核心业务区' }],
        ['api-gw', 895, 455, 'API 网关', '10.10.1.23', { zone: '核心业务区' }],
        ['database', 635, 645, '业务数据库', '10.10.2.31', { zone: '数据库区' }],
        ['db-cluster', 765, 645, '数据库集群', '10.10.2.32', { zone: '数据库区' }],
        ['storage', 895, 645, '存储阵列', '10.10.2.40', { zone: '数据库区' }],
        ['backup', 895, 790, '备份一体机', '10.10.2.50', { zone: '数据库区' }],
        ['bastion', 1095, 195, '堡垒机', '10.20.0.11', { zone: '安全管理区' }],
        ['log-audit', 1225, 195, '日志审计', '10.20.0.12', { zone: '安全管理区' }],
        ['db-audit', 1095, 305, '数据库审计', '10.20.0.13', { zone: '安全管理区' }],
        ['vuln-scan', 1225, 305, '漏洞扫描', '10.20.0.14', { zone: '安全管理区' }],
        ['siem', 1095, 415, 'SIEM 态势感知', '10.20.0.15', { zone: '安全管理区' }],
        ['iam', 1225, 415, '统一身份认证', '10.20.0.16', { zone: '安全管理区' }],
        ['edr', 1095, 525, '终端安全管理', '10.20.0.17', { zone: '安全管理区' }],
        ['baseline', 1225, 525, '配置核查', '10.20.0.18', { zone: '安全管理区' }]
      ],
      links: [
        ['互联网', '出口路由器', 'ortho'],
        ['出口路由器', 'DDoS 防护', 'ortho'],
        ['DDoS 防护', '边界防火墙', 'ortho'],
        ['边界防火墙', '入侵防御 IPS', 'ortho'],
        ['入侵防御 IPS', '核心交换机', 'ortho'],
        ['入侵防御 IPS', 'WAF', 'ortho'],
        ['WAF', '负载均衡', 'ortho'],
        ['负载均衡', 'Web 服务器', 'ortho'],
        ['负载均衡', '门户网站', 'ortho'],
        ['负载均衡', '邮件安全网关', 'ortho'],
        ['Web 服务器', '核心交换机', 'ortho'],
        ['分支机构', 'VPN 网关', 'ortho', '加密隧道'],
        ['远程运维人员', 'VPN 网关', 'ortho'],
        ['VPN 网关', '核心交换机', 'ortho'],
        ['核心交换机', '应用系统', 'ortho'],
        ['核心交换机', '中间件', 'ortho'],
        ['核心交换机', 'API 网关', 'ortho'],
        ['应用系统', '业务数据库', 'ortho'],
        ['中间件', '数据库集群', 'ortho'],
        ['数据库集群', '存储阵列', 'ortho'],
        ['存储阵列', '备份一体机', 'ortho', '定时备份'],
        ['核心交换机', '堡垒机', 'ortho', '管理链路', true],
        ['堡垒机', '应用系统', 'ortho', '运维审计', true],
        ['核心交换机', '日志审计', 'ortho', '日志采集', true],
        ['核心交换机', '数据库审计', 'ortho', '流量镜像', true],
        ['核心交换机', '漏洞扫描', 'ortho', '定期扫描', true]
      ]
    },
    {
      id: 'l2', name: '等保二级 · 通用系统拓扑', level: '二级',
      desc: '边界防护 + 区域划分 + 主机与应用 + 审计备份，适用于二级系统现场测评绘图',
      zones: [
        ['dmz', 40, 330, 470, 160, 'DMZ / 服务器区', '#f59e0b'],
        ['office-zone', 40, 540, 470, 160, '办公终端区', '#64748b'],
        ['sec-zone', 580, 330, 260, 370, '安全管理区', '#d9463d']
      ],
      nodes: [
        ['internet', 70, 40, '互联网', '公网'],
        ['router', 70, 155, '出口路由器', '192.168.1.1'],
        ['firewall', 70, 265, '边界防火墙', '10.0.0.1'],
        ['switch-core', 255, 265, '核心交换机', '10.0.0.254'],
        ['web', 70, 365, 'Web 服务器', '172.16.1.10'],
        ['appsys', 200, 365, '业务应用系统', '172.16.1.20'],
        ['database', 330, 365, '业务数据库', '172.16.1.30'],
        ['pc', 70, 575, '办公终端 A', '192.168.10.11'],
        ['pc', 200, 575, '办公终端 B', '192.168.10.12'],
        ['printer', 330, 575, '网络打印机', '192.168.10.20'],
        ['log-audit', 605, 365, '日志审计', '10.0.1.11'],
        ['bastion', 735, 365, '堡垒机', '10.0.1.12'],
        ['av-server', 605, 475, '防病毒服务器', '10.0.1.13'],
        ['backup', 735, 475, '备份一体机', '10.0.1.14'],
        ['iam', 605, 585, '身份鉴别 / 4A', '10.0.1.15']
      ],
      links: [
        ['互联网', '出口路由器', 'ortho'],
        ['出口路由器', '边界防火墙', 'ortho'],
        ['边界防火墙', '核心交换机', 'ortho'],
        ['核心交换机', 'Web 服务器', 'ortho'],
        ['核心交换机', '业务应用系统', 'ortho'],
        ['业务应用系统', '业务数据库', 'ortho'],
        ['核心交换机', '办公终端 A', 'ortho'],
        ['核心交换机', '办公终端 B', 'ortho'],
        ['核心交换机', '网络打印机', 'ortho'],
        ['核心交换机', '日志审计', 'ortho', '日志采集', true],
        ['核心交换机', '堡垒机', 'ortho', '运维管理', true],
        ['业务数据库', '备份一体机', 'ortho', '数据备份'],
        ['核心交换机', '防病毒服务器', 'ortho', '策略下发', true]
      ]
    },
    {
      id: 'boundary', name: '互联网出口边界拓扑', level: '',
      desc: '出口链路、边界防护、入侵检测、上网行为与链路冗余的细化画法',
      zones: [['zone-box', 30, 200, 640, 200, '互联网边界区', '#f59e0b']],
      nodes: [
        ['internet', 60, 30, '互联网', '公网'],
        ['branch', 270, 30, '分支机构', '专线'],
        ['cloud', 480, 30, '云服务 / SaaS', ''],
        /* 公网侧示例地址使用 RFC 5737 文档专用段，避免与真实资产混淆 */
        ['router', 60, 120, '出口路由器 A', '198.51.100.1'],
        ['switch-l3', 240, 120, '出口路由器 B', '198.51.100.2'],
        ['lb', 60, 235, '链路负载均衡', '10.0.0.2'],
        ['ddos', 200, 235, 'DDoS 清洗', ''],
        ['firewall', 340, 235, '边界防火墙（双机）', '10.0.0.1'],
        ['ips', 480, 235, 'IPS 入侵防御', ''],
        ['net-behavior', 200, 320, '上网行为管理', ''],
        ['proxy', 340, 320, '正向代理', ''],
        ['nta', 480, 320, '全流量分析 NTA', ''],
        ['switch-core', 270, 450, '内网核心交换机', '10.10.0.1']
      ],
      links: [
        ['互联网', '出口路由器 A', 'ortho'],
        ['分支机构', '出口路由器 B', 'ortho', '专线'],
        ['云服务 / SaaS', '出口路由器 B', 'ortho', '加密隧道'],
        ['出口路由器 A', '链路负载均衡', 'ortho'],
        ['出口路由器 B', '链路负载均衡', 'ortho'],
        ['链路负载均衡', 'DDoS 清洗', 'ortho'],
        ['DDoS 清洗', '边界防火墙（双机）', 'ortho'],
        ['边界防火墙（双机）', 'IPS 入侵防御', 'ortho'],
        ['IPS 入侵防御', '内网核心交换机', 'ortho'],
        ['边界防火墙（双机）', '上网行为管理', 'ortho', '', true],
        ['边界防火墙（双机）', '正向代理', 'ortho'],
        ['IPS 入侵防御', '全流量分析 NTA', 'ortho', '镜像流量', true]
      ]
    },
    {
      id: 'soc', name: '安全管理中心拓扑', level: '',
      desc: '集中管控、审计、运维、监测、鉴别等管理区设备的典型部署关系',
      zones: [['sec-zone', 40, 170, 720, 420, '安全管理区', '#d9463d']],
      nodes: [
        ['siem', 320, 30, '安全管理平台 / SIEM', '10.20.0.10'],
        ['bastion', 70, 210, '堡垒机', '10.20.0.11'],
        ['log-audit', 220, 210, '日志审计', '10.20.0.12'],
        ['db-audit', 370, 210, '数据库审计', '10.20.0.13'],
        ['vuln-scan', 520, 210, '漏洞扫描', '10.20.0.14'],
        ['baseline', 70, 360, '配置核查', '10.20.0.15'],
        ['iam', 220, 360, '统一身份认证 4A', '10.20.0.16'],
        ['crypto', 370, 360, '加密机 / KMS', '10.20.0.17'],
        ['edr', 520, 360, '终端安全 EDR', '10.20.0.18'],
        ['soc', 220, 510, '安全运营中心 SOC', ''],
        ['risk-monitor', 370, 510, '风险监测预警', ''],
        ['switch-core', 320, 640, '核心交换机（管理网）', '10.20.0.1']
      ],
      links: [
        ['堡垒机', '安全管理平台 / SIEM', 'ortho', '运维日志'],
        ['日志审计', '安全管理平台 / SIEM', 'ortho', '归一化日志'],
        ['数据库审计', '安全管理平台 / SIEM', 'ortho', '告警'],
        ['漏洞扫描', '安全管理平台 / SIEM', 'ortho', '漏洞数据'],
        ['配置核查', '安全管理平台 / SIEM', 'ortho', '基线数据', true],
        ['统一身份认证 4A', '安全管理平台 / SIEM', 'ortho', '账号审计', true],
        ['终端安全 EDR', '安全管理平台 / SIEM', 'ortho', '终端告警', true],
        ['安全管理平台 / SIEM', '安全运营中心 SOC', 'ortho'],
        ['安全管理平台 / SIEM', '风险监测预警', 'ortho'],
        ['核心交换机（管理网）', '堡垒机', 'ortho', '管理流量', true],
        ['核心交换机（管理网）', '日志审计', 'ortho', '', true]
      ]
    }
  ];

  /* ---------------- 等级保护合规自检规则 ----------------
   * clause 依据 GB/T 22239-2019《信息安全技术 网络安全等级保护基本要求》
   * ids    可满足该控制点的资产图标 id
   * need   仅当拓扑中存在这些资产时才检查（否则标记"不适用"）
   * levels 适用的等保级别
   */
  const CHECKS = [
    { key: 'boundary', title: '安全区域边界 · 访问控制', clause: '安全区域边界 / 访问控制', levels: [2, 3], ids: ['firewall', 'ngfw', 'utm', 'gap', 'firewall-route', 'microseg'], advice: '应在网络边界或区域之间部署访问控制设备，并启用默认拒绝策略。' },
    { key: 'region', title: '安全区域划分', clause: '安全通信网络 / 网络架构', levels: [2, 3], zoneMin: 2, advice: '应划分不同的网络区域（如 DMZ、业务区、数据库区、管理区），并按区域分配地址。' },
    { key: 'ids', title: '入侵防范（网络层）', clause: '安全区域边界 / 入侵防范', levels: [2, 3], ids: ['ips', 'ids', 'ngfw', 'nta', 'risk-monitor'], advice: '应在关键网络节点处检测、防止或限制从外部/内部发起的网络攻击行为。' },
    { key: 'malware', title: '恶意代码防范', clause: '安全区域边界 / 恶意代码防范', levels: [2, 3], ids: ['av-gw', 'av-server', 'edr', 'sandbox', 'anti-spam'], advice: '应在关键网络节点处对恶意代码进行检测和清除，并维护防护机制的升级。' },
    { key: 'waf', title: 'Web 应用防护', clause: '安全计算环境 / 入侵防范', levels: [3], need: ['web', 'portal', 'appsys', 'app-mobile', 'api-gw', 'waf-cloud'], ids: ['waf', 'waf-cloud', 'web-tamper'], advice: '对外提供 Web 服务时，应部署 WAF / 网页防篡改，防范注入、跨站等攻击。' },
    { key: 'audit', title: '安全审计（集中日志）', clause: '安全区域边界 / 安全审计', levels: [2, 3], ids: ['log-audit', 'siem', 'soc', 'security-audit', 'log-data'], advice: '应在网络边界、重要网络节点进行安全审计，审计记录应留存不少于 6 个月。' },
    { key: 'dbaudit', title: '数据库访问审计', clause: '安全计算环境 / 安全审计', levels: [3], need: ['database', 'db-cluster', 'datawarehouse', 'bigdata'], ids: ['db-audit', 'dbfw', 'dlp'], advice: '存在数据库资产时，应对数据库访问行为进行独立审计（数据库审计设备/数据库防火墙）。' },
    { key: 'bastion', title: '运维操作审计', clause: '安全管理中心 / 集中管控', levels: [3], ids: ['bastion', 'iam'], advice: '应通过堡垒机对运维操作进行身份鉴别、授权与操作审计，避免直连设备运维。' },
    { key: 'iam', title: '身份鉴别与访问控制', clause: '安全计算环境 / 身份鉴别', levels: [2, 3], ids: ['iam', 'ca', 'keymgmt', 'ztna', 'net-admission'], advice: '应对登录用户进行身份标识和鉴别，具备口令复杂度、登录失败处理与双因素措施。' },
    { key: 'vuln', title: '漏洞与基线管理', clause: '安全管理中心 / 安全管理', levels: [3], ids: ['vuln-scan', 'baseline', 'code-audit', 'pentest'], advice: '应定期开展漏洞扫描、配置基线核查，及时修补高危漏洞。' },
    { key: 'backup', title: '数据备份与恢复', clause: '安全计算环境 / 数据备份恢复', levels: [2, 3], ids: ['backup', 'tape', 'backup-data', 'nas', 'storage', 'datawarehouse'], advice: '应提供重要数据本地备份与恢复功能，三级系统还应具备异地实时/定时备份。' },
    { key: 'crypto', title: '通信与数据保密性', clause: '安全通信网络 / 通信传输', levels: [3], ids: ['vpn', 'crypto', 'ca', 'keymgmt', 'lock'], advice: '应采用密码技术保证通信过程中数据的保密性、完整性（如 VPN / 国密加密）。' },
    { key: 'vpn', title: '远程/分支接入加密', clause: '安全通信网络 / 通信传输', levels: [2, 3], need: ['branch', 'admin', 'internet', 'cloud'], ids: ['vpn', 'ztna', 'crypto'], advice: '存在远程运维或分支机构接入时，应建立加密传输通道。' },
    { key: 'soc', title: '集中管控 / 安全管理中心', clause: '安全管理中心 / 集中管控', levels: [3], ids: ['siem', 'soc', 'risk-monitor', 'nta'], advice: '三级系统应对分散的设备进行集中监测、集中日志分析与统一策略管理。' },
    { key: 'dlp', title: '数据防泄漏与剩余信息保护', clause: '安全计算环境 / 剩余信息保护', levels: [3], need: ['database', 'db-cluster', 'fileserver', 'storage', 'nas'], ids: ['dlp', 'crypto', 'oneway', 'gap'], advice: '应保证鉴别信息、敏感数据所在的存储空间被释放或重新分配前得到完全清除。' },
    { key: 'ha', title: '链路与设备冗余', clause: '安全通信网络 / 网络架构', levels: [3], ids: ['switch-core', 'lb', 'hci', 'db-cluster'], min: 2, advice: '三级系统关键网络链路、核心设备应提供冗余，避免单点故障。' }
  ];

  window.TopoTemplates = {
    list: function () { return DEFS.map(function (d) { return { id: d.id, name: d.name, level: d.level, desc: d.desc }; }); },
    build: function (id) {
      const d = DEFS.find(function (x) { return x.id === id; });
      return d ? build(d) : null;
    },
    checks: CHECKS
  };
})();
