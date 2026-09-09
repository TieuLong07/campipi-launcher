import { useState } from 'react';
import { IconDownload, IconGripVertical } from './Icons';
import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';
import { InstanceCard } from './InstanceCard';

// CamPiuPiu official modpack metadata
const CAMPIPIU_ID = 'campipiu';
const CAMPIPIU_META = {
  name: 'CamPiuPiu',
  version: '1.20.1-forge-47.4.10',
  description: 'Modpack server MCPubg — 49 mods combat, TACZ Firearms, GeckoLib',
  modsCount: 49,
};

export function LibraryScreen({ state, onSelect, onUpdate, onDelete, onReorder }: {
  state: Launcher.AppState;
  onSelect: (id: string) => void;
  onUpdate: (id: string) => void;
  onDelete?: (id: string) => void;
  onReorder?: (fromIdx: number, toIdx: number) => void;
}) {
  // Only campipiu = official modpack; everything else = user instances
  const campipiu = state.instances.find(i => i.id === CAMPIPIU_ID);
  const userInstances = state.instances.filter(i => i.id !== CAMPIPIU_ID);
  const [editing, setEditing] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx && onReorder) {
      onReorder(dragIdx, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="screen active" id="screen-library" data-testid="screen-library">
      <div className="page-header">
        <h2 className="page-title">Bản Cài Đặt (Instances)</h2>
        <p className="page-desc">Chọn bản muốn chơi, quản lý instance cá nhân.</p>
      </div>

      {/* === Modpack của Cam (CamPiuPiu) === */}
      <div className="instance-section" data-testid="official-section">
        <h3 className="section-title">Modpack của Cam</h3>
        <div className="instance-grid" data-testid="official-grid">
          {campipiu ? (
            <InstanceCard
              inst={campipiu}
              isSelected={campipiu.id === state.selectedInstanceId}
              onSelect={onSelect}
              onUpdate={onUpdate}
              showEdit={false}
            />
          ) : (
            <div className="instance-card campipiu-placeholder" data-testid="campipiu-placeholder">
              <div className="card-top">
                <div>
                  <div className="card-title">{CAMPIPIU_META.name}</div>
                  <div className="card-version">{CAMPIPIU_META.version}</div>
                </div>
                <span className="badge neutral">CHƯA CÀI</span>
              </div>
              <div className="card-details">
                <div className="status-badge">
                  <span className="status-dot empty" /> Chưa cài đặt trên máy
                </div>
                <div>{CAMPIPIU_META.description}</div>
                <div>{CAMPIPIU_META.modsCount} mods</div>
              </div>
              <div className="card-footer">
                <button className="btn-small btn-install" data-testid="btn-install-campipiu" onClick={async () => {
                  showToast('Đang cài đặt CamPiuPiu...', 'info');
                  try {
                    const result = await window.launcher.installCampipiu();
                    if (result.success) {
                      showToast(`Cài đặt thành công: ${result.modsInstalled} mods`, 'success');
                      // Force re-render by reloading page
                      window.location.reload();
                    } else {
                      showToast(`Lỗi cài đặt: ${result.error}`, 'error');
                    }
                  } catch (err) {
                    showToast(`Lỗi cài đặt: ${err}`, 'error');
                  }
                }}>
                  <IconDownload /> Cài đặt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="instance-divider" data-testid="instance-divider" />

      {/* === Instance khác === */}
      <div className="instance-section" data-testid="user-section">
        <div className="section-header-row">
          <h3 className="section-title">Instance khác</h3>
          <button className="btn-edit-toggle" data-testid="btn-toggle-edit" onClick={() => setEditing(!editing)}>
            {editing ? 'Xong' : 'Sửa'}
          </button>
        </div>
        <div className="instance-grid" data-testid="user-grid">
          {userInstances.map((inst, idx) => (
            <div
              key={inst.id}
              draggable={editing}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className={`drag-wrapper ${dragIdx === idx ? 'dragging' : ''} ${overIdx === idx && dragIdx !== idx ? 'drag-over' : ''}`}
            >
              {editing && (
                <div className="drag-handle" data-testid={`drag-handle-${inst.id}`}>
                  <IconGripVertical />
                </div>
              )}
              <InstanceCard
                inst={inst}
                isSelected={inst.id === state.selectedInstanceId}
                onSelect={onSelect}
                onUpdate={onUpdate}
                showEdit={editing}
                onDelete={onDelete ? () => onDelete(inst.id) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
