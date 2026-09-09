import { useState } from 'react';
import { showToast } from './Toast';

export function SettingsScreen({ ramMax, onRam, onOpenLog, onClean }: {
  ramMax: number;
  onRam: (mb: number) => void;
  onOpenLog: () => void;
  onClean: () => void;
}) {
  const [localRam, setLocalRam] = useState(ramMax);
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
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--green)' }} data-testid="java-status">Java 17.0.20 (x64) OK</span>
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
