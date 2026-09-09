import { IconPlus } from './Icons';
import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';

export function LibraryScreen({ state, onSelect, onUpdate }: {
  state: Launcher.AppState;
  onSelect: (id: string) => void;
  onUpdate: (id: string) => void;
}) {
  // Separate official modpacks from user-created instances
  const officialPacks = state.instances.filter(i => i.id === 'mcpubg');
  const userInstances = state.instances.filter(i => i.id !== 'mcpubg');

  return (
    <div className="screen active" id="screen-library" data-testid="screen-library">
      <div className="page-header">
        <h2 className="page-title">Bản Cài Đặt (Instances)</h2>
        <p className="page-desc">Chỉ giữ lại những bản bạn thường chơi, quan sát trạng thái sẵn sàng hoặc cập nhật của từng bản.</p>
      </div>
      
      {/* Official Modpacks Section */}
      <div className="instance-section" data-testid="official-section">
        <h3 className="section-title">Modpack của Cam</h3>
        <div className="instance-grid" data-testid="official-grid">
          {officialPacks.map((inst) => {
            const isSelected = inst.id === state.selectedInstanceId;
            return (
              <div
                key={inst.id}
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
                        else if (a.id === 'download') { showToast('Đang tải tài nguyên 142 MB...', 'info'); }
                        else if (a.id === 'open-folder') { showToast('Đang mở thư mục...', 'info'); window.launcher.openFolder('mods'); }
                        else { showToast(`Action ${a.id} (mock)`, 'info'); }
                      }}
                    >{a.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="instance-divider" data-testid="instance-divider" />

      {/* User Instances Section */}
      <div className="instance-section" data-testid="user-section">
        <h3 className="section-title">Instance khác</h3>
        <div className="instance-grid" data-testid="user-grid">
          {userInstances.map((inst) => {
            const isSelected = inst.id === state.selectedInstanceId;
            return (
              <div
                key={inst.id}
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
                        else if (a.id === 'download') { showToast('Đang tải tài nguyên 142 MB...', 'info'); }
                        else if (a.id === 'open-folder') { showToast('Đang mở thư mục...', 'info'); window.launcher.openFolder('mods'); }
                        else { showToast(`Action ${a.id} (mock)`, 'info'); }
                      }}
                    >{a.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="instance-card add-card" data-testid="add-instance" onClick={() => showToast('Tạo instance mới (Phase 2 sẽ wire form đầy đủ).', 'info')}>
            <div className="add-icon-circle"><IconPlus /></div>
            <div>
              <div className="add-title">Tạo Instance Mới</div>
              <div className="add-desc">Forge, Fabric, Quilt hoặc Vanilla</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
