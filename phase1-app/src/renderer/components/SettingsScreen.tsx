import { useState, useEffect } from 'react';
import { showToast } from './Toast';

interface ProxyStatus {
  running: boolean;
  upstream: string;
  tcpPort: number;
  bytesUp: number;
  bytesDown: number;
  clients: number;
}

export function SettingsScreen({ ramMax, onRam, onOpenLog, onClean, javaVersion }: {
  ramMax: number;
  onRam: (mb: number) => void;
  onOpenLog: () => void;
  onClean: () => void;
  javaVersion?: string;
}) {
  const [localRam, setLocalRam] = useState(ramMax);
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [proxyLoading, setProxyLoading] = useState(false);

  // Fetch proxy status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await window.launcher.getProxyStatus();
        setProxyStatus(status);
      } catch (err) {
        console.error('Failed to fetch proxy status:', err);
      }
    };
    fetchStatus();
    // Refresh every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleProxyRestart = async () => {
    setProxyLoading(true);
    try {
      await window.launcher.restartProxy();
      showToast('Đã restart proxy', 'success');
      // Refresh status after restart
      setTimeout(async () => {
        const status = await window.launcher.getProxyStatus();
        setProxyStatus(status);
        setProxyLoading(false);
      }, 1000);
    } catch (err) {
      showToast('Restart proxy thất bại', 'error');
      setProxyLoading(false);
    }
  };

  const handleProxyStop = async () => {
    setProxyLoading(true);
    try {
      await window.launcher.stopProxy();
      showToast('Đã dừng proxy', 'success');
      // Refresh status after stop
      setTimeout(async () => {
        const status = await window.launcher.getProxyStatus();
        setProxyStatus(status);
        setProxyLoading(false);
      }, 500);
    } catch (err) {
      showToast('Dừng proxy thất bại', 'error');
      setProxyLoading(false);
    }
  };

  return (
    <div className="screen active" id="screen-settings" data-testid="screen-settings">
      <div className="page-header">
        <h2 className="page-title">Cấu Hình Launcher</h2>
        <p className="page-desc">Tinh chỉnh bộ nhớ RAM, xem log sự cố và quản lý file tạm.</p>
      </div>
      <div className="settings-group">
        <div className="setting-item" data-testid="setting-ram">
          <div className="setting-text">
            <h4>Bộ nhớ RAM cấp phát (Max Memory)</h4>
            <p>Khuyến nghị từ 4096 MB đến 6144 MB cho modpack này</p>
          </div>
          <div className="range-wrap">
            <input
              type="range"
              min={2048}
              max={12288}
              step={512}
              value={localRam}
              data-testid="ram-slider"
              onChange={(e) => setLocalRam(parseInt(e.target.value, 10))}
              onMouseUp={() => { onRam(localRam); showToast(`Đã lưu RAM max: ${localRam} MB`, 'success'); }}
            />
            <span className="range-val" data-testid="ram-value">{localRam} MB</span>
          </div>
        </div>
        <div className="setting-item" data-testid="setting-java">
          <div className="setting-text">
            <h4>Phiên bản Java</h4>
            <p>Tự động nhận diện JDK 17</p>
          </div>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--green)' }} data-testid="java-status">Java {javaVersion ?? '17.0.20'} (x64) OK</span>
        </div>
        <div className="setting-item" data-testid="setting-proxy">
          <div className="setting-text">
            <h4>WebSocket Proxy (Kết nối Server)</h4>
            <p>Proxy chuyển tiếp kết nối qua Cloudflare Tunnel tới server mc.tiulong.site</p>
            {proxyStatus && (
              <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>
                <div>Status: <span style={{ color: proxyStatus.running ? 'var(--green)' : 'var(--red)' }}>{proxyStatus.running ? 'Running' : 'Stopped'}</span></div>
                <div>Port: {proxyStatus.tcpPort} | Upstream: {proxyStatus.upstream}</div>
                <div>Traffic: ↑ {formatBytes(proxyStatus.bytesUp)} | ↓ {formatBytes(proxyStatus.bytesDown)}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn-small" 
              style={{ flex: 'unset', padding: '6px 14px', background: 'var(--panel-elevated)', borderColor: 'var(--border-focus)' }} 
              data-testid="btn-restart-proxy" 
              onClick={handleProxyRestart}
              disabled={proxyLoading}
            >
              {proxyLoading ? 'Đang xử lý...' : 'Restart Proxy'}
            </button>
            <button 
              className="btn-small" 
              style={{ flex: 'unset', padding: '6px 14px', background: 'var(--red)', borderColor: 'var(--red)' }} 
              data-testid="btn-stop-proxy" 
              onClick={handleProxyStop}
              disabled={proxyLoading || !proxyStatus?.running}
            >
              {proxyLoading ? 'Đang xử lý...' : 'Stop Proxy'}
            </button>
          </div>
        </div>
        <div className="setting-item" data-testid="setting-log">
          <div className="setting-text">
            <h4>Nhật ký khởi động & Crash Log</h4>
            <p>Xem log trực tiếp khi game bị văng hoặc gặp lỗi mod</p>
          </div>
          <button className="btn-small" style={{ flex: 'unset', padding: '6px 14px', background: 'var(--panel-elevated)', borderColor: 'var(--border-focus)' }} data-testid="btn-open-log" onClick={onOpenLog}>Xem log</button>
        </div>
        <div className="setting-item" data-testid="setting-cache">
          <div className="setting-text">
            <h4>Tự động dọn Cache</h4>
            <p>Giải phóng file rác tải về sau khi cập nhật modpack</p>
          </div>
          <button className="btn-small" style={{ flex: 'unset', padding: '6px 14px' }} data-testid="btn-clean" onClick={onClean}>Dọn dẹp</button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
