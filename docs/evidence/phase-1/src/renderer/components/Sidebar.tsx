import { useState } from 'react';
import { IconHome, IconGrid, IconSettings, IconEdit, IconLogout } from './Icons';

type Tab = 'home' | 'library' | 'settings';

export function Sidebar({ tab, onTab, hasUpdate }: { tab: Tab; onTab: (t: Tab) => void; hasUpdate: boolean }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  return (
    <aside>
      <div className="brand" data-testid="brand">
        <div className="brand-icon">M</div>
        <div className="brand-meta">
          <h2>MCPubg</h2>
          <span>v0.0.2-alpha</span>
        </div>
      </div>
      <div className="nav-group">
        <div className={`nav-item ${tab === 'home' ? 'active' : ''}`} data-testid="nav-home" onClick={() => onTab('home')}>
          <IconHome /> Chơi ngay
        </div>
        <div className={`nav-item ${tab === 'library' ? 'active' : ''}`} data-testid="nav-library" onClick={() => onTab('library')}>
          <IconGrid /> Bản cài đặt
          {hasUpdate && <span className="nav-badge-dot" data-testid="nav-badge-dot" title="Modpack v0.0.3 có sẵn" />}
        </div>
        <div className={`nav-item ${tab === 'settings' ? 'active' : ''}`} data-testid="nav-settings" onClick={() => onTab('settings')}>
          <IconSettings /> Cấu hình
        </div>
      </div>
      <div className="user-card" data-testid="user-card" onClick={() => setPopoverOpen((o) => !o)}>
        <div className="avatar">TL</div>
        <div className="info">
          <div className="name">TieuLong07</div>
          <div className="type">offline</div>
        </div>
      </div>
      {popoverOpen && (
        <div className="user-popover open" data-testid="user-popover" onClick={(e) => e.stopPropagation()}>
          <div className="item" data-testid="popover-rename">
            <IconEdit /> Đổi tên hiển thị
          </div>
          <div className="item" data-testid="popover-signout">
            <IconLogout /> Đăng xuất
          </div>
        </div>
      )}
    </aside>
  );
}
