export interface UserUsage {
  totalBytes: number;
  dailyBytes: number;
  upBytes?: number;
  downBytes?: number;
}

export interface ProxyGeoInfo {
  flag: string;
  country: string;
  countryCode: string;
  city: string;
  isp: string;
}

export interface User {
  id: string;
  name: string;
  tag: string;
  token: string;
  username: string;
  key: string;
  cleanIp?: string;
  proxyIp?: string;
  ports?: string;
  userPorts?: string | null;
  enabled: boolean;
  disabledReason?: string;
  disabledAt?: number;
  expiry?: string;
  quotaBytes: number;
  dailyQuotaBytes: number;
  limitDailyReq?: number;
  notes?: string;
  fp?: string;
  speedLimitKBps?: number;
  connLimit?: number | null;
  maxConfigs?: number | null;
  userNodes?: string | null;
  userMode?: string | null;
  usernat64?: string | null;
  userPanelUrl?: string | null;
  ipLimit?: number;
  activeIps?: string;
  blockPorn?: number;
  blockAds?: number;
  fragLen?: string;
  fragInt?: string;
  lifetimeUsedGb?: number;
  userProxyIata?: string;
  userSocks5?: string;
  userProxyIp?: string;
  autoResetVolDays?: number;
  lastResetVolTime?: number;
  autoResetReqDays?: number;
  lastResetReqTime?: number;
  autoRotateIp?: number;
  rotateTime?: number;
  ipOperator?: string;
  ipCount?: number;
  lastRotateTime?: number;
  created?: string;
  // Computed fields from API
  usage?: UserUsage;
  status?: 'active' | 'disabled' | 'expired' | 'quota-exceeded' | 'daily-quota-exceeded';
  subscriptionUrl?: string;
  proxyIpGeo?: ProxyGeoInfo | null;
  onlineCount?: number;
}

export interface SystemStats {
  users: {
    total: number;
    active: number;
    disabled: number;
    expired: number;
    quotaExceeded: number;
  };
  traffic: {
    totalBytes: number;
    totalGB: string;
    dailyBytes: number;
    dailyGB: string;
  };
  system: {
    uptimeSeconds: number;
    version: string;
    isPaused: boolean;
    todayUsage: {
      up: number;
      down: number;
      total: number;
    };
  };
}

export interface ActivityLogItem {
  TYPE: string;
  IP: string;
  ASN: string;
  CC: string;
  URL: string;
  UA: string;
  TIME: number;
}

export interface AuditLogItem {
  id?: number;
  TIME: number;
  ACTOR: string;
  IP: string;
  ACTION: string;
  DETAIL: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key?: string;
  keyPreview?: string;
  createdAt: number;
  lastUsed?: number | null;
}

export interface LinkedPanel {
  url: string;
  apiKey: string;
  name?: string;
}

export interface SubMirrorConfig {
  enabled: boolean;
  repo: string;
  branch: string;
  pathPrefix: string;
  token: string;
}

export interface GlobalConfig {
  TIME?: string;
  HOST: string;
  HOSTS: string[];
  UUID: string;
  PATH: string;
  paused?: boolean;
  sugProtokol: 'vless' | 'trojan' | 'vmess' | 'ss' | 'mixed';
  protokolHaavara: 'ws' | 'grpc' | 'xhttp';
  matzavGRPC?: string;
  gRPCUserAgent?: string;
  dalegImutTeuda: boolean;
  efsher0RTT: boolean;
  pilugTLS?: string | null;
  nativAckrai: boolean;
  ECH: boolean;
  ECHConfig?: {
    DNS: string;
    SNI: string;
  };
  SS?: {
    shitatHatzpana: string;
    TLS: boolean;
  };
  Fingerprint: string;
  muvcharMinuyMecholel: {
    local: boolean;
    sifriyatIPmekomit: {
      ipAckrai: boolean;
      kamutAckrait: number;
      portMeyuchad: number;
    };
    SUB?: string | null;
    SUBNAME: string;
    NAMETPL?: string;
    SUBUpdateTime: number;
    TOKEN?: string;
  };
  tetzuratHamaratMinuy: {
    SUBAPI: string;
    SUBCONFIG: string;
    SUBEMOJI: boolean;
    SUBLIST: boolean;
  };
  mirror?: SubMirrorConfig;
  chainProxy?: string;
  socks5RotateEvery?: string;
  socks5RotateCount?: number;
  POOL_API?: string;
}

export interface NetworkSettings {
  enableRouting: boolean;
  enableGeoIP: boolean;
  enableGeoSite: boolean;
  enableAdBlock: boolean;
  enablePornBlock: boolean;
  enableDomesticBypass: boolean;
  enableDoH: boolean;
  dohProvider: string;
  enableLocalDNS?: boolean;
  localDNSIP?: string;
  localDNSPort?: string;
  enableAntiSanctionDNS?: boolean;
  antiSanctionDNSProvider?: string;
  antiSanctionCustomDNS?: string;
  enableFakeDNS?: boolean;
  fakeDNSIP?: string;
  enableIPv6: boolean;
  allowLAN?: boolean;
  logLevel: string;
  enableWarp: boolean;
  warpCalls: boolean;
  warpMode: 'warp' | 'chain' | 'wow';
  warpEndpoint: string;
  warpAmnezia: boolean;
  warpCleanIp: boolean;
  warpAmneziaLevel?: string;
  warpAmneziaJc?: number;
  warpAmneziaJmin?: number;
  warpAmneziaJmax?: number;
  customRules?: string;
  monthlyCapGB: number;
  speedLimitKBps: number;
  blockQUIC: boolean;
  enableMalwareBlock: boolean;
  enablePhishingBlock: boolean;
  bypassChina: boolean;
  bypassRussia: boolean;
  bypassSanctions: boolean;
  disguise: boolean;
  adminPath: string;
  loginPath: string;
  subPath: string;
  backendMode: boolean;
  backendUrl: string;
  linkedPanels: LinkedPanel[];
  hubPanelUrl: string;
  syncApiKey: string;
  autoUpdate: boolean;
  autoUpdateFormat: 'normal' | 'obfuscated';
  autoUpdateInterval: number;
  githubRepo: string;
  poolApi?: string;
  fakeConfigs?: Array<{ name: string; enabled: boolean; locked?: boolean }>;
  subUserAgent?: string;
  enableDirectConfigs?: boolean;
  customRouting?: string;
  metricNode?: string;
  multiUser?: boolean;
  users?: User[];
}

export interface RelayStatus {
  enabled: boolean;
  workerUrl: string;
  bestHost: string;
  requestHost: string;
  authKey: string;
  gasUrl: string;
  verified: boolean;
  verifiedAt: number;
}

export interface WarpAccountView {
  registered: boolean;
  addressV4?: string;
  addressV6?: string;
  peerPublicKey?: string;
  endpoint?: string;
  warpPlus?: boolean;
  license?: string;
  node?: string;
  conf?: string;
  wow?: WarpAccountView | null;
}

export interface ScannerCandidate {
  ip: string;
  port: number;
  ms: number;
  jit: number;
  loss: number;
  score: number;
}
