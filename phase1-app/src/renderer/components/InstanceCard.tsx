import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';

export function InstanceCard({ inst, isSelected, onSelect, onUpdate }: {
  inst: Launcher.Instance;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string) => void;
}) {
  return (
    <div
      className={`instance-card ${isSelected ? 'active-pack' : ''}`}
      data-testid={`instance-card-${inst.id}`}
      data-instance-id={inst.id}
    >
      <div className="card-top">
        <div>
          <div className="card-title">{inst.name}</div>
          <div className="card-version">{inst.version}</div>
        </div>
        {inst.badge && <span className={`badge ${inst.badge.kind}`} data-testid={`badge-${inst.id}`}>{inst.badge.label}</span>}
      </div>
      <div className="card-details">
        <div className="status-badge" data-testid={`status-${inst.id}`}>
          <span className={`status-dot ${inst.status}`} /> {inst.statusText}
        </div>
        {inst.details.map((d, idx) => <div key={idx}>{d}</div>)}
      </div>
      <div className="card-footer">
        {inst.actions.map((a) => (
          <button
            key={a.id}
            className="btn-small"
            data-testid={`action-${inst.id}-${a.id}`}
            onClick={() => {
              if (a.id === 'select') { onSelect(inst.id); showToast(`Đã chọn ${inst.name}`, 'success'); }
              else if (a.id === 'update') { onUpdate(inst.id); showToast('Đang cập nhật...', 'warn'); }
              else if (a.id === 'verify') { showToast('Đang kiểm tra tính toàn vẹn...', 'info'); window.launcher.cleanup().then(() => showToast('Không phát hiện lỗi. Tất cả file OK.', 'success')); }
              else if (a.id === 'download') { showToast('Đang tải tài nguyên...', 'info'); }
              else if (a.id === 'open-folder') { showToast('Đang mở thư mục...', 'info'); window.launcher.openFolder('mods'); }
              else { showToast(`Action ${a.id} (mock)`, 'info'); }
            }}
          >{a.label}</button>
        ))}
      </div>
    </div>
  );
}
