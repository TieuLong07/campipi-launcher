import { IconPlus } from './Icons';
import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';
import { InstanceCard } from './InstanceCard';

export function LibraryScreen({ state, onSelect, onUpdate }: {
  state: Launcher.AppState;
  onSelect: (id: string) => void;
  onUpdate: (id: string) => void;
}) {
  // cam = official modpack (dev-managed); others = user instances
  const officialPacks = state.instances.filter(i => i.id === 'cam' || (i.modsCount ?? 0) >= 40);
  const userInstances = state.instances.filter(i => i.id !== 'cam' && (i.modsCount ?? 0) < 40);

  return (
    <div className="screen active" id="screen-library" data-testid="screen-library">
      <div className="page-header">
        <h2 className="page-title">Bản Cài Đặt (Instances)</h2>
        <p className="page-desc">Chỉ giữ lại những bản bạn thường chơi, quan sát trạng thái sẵn sàng hoặc cập nhật của từng bản.</p>
      </div>
      
      {/* Official Modpacks Section */}
      {officialPacks.length > 0 && (
        <div className="instance-section" data-testid="official-section">
          <h3 className="section-title">Modpack của Cam</h3>
          <div className="instance-grid" data-testid="official-grid">
            {officialPacks.map((inst) => (
              <InstanceCard
                key={inst.id}
                inst={inst}
                isSelected={inst.id === state.selectedInstanceId}
                onSelect={onSelect}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider (only if both sections have items) */}
      {officialPacks.length > 0 && userInstances.length > 0 && (
        <div className="instance-divider" data-testid="instance-divider" />
      )}

      {/* User Instances Section */}
      <div className="instance-section" data-testid="user-section">
        <h3 className="section-title">Instance khác</h3>
        <div className="instance-grid" data-testid="user-grid">
          {userInstances.map((inst) => (
            <InstanceCard
              key={inst.id}
              inst={inst}
              isSelected={inst.id === state.selectedInstanceId}
              onSelect={onSelect}
              onUpdate={onUpdate}
            />
          ))}
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
