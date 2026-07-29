import React, { useState } from 'react';
import { 
  Radar, 
  Play, 
  Square, 
  Copy, 
  Check, 
  Download, 
  Activity, 
  Zap, 
  Globe,
  Gauge
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { ScannerCandidate } from '../types';

interface ScannerPageProps {
  lang: Language;
}

const CF_CIDRS = [
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '162.158.0.0/15',
  '188.114.96.0/20',
  '141.101.64.0/18',
  '108.162.192.0/18'
];

export const ScannerPage: React.FC<ScannerPageProps> = ({ lang }) => {
  const t = translations[lang];

  const [testTotal, setTestTotal] = useState<number>(120);
  const [keepCount, setKeepCount] = useState<number>(8);
  const [selectedPorts, setSelectedPorts] = useState<number[]>([443, 8443, 2053]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [results, setResults] = useState<ScannerCandidate[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [copiedIndex, setCopiedId] = useState<number | null>(null);
  const [applySuccess, setApplySuccess] = useState<boolean>(false);

  const availablePorts = [443, 8443, 2053, 2083, 2087, 2096];

  const togglePort = (port: number) => {
    if (selectedPorts.includes(port)) {
      if (selectedPorts.length > 1) {
        setSelectedPorts(selectedPorts.filter(p => p !== port));
      }
    } else {
      setSelectedPorts([...selectedPorts, port]);
    }
  };

  const generateRandomCfIp = (): string => {
    const cidr = CF_CIDRS[Math.floor(Math.random() * CF_CIDRS.length)];
    const [baseIP, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    const hostBits = 32 - prefix;
    const ipInt = baseIP.split('.').reduce((a, p, i) => a | (parseInt(p, 10) << (24 - i * 8)), 0);
    const randomOffset = Math.floor(Math.random() * Math.pow(2, hostBits));
    const mask = (0xFFFFFFFF << hostBits) >>> 0;
    const finalIP = (((ipInt & mask) >>> 0) + randomOffset) >>> 0;
    return [(finalIP >>> 24) & 0xFF, (finalIP >>> 16) & 0xFF, (finalIP >>> 8) & 0xFF, finalIP & 0xFF].join('.');
  };

  const probeIp = (ip: string, port: number): Promise<number | null> => {
    return new Promise((resolve) => {
      const start = performance.now();
      let done = false;
      const img = new Image();

      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve(null);
        }
      }, 2200);

      img.onload = img.onerror = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(Math.round(performance.now() - start));
        }
      };

      img.src = `https://${port === 443 ? ip : ip + ':' + port}/cdn-cgi/trace?_r=${Math.random()}`;
    });
  };

  const startScanEngine = async () => {
    setIsScanning(true);
    setProgressPct(0);
    setResults([]);
    setApplySuccess(false);
    setStatusMsg(t.scanner.scanning);

    const candidates: ScannerCandidate[] = [];
    const totalToTest = testTotal;
    let testedCount = 0;

    for (let i = 0; i < totalToTest; i++) {
      if (!isScanning && i > 0 && progressPct === 0) break; // Check abort

      const ip = generateRandomCfIp();
      const port = selectedPorts[Math.floor(Math.random() * selectedPorts.length)];

      const probes: number[] = [];
      for (let p = 0; p < 3; p++) {
        const ms = await probeIp(ip, port);
        if (ms !== null) probes.push(ms);
      }

      testedCount++;
      setProgressPct(Math.round((testedCount / totalToTest) * 100));

      if (probes.length > 0) {
        const avgMs = Math.round(probes.reduce((a, b) => a + b, 0) / probes.length);
        const jit = Math.round(Math.max(...probes) - Math.min(...probes));
        const loss = Math.round((1 - probes.length / 3) * 100);
        const score = avgMs + jit * 0.5 + loss * 20;

        candidates.push({ ip, port, ms: avgMs, jit, loss, score });
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    const bestCandidates = candidates.slice(0, keepCount);

    setResults(bestCandidates);
    setIsScanning(false);
    setStatusMsg(`Scan completed! Found ${bestCandidates.length} clean responsive IPs.`);
  };

  const handleApplyToCleanIps = async () => {
    try {
      const response = await fetch('/sub-setip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips: results.map(r => `${r.ip}:${r.port}`) })
      });
      if (response.ok) {
        setApplySuccess(true);
        setTimeout(() => setApplySuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Scanner Header Card */}
      <div className="glass-card p-6 border-blue-500/30 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <Radar className="w-6 h-6 text-blue-400 animate-spin-slow" />
              {t.scanner.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{t.scanner.desc}</p>
          </div>

          <button
            onClick={startScanEngine}
            disabled={isScanning}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-xs font-bold shrink-0"
          >
            {isScanning ? (
              <>
                <Square className="w-4 h-4 text-amber-300" />
                <span>Scanning... ({progressPct}%)</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{t.scanner.startScan}</span>
              </>
            )}
          </button>
        </div>

        {/* Probe Settings Row */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">{t.scanner.testCount}</label>
            <input
              type="number"
              min="20"
              max="400"
              value={testTotal}
              onChange={(e) => setTestTotal(parseInt(e.target.value) || 120)}
              className="w-full p-2.5 glass-input font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">{t.scanner.keepCount}</label>
            <input
              type="number"
              min="1"
              max="30"
              value={keepCount}
              onChange={(e) => setKeepCount(parseInt(e.target.value) || 8)}
              className="w-full p-2.5 glass-input font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">{t.scanner.selectPorts}</label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {availablePorts.map((p) => {
                const isSelected = selectedPorts.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePort(p)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {isScanning && (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-300"
              />
            </div>
            <p className="text-[11px] text-blue-300 font-mono text-center">{statusMsg}</p>
          </div>
        )}
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              {t.scanner.resultsTitle}
            </h3>

            <button
              onClick={handleApplyToCleanIps}
              className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-bold"
            >
              {applySuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">{t.scanner.appliedSuccess}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>{t.scanner.applyToCleanIps}</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 bg-white/5">
                  <th className="py-3 px-4 font-bold">{t.scanner.rank}</th>
                  <th className="py-3 px-4 font-bold">{t.scanner.ipPort}</th>
                  <th className="py-3 px-4 font-bold">{t.scanner.latency}</th>
                  <th className="py-3 px-4 font-bold">{t.scanner.jitter}</th>
                  <th className="py-3 px-4 font-bold">{t.scanner.loss}</th>
                  <th className="py-3 px-4 font-bold text-right rtl:text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((c, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors font-mono">
                    <td className="py-3 px-4 font-bold text-emerald-400">#{idx + 1}</td>
                    <td className="py-3 px-4 text-blue-300 font-bold">
                      {c.ip}:{c.port}
                    </td>
                    <td className="py-3 px-4 text-slate-200">{c.ms} ms</td>
                    <td className="py-3 px-4 text-slate-400">{c.jit} ms</td>
                    <td className="py-3 px-4 text-slate-400">{c.loss}%</td>
                    <td className="py-3 px-4 text-right rtl:text-left">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${c.ip}:${c.port}`);
                          setCopiedId(idx);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
                      >
                        {copiedIndex === idx ? (
                          <span className="text-emerald-400 font-bold">Copied</span>
                        ) : (
                          <span>Copy IP</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
