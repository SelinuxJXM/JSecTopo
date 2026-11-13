/* ============================================================
 * 等保拓扑绘图平台 - 资产图标库
 * 统一 viewBox 48x48，线性矢量，使用 currentColor 便于着色/导出
 * ============================================================ */
(function () {
  'use strict';

  const dot = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r || 1.3}" fill="currentColor" stroke="none"/>`;
  const txt = (t, y, s) => `<text x="24" y="${y || 30}" text-anchor="middle" font-size="${s || 10}" font-weight="700" fill="currentColor" stroke="none" font-family="Arial, Microsoft YaHei, sans-serif">${t}</text>`;

  /* 1U/2U 设备面板 */
  const dev = (inner, extra) => `<rect x="4" y="10" width="40" height="28" rx="3" ${extra || ''}/><path d="M4 17h40"/>${dot(9, 13.5)}${dot(13.5, 13.5)}${inner || ''}`;
  /* 机柜式服务器 */
  const rack = (inner) => `<rect x="7" y="5" width="34" height="38" rx="2"/><path d="M7 15h34M7 25h34M7 35h34"/>${dot(12, 10)}${dot(12, 20)}${dot(12, 30)}${dot(12, 40)}${inner || ''}`;
  /* 圆柱数据库 */
  const cyl = (inner) => `<ellipse cx="24" cy="12" rx="15" ry="5"/><path d="M9 12v24c0 2.8 6.7 5 15 5s15-2.2 15-5V12"/><path d="M9 24c0 2.8 6.7 5 15 5s15-2.2 15-5"/>${inner || ''}`;
  /* 盾牌 */
  const shield = (inner) => `<path d="M24 4l17 6.5v13c0 10.5-7.2 17.2-17 20.5C14.2 40.7 7 34 7 23.5v-13z"/>${inner || ''}`;
  /* 云 */
  const cloud = (inner) => `<path d="M13 37h23a8 8 0 0 0 .8-15.9A12 12 0 0 0 14.2 18 9.5 9.5 0 0 0 13 37z"/>${inner || ''}`;
  /* 显示器 */
  const monitor = (inner) => `<rect x="6" y="8" width="36" height="26" rx="2"/><path d="M18 42h12M24 34v8"/>${inner || ''}`;
  /* 人 */
  const person = (inner) => `<circle cx="24" cy="14" r="6"/><path d="M12 38c0-7 5-12 12-12s12 5 12 12"/>${inner || ''}`;
  /* 砖墙（防火墙） */
  const wall = (inner) => `<rect x="4" y="12" width="40" height="26" rx="2"/><path d="M4 21h40M4 30h40M17 12v9M30 12v9M11 21v9M37 21v9M17 30v8M30 30v8"/>${inner || ''}`;
  /* 文档 */
  const doc = (inner) => `<path d="M12 6h17l7 7v29H12z"/><path d="M29 6v7h7"/>${inner || ''}`;
  /* 虚线区域框 */
  const zoneBox = (t) => `<rect x="4" y="9" width="40" height="30" rx="3" stroke-dasharray="4 3"/>${t ? txt(t, 29, 9) : ''}`;

  const CATEGORIES = [
    { id: 'net',  name: '网络设备',   color: '#2563eb', desc: '路由交换 / 接入 / 链路' },
    { id: 'sec',  name: '安全防护设备', color: '#d9463d', desc: '边界 / 检测 / 审计 / 运维' },
    { id: 'host', name: '计算与终端',  color: '#7c3aed', desc: '服务器 / 虚拟化 / 存储 / 终端' },
    { id: 'data', name: '数据与应用',  color: '#0d9488', desc: '数据库 / 中间件 / 业务系统' },
    { id: 'zone', name: '区域与标注',  color: '#64748b', desc: '安全域 / 云 / 人员 / 说明' }
  ];

  const ICONS = [];
  let cat = 'net';
  const G = (c) => { cat = c; };
  const I = (id, name, kw, svg) => { ICONS.push({ id: id, name: name, kw: kw, cat: cat, svg: svg }); };

  /* ================= 网络设备 ================= */
  G('net');
  I('router', '路由器', 'router 路由 luyou', `<circle cx="24" cy="24" r="15"/><path d="M24 14v20M14 24h20"/><path d="M20 18l4-4 4 4M20 30l4 4 4-4M18 20l-4 4 4 4M30 20l4 4-4 4"/>`);
  I('switch', '交换机', 'switch 交换 jiaohuanji', dev(`<path d="M11 23h26M11 31h26"/><path d="M15 20l-4 3 4 3M33 20l4 3-4 3M15 28l-4 3 4 3M33 28l4 3-4 3"/>`));
  I('switch-l3', '三层交换机', 'l3 三层 核心路由交换', dev(`<path d="M18 33V21M30 21v12"/><path d="M15 24l3-3 3 3M27 30l3 3 3-3"/><path d="M12 36h24" stroke-dasharray="2 2"/>`));
  I('switch-core', '核心交换机', 'core 核心 汇聚', `<rect x="2" y="7" width="44" height="34" rx="4" stroke-dasharray="3 2"/>` + dev(`<path d="M12 24h24M24 20v12"/><circle cx="24" cy="24" r="3"/>`));
  I('switch-agg', '汇聚交换机', 'agg 汇聚', dev(`<path d="M11 21l13 10M37 21l-13 10M24 21v10"/><circle cx="11" cy="21" r="1.8" fill="currentColor" stroke="none"/><circle cx="37" cy="21" r="1.8" fill="currentColor" stroke="none"/><circle cx="24" cy="31" r="1.8" fill="currentColor" stroke="none"/>`));
  I('switch-access', '接入交换机', 'access 接入 二层', dev(`<rect x="10" y="22" width="6" height="7" rx="1"/><rect x="19" y="22" width="6" height="7" rx="1"/><rect x="28" y="22" width="6" height="7" rx="1"/><path d="M37 25h3"/>`));
  I('ap', '无线 AP', 'ap wifi 无线 接入点', `<rect x="14" y="30" width="20" height="9" rx="2"/><path d="M24 30V16"/><path d="M18 13a9 9 0 0 1 12 0M14 9a15 15 0 0 1 20 0"/><circle cx="24" cy="16" r="1.8" fill="currentColor" stroke="none"/>`);
  I('ac', '无线控制器 AC', 'ac wlc 无线控制器', dev(`<path d="M18 31a8 8 0 0 1 12 0M15 27a12 12 0 0 1 18 0"/><circle cx="24" cy="34" r="1.6" fill="currentColor" stroke="none"/>`));
  I('lb', '负载均衡', 'lb loadbalance 负载 f5', dev(`<path d="M13 26h8l8-7M21 26l8 7"/><circle cx="12" cy="26" r="2"/><circle cx="32" cy="19" r="2"/><circle cx="32" cy="33" r="2"/>`));
  I('gateway', '网关', 'gateway 网关', dev(`<path d="M12 23h24M31 19l5 4-5 4M12 31h24M17 27l-5 4 5 4"/>`));
  I('vpn', 'VPN 网关', 'vpn 加密隧道', dev(`<rect x="19" y="25" width="10" height="9" rx="1.5"/><path d="M21 25v-3a3 3 0 0 1 6 0v3"/><path d="M12 28h5M31 28h5"/>`));
  I('modem', '光猫 / 调制解调器', 'modem onu 光猫', dev(`<circle cx="24" cy="26" r="4"/><path d="M24 19v3M24 30v3M14 26h6M28 26h6"/>`));
  I('hub', '集线器 Hub', 'hub 集线器', dev(`<path d="M10 24h28"/><circle cx="14" cy="31" r="1.8"/><circle cx="21" cy="31" r="1.8"/><circle cx="28" cy="31" r="1.8"/><circle cx="35" cy="31" r="1.8"/>`));
  I('repeater', '中继器 / 网桥', 'repeater bridge 中继', `<rect x="16" y="15" width="16" height="18" rx="2"/><path d="M4 24h12M32 24h12"/><path d="M21 21l4 3-4 3"/>`);
  I('otn', '光传输 / OTN', 'otn 光传输 sdh', rack(`<path d="M18 10l14 10M18 30l14-10"/><circle cx="17" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="33" cy="20" r="1.5" fill="currentColor" stroke="none"/>`));
  I('sdn', 'SDN 控制器', 'sdn 控制器', dev(`<circle cx="24" cy="26" r="4"/><path d="M24 22v-3M24 30v3M20 26h-4M28 26h4"/><circle cx="24" cy="18" r="1.6" fill="currentColor" stroke="none"/><circle cx="24" cy="34" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="26" r="1.6" fill="currentColor" stroke="none"/><circle cx="33" cy="26" r="1.6" fill="currentColor" stroke="none"/>`));
  I('sdwan', 'SD-WAN', 'sdwan 广域网', cloud(`<path d="M17 29h14M24 29v-6"/><circle cx="24" cy="21" r="2"/><circle cx="17" cy="31" r="1.6" fill="currentColor" stroke="none"/><circle cx="31" cy="31" r="1.6" fill="currentColor" stroke="none"/>`));
  I('dns', 'DNS 服务器', 'dns 域名解析', rack(txt('DNS', 30, 9)));
  I('dhcp', 'DHCP 服务器', 'dhcp 地址分配', rack(txt('DHCP', 30, 8)));
  I('ntp', 'NTP 时间服务器', 'ntp 时钟 时间同步', rack(`<circle cx="29" cy="29" r="6"/><path d="M29 26v3l2 2"/>`));
  I('proxy', '代理服务器', 'proxy 代理 正向反向', dev(`<rect x="19" y="20" width="10" height="14" rx="1.5"/><path d="M10 27h9M29 27h9M12 23l-3 4 3 4M36 23l3 4-3 4"/>`));
  I('net-behavior', '上网行为管理', '上网行为 流量管理 审计', dev(`<path d="M12 26h24M18 21v10M30 21v10"/><circle cx="12" cy="26" r="1.6" fill="currentColor" stroke="none"/>`));
  I('nta', '网络流量分析 NTA', 'nta 流量分析 全流量', dev(`<path d="M10 28l5-7 5 9 5-11 5 8 6-5"/>`));
  I('tap', '网络分流器 TAP', 'tap 分流 镜像', dev(`<path d="M12 26h9l8-6M21 26l8 6"/><circle cx="12" cy="26" r="1.8" fill="currentColor" stroke="none"/><circle cx="33" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="33" cy="32" r="1.8" fill="currentColor" stroke="none"/>`));
  I('firewall-route', '策略路由设备', 'pbr 策略路由', dev(`<path d="M12 27h24l-5-5M36 27l-5 5"/><path d="M14 21h8"/>`));

  /* ================= 安全防护设备 ================= */
  G('sec');
  I('firewall', '防火墙', 'firewall 防火墙 fw 边界', wall());
  I('ngfw', '下一代防火墙 NGFW', 'ngfw 下一代防火墙', shield(`<path d="M14 20h20M14 27h20M20 20v7M28 20v7"/>`));
  I('waf', 'WAF Web应用防火墙', 'waf web 应用防护', shield(txt('W', 30, 15)));
  I('ips', '入侵防御 IPS', 'ips 入侵防御 阻断', shield(`<circle cx="24" cy="24" r="8"/><path d="M18.5 29.5l11-11"/>`));
  I('ids', '入侵检测 IDS', 'ids 入侵检测', shield(`<circle cx="24" cy="24" r="8"/><path d="M24 24l6-5M14 15a14 14 0 0 1 9-3"/>`));
  I('av-gw', '防病毒网关', '防病毒 恶意代码 网关', shield(`<circle cx="24" cy="24" r="5"/><path d="M24 14v5M24 29v5M14 24h5M29 24h5"/>`));
  I('ddos', 'DDoS 防护', 'ddos 抗拒绝服务 清洗', shield(`<path d="M13 23c3-7 6 7 11 0s8 7 11 0M13 30c3-7 6 7 11 0s8 7 11 0"/>`));
  I('web-tamper', '网页防篡改', '网页防篡改 篡改', monitor(`<rect x="19" y="17" width="10" height="9" rx="1.5"/><path d="M21 17v-3a3 3 0 0 1 6 0v3"/>`));
  I('mail-gw', '邮件安全网关', '邮件网关 反垃圾 钓鱼', `<rect x="6" y="14" width="36" height="23" rx="2"/><path d="M6 16l18 13 18-13"/><path d="M24 24l-6 5M24 24l6 5"/>`);
  I('gap', '安全隔离网闸', '网闸 gap 物理隔离 摆渡', `<rect x="3" y="13" width="16" height="22" rx="2"/><rect x="29" y="13" width="16" height="22" rx="2"/><path d="M19 24h10" stroke-dasharray="2 3"/><path d="M7 24h5M36 24h5"/><path d="M7 19h8M33 19h8"/>`);
  I('oneway', '单向导入设备', '单向 导入 光闸', `<rect x="3" y="14" width="15" height="20" rx="2"/><rect x="30" y="14" width="15" height="20" rx="2"/><path d="M19 24h10m-4-4 4 4-4 4"/>`);
  I('utm', 'UTM 统一威胁管理', 'utm 统一威胁', dev(`<rect x="10" y="21" width="8" height="10" rx="1"/><rect x="20" y="21" width="8" height="10" rx="1"/><rect x="30" y="21" width="8" height="10" rx="1"/>`));
  I('dbfw', '数据库防火墙', '数据库防火墙 dbfirewall', cyl(`<path d="M13 30h22M20 30v7M28 30v7"/>`));
  I('dlp', '数据防泄漏 DLP', 'dlp 数据防泄漏 泄密', doc(`<path d="M17 24h14M17 29h10"/><path d="M30 30a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" transform="translate(-3 -4)"/><path d="M34 36l5 5"/>`));
  I('crypto', '加密机 / 密码机', '加密机 密码机 国密', dev(`<circle cx="20" cy="26" r="4.5"/><path d="M23 29l8 8M28 34l3-3M26 36l3-3"/>`));
  I('ca', 'CA / 数字证书', 'ca 证书 pki 数字证书', `<rect x="8" y="9" width="32" height="30" rx="2"/><path d="M14 17h20M14 23h14M14 29h10"/><circle cx="32" cy="31" r="5"/><path d="M30 31l1.6 1.6L34.5 29.7"/>`);
  I('iam', '身份认证 / 4A', 'iam 4a 统一身份 认证 sso', person(`<circle cx="35" cy="31" r="7"/><path d="M32 31l2 2 4-4"/>`));
  I('bastion', '堡垒机', '堡垒机 运维审计 4a fort', dev(`<path d="M11 34V23h5v-4h4v4h4v-4h4v4h5v11"/><path d="M20 34v-6h8v6"/>`));
  I('log-audit', '日志审计', '日志审计 log 综合日志', `<rect x="9" y="6" width="27" height="34" rx="2"/><path d="M15 14h15M15 20h15M15 26h10"/><circle cx="31" cy="31" r="6"/><path d="M35 35l5 5"/>`);
  I('db-audit', '数据库审计', '数据库审计 dbaudit', cyl(`<circle cx="19" cy="30" r="5"/><path d="M23 34l5 5"/>`));
  I('vuln-scan', '漏洞扫描设备', '漏洞扫描 漏扫 scanner', `<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="8"/><path d="M24 24l10-10"/><circle cx="32" cy="16" r="2" fill="currentColor" stroke="none"/><path d="M24 9v-4M9 24H5M39 24h4"/>`);
  I('baseline', '配置核查 / 基线核查', '基线核查 配置核查 加固', doc(`<path d="M16 22l2 2 4-4M16 30l2 2 4-4M26 23h6M26 31h6"/>`));
  I('edr', '终端安全 EDR', 'edr 终端防护 主机安全', monitor(`<path d="M24 15l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9v-6z"/><path d="M21 24l2 2 4-4"/>`));
  I('av-server', '防病毒服务器', '防病毒 杀毒 服务端', rack(`<path d="M24 18v12M18 24h12" stroke-width="3"/>`));
  I('sandbox', '沙箱 / 威胁分析', '沙箱 sandbox 动态分析', `<rect x="7" y="14" width="34" height="25" rx="2"/><path d="M7 21h34M17 14v7M31 14v7"/><circle cx="24" cy="30" r="4"/><path d="M24 26v-4M24 34v4"/>`);
  I('honeypot', '蜜罐 / 诱捕', '蜜罐 honeypot 欺骗', `<path d="M11 16h26l-3 22H14z"/><path d="M9 16h30"/><path d="M17 26c4-5 9 5 14 0"/><path d="M19 12c0-3 3-4 5-2M29 12c0-3-3-4-5-2"/>`);
  I('siem', 'SIEM / 态势感知', 'siem 态势感知 关联分析', monitor(`<path d="M9 28l6-6 5 4 7-9 5 5 7-7"/>`));
  I('soc', '安全管理平台 SOC', 'soc 安全管理中心 集中管控', monitor(`<path d="M6 18h36M18 8v10M6 24h36"/><circle cx="24" cy="28" r="4"/>`));
  I('code-audit', '代码审计', '代码审计 白盒 源代码', `<path d="M18 14l-8 10 8 10M30 14l8 10-8 10M27 10l-6 28"/><circle cx="35" cy="34" r="5"/><path d="M39 38l4 4"/>`);
  I('pentest', '渗透测试终端', '渗透测试 红队 测试机', monitor(`<circle cx="24" cy="21" r="7"/><circle cx="24" cy="21" r="3"/><path d="M24 10v4M24 28v4M13 21h4M31 21h4"/>`));
  I('hids', '主机入侵检测 HIDS', 'hids 主机ids', rack(`<path d="M24 18l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9v-6z" transform="translate(0 -1) scale(.8) translate(6 5)"/>`));
  I('microseg', '微隔离', '微隔离 东西向 隔离', `<rect x="5" y="9" width="38" height="30" rx="2"/><path d="M24 9v30" stroke-dasharray="4 3"/><rect x="10" y="16" width="8" height="8" rx="1"/><rect x="30" y="16" width="8" height="8" rx="1"/><rect x="10" y="29" width="8" height="6" rx="1"/><rect x="30" y="29" width="8" height="6" rx="1"/>`);
  I('ztna', '零信任网关', '零信任 ztna sdp', shield(`<circle cx="24" cy="19" r="4"/><path d="M17 32c0-4 3-7 7-7s7 3 7 7"/><path d="M15 15l-3-3M33 15l3-3"/>`));
  I('waf-cloud', '云 WAF', '云waf cdn 防护', cloud(shield(`<path d="M20 24h8M20 28h8"/>`)));
  I('anti-spam', '反垃圾邮件', '反垃圾 邮件过滤', `<rect x="6" y="14" width="36" height="22" rx="2"/><path d="M6 16l18 12 18-12"/><circle cx="24" cy="27" r="8"/><path d="M19 32l10-10"/>`);
  I('url-filter', 'URL 过滤 / 内容审计', 'url过滤 内容审计 上网', dev(`<circle cx="24" cy="26" r="7"/><path d="M19 31l10-10"/>`));
  I('keymgmt', '密钥管理系统 KMS', 'kms 密钥管理 密码', `<circle cx="19" cy="18" r="7"/><path d="M24 23l14 14M34 33l4-4M31 36l4-4M36 37l3 3"/>`);
  I('security-audit', '综合安全审计', '安全审计 合规审计', doc(`<circle cx="25" cy="26" r="6"/><path d="M29 30l5 5"/><path d="M17 17h10"/>`));
  I('net-admission', '网络准入 NAC', 'nac 准入控制 802.1x', dev(`<path d="M15 26h18M15 22v8M33 22v8"/><circle cx="24" cy="26" r="3"/>`));
  I('screen', '安全隔离 / 屏蔽室', '屏蔽 电磁 隔离', `<rect x="6" y="8" width="36" height="32" rx="2"/><path d="M6 16h36M6 32h36"/><path d="M12 24h24" stroke-dasharray="3 2"/>`);
  I('risk-monitor', '风险监测预警', '风险监测 预警 通报', `<path d="M24 7L43 41H5z"/><path d="M24 18v12M24 34v.5" stroke-width="2.5"/>`);

  /* ================= 计算与终端 ================= */
  G('host');
  I('server', '服务器（塔式）', 'server 服务器 主机', `<rect x="12" y="5" width="24" height="38" rx="2"/><path d="M12 13h24"/><circle cx="17" cy="9" r="1.2" fill="currentColor" stroke="none"/><path d="M17 21h14M17 27h14M17 33h8"/><circle cx="18" cy="39" r="1.3" fill="currentColor" stroke="none"/>`);
  I('rack-server', '机架式服务器', '机架 服务器 x86', rack());
  I('blade', '刀片服务器', '刀片 刀片中心', rack(`<path d="M18 5v38M28 5v38" stroke-dasharray="2 2"/>`));
  I('hypervisor', '虚拟化平台', '虚拟化 esxi hypervisor vmware', rack(`<rect x="18" y="8" width="9" height="5" rx="1"/><rect x="29" y="8" width="9" height="5" rx="1"/><rect x="18" y="18" width="9" height="5" rx="1"/><rect x="29" y="18" width="9" height="5" rx="1"/><rect x="18" y="28" width="9" height="5" rx="1"/><rect x="29" y="28" width="9" height="5" rx="1"/>`));
  I('vm', '虚拟机 VM', 'vm 虚拟机 云主机', `<rect x="5" y="10" width="38" height="28" rx="3" stroke-dasharray="4 3"/><path d="M5 18h38"/>${txt('VM', 30, 12)}`);
  I('docker', '容器 / Docker', 'docker 容器 container', `<rect x="9" y="19" width="9" height="9" rx="1"/><rect x="19.5" y="19" width="9" height="9" rx="1"/><rect x="30" y="19" width="9" height="9" rx="1"/><rect x="14.5" y="9" width="9" height="9" rx="1"/><rect x="25" y="9" width="9" height="9" rx="1"/><path d="M6 32h36"/>`);
  I('k8s', 'Kubernetes 集群', 'k8s kubernetes 容器编排', `<path d="M24 4l17 10v20L24 44 7 34V14z"/><circle cx="24" cy="24" r="6"/><path d="M24 14v4M24 30v4M14 24h4M30 24h4M17 17l3 3M28 28l3 3M31 17l-3 3M20 28l-3 3"/>`);
  I('cloud-vm', '云主机 ECS', '云主机 ecs 云计算', cloud(`<rect x="18" y="21" width="14" height="11" rx="1.5"/><path d="M18 25h14M25 32v3"/>`));
  I('pc', '终端 PC / 台式机', 'pc 终端 台式机 办公电脑', monitor());
  I('laptop', '笔记本电脑', '笔记本 laptop', `<rect x="9" y="9" width="30" height="23" rx="2"/><path d="M5 36h38l-4-4H9z"/><path d="M20 34h8"/>`);
  I('mobile', '移动终端', '手机 移动设备 pad', `<rect x="15" y="4" width="18" height="40" rx="3"/><path d="M21 9h6M22 40h4"/><circle cx="24" cy="36" r="1.2" fill="currentColor" stroke="none"/>`);
  I('printer', '打印机 / 一体机', '打印机 扫描仪 外设', `<path d="M13 32V16h22v16"/><rect x="9" y="27" width="30" height="12" rx="2"/><path d="M13 16V7h22v9"/><path d="M18 33h12v6H18z"/><circle cx="34" cy="31" r="1.2" fill="currentColor" stroke="none"/>`);
  I('camera', '网络摄像头', '摄像头 监控 视频', `<rect x="6" y="15" width="27" height="18" rx="2"/><path d="M33 20l9-5v18l-9-5z"/><circle cx="17" cy="24" r="5"/>`);
  I('access-ctrl', '门禁 / 读卡器', '门禁 读卡 物理访问', `<rect x="13" y="8" width="22" height="32" rx="2"/><path d="M19 20h10M19 26h10"/><path d="M24 30v6"/><circle cx="24" cy="16" r="2"/>`);
  I('plc', '工控机 / PLC', 'plc 工控 工控机 scada', `<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 18h36"/><path d="M12 24h6M12 30h6M30 24h6M30 30h6"/><circle cx="24" cy="27" r="4"/>`);
  I('iot', '物联网终端', 'iot 物联网 传感器 感知', `<circle cx="24" cy="24" r="6"/><path d="M24 6v9M24 33v9M6 24h9M33 24h9M11 11l6 6M31 31l6 6M37 11l-6 6M17 31l-6 6"/>`);
  I('storage', '磁盘阵列 / 存储', '存储 磁盘阵列 san 存储设备', `<rect x="5" y="9" width="38" height="30" rx="2"/><path d="M5 19h38M5 29h38"/><circle cx="11" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="11" cy="24" r="1.4" fill="currentColor" stroke="none"/><circle cx="11" cy="34" r="1.4" fill="currentColor" stroke="none"/><path d="M30 14h8M30 24h8M30 34h8"/>`);
  I('nas', 'NAS 网络存储', 'nas 文件存储 网络存储', cyl(`<path d="M17 30h14M24 30v8M20 36h8"/>`));
  I('san', 'SAN 光纤交换机', 'san 光纤交换机 fc', dev(`<path d="M12 26h8l8-6M20 26l8 6"/><circle cx="12" cy="26" r="1.8" fill="currentColor" stroke="none"/><circle cx="32" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="1.8" fill="currentColor" stroke="none"/>`));
  I('tape', '磁带库 / 离线备份', '磁带库 离线备份 归档', `<rect x="6" y="11" width="36" height="28" rx="2"/><path d="M6 19h36"/><rect x="11" y="23" width="10" height="10" rx="1"/><rect x="24" y="23" width="10" height="10" rx="1"/><path d="M15 27v2M28 27v2"/>`);
  I('backup', '备份一体机', '备份 灾备 一体机 快照', rack(`<path d="M31 19a8 8 0 1 0 0 12M31 19v-4m0 4l-4 1"/><path d="M24 34h-6"/>`));
  I('cdn', 'CDN 节点', 'cdn 内容分发 边缘节点', cloud(txt('CDN', 30, 9)));
  I('hci', '超融合 HCI', '超融合 hci 分布式', `<rect x="5" y="8" width="38" height="32" rx="2"/><path d="M5 19h38M19 19v21M32 19v21"/><path d="M10 14h5M24 14h5"/><circle cx="12" cy="29" r="2"/><circle cx="25" cy="29" r="2"/><circle cx="37" cy="29" r="2"/>`);
  I('cabinet', '机柜', '机柜 机架 机房', `<rect x="10" y="4" width="28" height="40" rx="2"/><path d="M10 12h28M10 20h28M10 28h28M10 36h28"/><circle cx="15" cy="8" r="1"/><circle cx="15" cy="16" r="1"/><circle cx="15" cy="24" r="1"/><circle cx="15" cy="32" r="1"/><circle cx="15" cy="40" r="1"/>`);
  I('ups', 'UPS 不间断电源', 'ups 电源 供电', `<rect x="7" y="12" width="34" height="26" rx="2"/><path d="M7 20h34"/><path d="M25 15l-7 13h7l-3 10 9-14h-7z"/><path d="M14 30h5M30 30h5"/>`);
  I('ops-terminal', '运维终端', '运维终端 管理终端', monitor(`<circle cx="24" cy="21" r="6"/><path d="M24 15v-3M24 27v3M15 21h-3M30 21h3"/>`));
  I('thin-client', '瘦终端 / 云桌面', '瘦终端 云桌面 vdi', monitor(`<rect x="14" y="16" width="20" height="14" rx="1" stroke-dasharray="3 2"/><path d="M20 22h8"/>`));

  /* ================= 数据与应用 ================= */
  G('data');
  I('database', '数据库', 'database db 数据库 mysql oracle', cyl());
  I('db-cluster', '分布式数据库 / 集群', '分布式 集群 主从 数据库', `<ellipse cx="15" cy="17" rx="9" ry="3.5"/><path d="M6 17v12c0 2 4 3.5 9 3.5s9-1.5 9-3.5V17"/><ellipse cx="33" cy="17" rx="9" ry="3.5"/><path d="M24 17v12c0 2 4 3.5 9 3.5s9-1.5 9-3.5V17"/><ellipse cx="24" cy="34" rx="9" ry="3.5"/><path d="M15 34v8c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-8"/>`);
  I('datawarehouse', '数据仓库', '数据仓库 dw 数据集市', cyl(`<path d="M24 6l10 5-10 5-10-5z"/><path d="M14 11v6l10 5 10-5v-6"/>`));
  I('bigdata', '大数据平台', 'hadoop 大数据 spark 数据湖', cloud(`<circle cx="17" cy="27" r="3"/><circle cx="31" cy="27" r="3"/><circle cx="24" cy="34" r="3"/><path d="M20 27h8M20 30l3 3M28 30l-3 3"/>`));
  I('appsys', '应用系统', '应用系统 业务应用 app', `<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 18h36"/><circle cx="10" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M13 26h9v9h-9zM26 23h9v5h-9zM26 31h9v4h-9z"/>`);
  I('web', 'Web 服务器', 'web 网站服务器 nginx apache iis', rack(txt('WEB', 30, 9)));
  I('middleware', '中间件', '中间件 middleware tomcat weblogic', `<path d="M24 6l17 9-17 9-17-9z"/><path d="M7 24l17 9 17-9M7 33l17 9 17-9"/>`);
  I('mq', '消息队列 MQ', 'mq 消息队列 kafka rabbitmq', `<rect x="5" y="19" width="10" height="10" rx="1.5"/><rect x="19" y="19" width="10" height="10" rx="1.5"/><rect x="33" y="19" width="10" height="10" rx="1.5"/><path d="M15 24h4M29 24h4"/><path d="M24 12v5M20 15l4-3 4 3"/>`);
  I('cache', '缓存 / Redis', 'redis 缓存 cache', `<path d="M24 6l17 9-17 9-17-9z"/><path d="M7 24l17 9 17-9M7 33l17 9 17-9"/><path d="M26 20l-5 8h4l-2 6 6-9h-4z"/>`);
  I('fileserver', '文件服务器', '文件服务器 ftp 共享', rack(`<path d="M19 18h9l3 3v8h-12z"/><path d="M19 18v-2h7l1 2"/>`));
  I('erp', 'ERP 业务系统', 'erp 业务系统 财务', `<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 18h36"/><path d="M12 24h10v12H12zM26 24h10v12H26z"/><path d="M15 28h4M15 32h4M29 28h4M29 32h4"/>`);
  I('oa', 'OA 办公系统', 'oa 办公 协同', doc(`<path d="M17 20h14M17 26h14M17 32h9"/>`));
  I('portal', '门户网站', '门户 网站 互联网门户', monitor(`<circle cx="24" cy="21" r="8"/><path d="M16 21h16M24 13c3 3 3 13 0 16M24 13c-3 3-3 13 0 16"/>`));
  I('app-mobile', '移动 APP', 'app 移动应用 客户端', `<rect x="14" y="4" width="20" height="40" rx="3"/><path d="M19 10h10"/><rect x="18" y="14" width="12" height="12" rx="2"/><path d="M20 31h8M20 35h5"/>`);
  I('backup-data', '备份数据 / 副本', '备份数据 副本 容灾', cyl(`<path d="M32 17a8 8 0 1 0 0 12M32 17v-4m0 4l-4 1"/>`));
  I('log-data', '日志数据', '日志 数据 记录', doc(`<path d="M17 19h13M17 25h13M17 31h9"/>`));
  I('data-middle', '数据中台 / ETL', '数据中台 etl 数据交换', `<rect x="6" y="18" width="12" height="12" rx="2"/><rect x="30" y="18" width="12" height="12" rx="2"/><path d="M18 24h12M26 20l4 4-4 4"/><path d="M12 12v6M36 12v6M12 30v6M36 30v6"/>`);
  I('api-gw', 'API 网关', 'api 网关 接口', dev(`<path d="M12 26h8l7-6M20 26l7 6"/><circle cx="12" cy="26" r="1.8" fill="currentColor" stroke="none"/><circle cx="32" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="1.8" fill="currentColor" stroke="none"/>`));

  /* ================= 区域与标注 ================= */
  G('zone');
  I('internet', '互联网 / 外部网络', '互联网 internet 外网', `<circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7c6 6 6 28 0 34M24 7c-6 6-6 28 0 34"/><path d="M10 16h28M10 32h28"/>`);
  I('cloud', '云计算平台', '云 云平台 公有云 私有云', cloud());
  I('datacenter', '数据中心 / 机房', '数据中心 机房 idc', `<path d="M8 41V20L24 9l16 11v21"/><path d="M4 41h40"/><rect x="18" y="26" width="12" height="15"/><path d="M13 22h5M30 22h5M13 30h3M32 30h3"/>`);
  I('branch', '分支机构 / 异地', '分支 分支机构 异地 专线', `<path d="M9 41V17h22v24M9 17l11-9 11 9"/><path d="M4 41h40"/><rect x="14" y="24" width="6" height="7"/><rect x="22" y="24" width="5" height="7"/><path d="M34 41V26h8v15"/>`);
  I('office', '办公区域 / 楼宇', '办公楼 办公区 楼宇', `<path d="M8 41V13h26v28M8 13l13-8 13 8"/><path d="M4 41h40"/><path d="M14 19h5v6h-5zM23 19h5v6h-5zM14 29h5v6h-5zM23 29h5v6h-5z"/>`);
  I('zone-box', '安全区域（自定义）', '安全域 区域 边界 zone 框', zoneBox('区域'));
  I('dmz', 'DMZ 隔离区', 'dmz 隔离区 非军事区', zoneBox('DMZ'));
  I('sec-zone', '安全管理区', '安全管理区 运维区 管理域', zoneBox('管理区'));
  I('core-zone', '核心业务区', '核心业务区 业务域', zoneBox('业务区'));
  I('db-zone', '数据库区', '数据库区 数据域', zoneBox('数据区'));
  I('test-zone', '开发测试区', '开发 测试 环境', zoneBox('测试区'));
  I('office-zone', '办公终端区', '办公终端区 终端域', zoneBox('终端区'));
  I('trust-zone', '可信 / 内网区域', '可信域 内网 信任', zoneBox('可信区'));
  I('user', '用户 / 访问者', '用户 人员 访问者', person());
  I('admin', '运维管理员', '管理员 运维人员 admin', person(`<path d="M33 30l4 4-3 3-4-4M31 32l3 3"/>`));
  I('attacker', '外部威胁源 / 攻击者', '攻击 威胁 黑客 攻击者', cloud(`<path d="M26 20l-6 8h5l-2 7 8-10h-5z"/>`));
  I('text', '文本标注', '文本 文字 标注 说明', `<path d="M9 13h30M9 21h22M9 29h28M9 37h15"/>`);
  I('note', '便签 / 备注', '便签 备注 注释', `<path d="M9 7h30v26l-8 8H9z"/><path d="M31 41v-8h8"/><path d="M15 17h18M15 24h18M15 31h10"/>`);
  I('generic', '通用设备', '通用 未知 其他设备', `<path d="M24 5l17 9.5v19L24 43 7 33.5v-19z"/><circle cx="24" cy="24" r="5"/>`);
  I('alarm', '告警 / 风险提示', '告警 风险 警告', `<path d="M24 6L44 41H4z"/><path d="M24 18v12M24 34v.6" stroke-width="2.6"/>`);
  I('clock', '时钟 / 时间戳', '时钟 时间 时间戳', `<circle cx="24" cy="24" r="17"/><path d="M24 13v11l8 5"/>`);
  I('lock', '加密 / 锁', '锁 加密 保护', `<rect x="11" y="21" width="26" height="20" rx="3"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/><circle cx="24" cy="30" r="2.5"/><path d="M24 32v4"/>`);
  I('shield-only', '安全边界标识', '盾 安全 边界标识', shield(`<path d="M18 24l4 4 8-8"/>`));
  I('flow-arrow', '数据流向标记', '箭头 流向 方向', `<path d="M6 24h32M32 17l7 7-7 7"/><path d="M6 18v12"/>`);
  I('strategy', '安全策略 / 访问控制', '策略 访问控制 acl', doc(`<path d="M17 20l2 2 4-4M17 28l2 2 4-4M27 21h5M27 29h5"/>`));
  I('checkbox', '合规检查项', '检查 合规 测评项', `<rect x="7" y="7" width="34" height="34" rx="3"/><path d="M15 24l6 6 13-14"/>`);

  /* ---------------- 二级子类分组 ----------------
   * 大类下面再按测评场景细分，便于在图标库中快速定位
   * 新增图标时务必在此登记，否则会归入「其他」并在控制台告警
   */
  const SUBGROUPS = [
    // 网络设备 25
    { cat: 'net', name: '路由与交换', ids: ['router', 'switch', 'switch-l3', 'switch-core', 'switch-agg', 'switch-access', 'hub', 'repeater', 'otn'] },
    { cat: 'net', name: '无线与广域接入', ids: ['ap', 'ac', 'sdwan'] },
    { cat: 'net', name: '网关与链路', ids: ['gateway', 'vpn', 'modem', 'lb', 'proxy', 'firewall-route'] },
    { cat: 'net', name: '网络基础服务', ids: ['dns', 'dhcp', 'ntp'] },
    { cat: 'net', name: '管控与流量监测', ids: ['sdn', 'net-behavior', 'nta', 'tap'] },
    // 安全防护设备 41
    { cat: 'sec', name: '边界防护与隔离', ids: ['firewall', 'ngfw', 'utm', 'gap', 'oneway', 'screen', 'microseg', 'ddos'] },
    { cat: 'sec', name: 'Web 与内容安全', ids: ['waf', 'waf-cloud', 'web-tamper', 'mail-gw', 'anti-spam', 'url-filter'] },
    { cat: 'sec', name: '检测与响应', ids: ['ips', 'ids', 'av-gw', 'av-server', 'edr', 'hids', 'sandbox', 'honeypot', 'risk-monitor'] },
    { cat: 'sec', name: '审计与核查', ids: ['log-audit', 'db-audit', 'dbfw', 'security-audit', 'bastion', 'baseline', 'vuln-scan', 'code-audit', 'pentest'] },
    { cat: 'sec', name: '身份鉴别与密码', ids: ['iam', 'ca', 'crypto', 'keymgmt', 'ztna', 'net-admission'] },
    { cat: 'sec', name: '集中管控与数据安全', ids: ['siem', 'soc', 'dlp'] },
    // 计算与终端 27
    { cat: 'host', name: '服务器与虚拟化', ids: ['server', 'rack-server', 'blade', 'hypervisor', 'vm', 'docker', 'k8s', 'hci'] },
    { cat: 'host', name: '云主机与分发', ids: ['cloud-vm', 'cdn'] },
    { cat: 'host', name: '存储与备份', ids: ['storage', 'nas', 'san', 'tape', 'backup'] },
    { cat: 'host', name: '办公终端与外设', ids: ['pc', 'laptop', 'mobile', 'printer', 'ops-terminal', 'thin-client'] },
    { cat: 'host', name: '物联与机房设施', ids: ['camera', 'access-ctrl', 'plc', 'iot', 'cabinet', 'ups'] },
    // 数据与应用 18
    { cat: 'data', name: '数据库与数据平台', ids: ['database', 'db-cluster', 'datawarehouse', 'bigdata', 'data-middle', 'backup-data', 'log-data'] },
    { cat: 'data', name: '中间件与基础服务', ids: ['web', 'middleware', 'mq', 'cache', 'fileserver', 'api-gw'] },
    { cat: 'data', name: '业务与应用系统', ids: ['appsys', 'erp', 'oa', 'portal', 'app-mobile'] },
    // 区域与标注 26
    { cat: 'zone', name: '网络与物理域', ids: ['internet', 'cloud', 'datacenter', 'branch', 'office'] },
    { cat: 'zone', name: '安全区域框', ids: ['zone-box', 'dmz', 'sec-zone', 'core-zone', 'db-zone', 'test-zone', 'office-zone', 'trust-zone'] },
    { cat: 'zone', name: '人员与角色', ids: ['user', 'admin', 'attacker'] },
    { cat: 'zone', name: '说明与标记', ids: ['text', 'note', 'generic', 'alarm', 'clock', 'lock', 'shield-only', 'flow-arrow', 'strategy', 'checkbox'] }
  ];
  const SUB_BY_ID = {};
  SUBGROUPS.forEach(function (g) { g.ids.forEach(function (id) { SUB_BY_ID[id] = g.name; }); });
  ICONS.forEach(function (it) { it.sub = SUB_BY_ID[it.id] || '其他'; });
  const ungrouped = ICONS.filter(function (i) { return !SUB_BY_ID[i.id]; }).map(function (i) { return i.id; });
  if (ungrouped.length && typeof console !== 'undefined') console.warn('[资产图标库] 未归入二级分类：', ungrouped.join(', '));

  /* 拖入画布时创建区域框（而非普通节点）的图标 */
  const ZONE_IDS = ['zone-box', 'dmz', 'sec-zone', 'core-zone', 'db-zone', 'test-zone', 'office-zone', 'trust-zone'];
  const TEXT_IDS = ['text', 'note'];

  const MAP = {};
  ICONS.forEach(function (it) { MAP[it.id] = it; });

  window.TopoIcons = {
    categories: CATEGORIES,
    subgroups: SUBGROUPS,
    icons: ICONS,
    map: MAP,
    zoneIds: ZONE_IDS,
    textIds: TEXT_IDS,
    catColor: function (id) {
      const c = CATEGORIES.find(function (x) { return x.id === id; });
      return c ? c.color : '#475569';
    },
    catName: function (id) {
      const c = CATEGORIES.find(function (x) { return x.id === id; });
      return c ? c.name : '其他';
    },
    subOf: function (id) { return (MAP[id] && MAP[id].sub) || '其他'; },
    svg: function (id, size, color) {
      const it = MAP[id] || MAP.generic;
      return '<svg viewBox="0 0 48 48" width="' + (size || 48) + '" height="' + (size || 48) + '" ' +
        'fill="none" stroke="' + (color || 'currentColor') + '" color="' + (color || 'currentColor') + '" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it.svg + '</svg>';
    }
  };
})();
