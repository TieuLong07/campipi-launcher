import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';
import { IconTrash } from './Icons';

export function InstanceCard({ inst, isSelected, onSelect, onUpdate, showEdit, onDelete }: {
  inst: Launcher.Instance;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string) => void;
  showEdit?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`instance-card ${isSelected ? 'active-pack' : ''}`}
      data-testid={`instance-card-${inst.id}`}
      data-instance-id={inst.id}
    >
      {showEdit && onDelete && (
        <button className="btn-delete-instance" data-testid={`delete-${inst.id}`} onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Xóa instance "${inst.name}"?`)) {
            onDelete();
            showToast(`Đã xóa ${inst.name}`, 'success');
          }
        }}>
          <IconTrash />
        </button>
      )}
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
        <button
          className={`btn-small ${isSelected ? 'btn-selected' : ''}`}
          data-testid={`action-${inst.id}-select`}
          onClick={() => { onSelect(inst.id); showToast(`Đã chọn ${inst.name}`, 'success'); }}
        >
          {isSelected ? 'ĐANG CHỌN' : 'Chọn chơi'}
        </button>
        {inst.actions.filter(a => a.id === 'update').map(a => (
          <button
            key={a.id}
            className="btn-small"
            data-testid={`action-${inst.id}-update`}
            onClick={() => { onUpdate(inst.id); showToast('Đang cập nhật...', 'warn'); }}
          >{a.label}</button>
        ))}
      </div>
    </div>
  );
}
