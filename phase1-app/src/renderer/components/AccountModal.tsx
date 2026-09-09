import { useEffect, useState } from 'react';
import { IconClose, IconEdit, IconLogout, IconBox, IconCheck } from './Icons';
import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';

const TYPE_LABELS: Record<Launcher.Account['type'], { label: string; cls: string; short: string }> = {
  offline:   { label: 'Offline',         cls: 'amber', short: 'OF' },
  microsoft: { label: 'Microsoft',       cls: 'ms',    short: 'MS' },
  azauth:    { label: 'AZauth',          cls: 'az',    short: 'AZ' },
};

export function AccountModal({ open, onClose, onAccountChange }: { open: boolean; onClose: () => void; onAccountChange?: () => void }) {
  const [accounts, setAccounts] = useState<Launcher.Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [azauthOpen, setAzauthOpen] = useState(false);
  const [azauthUrl, setAzauthUrl] = useState('');
  const [azauthSecret, setAzauthSecret] = useState('');
  // Inline add/rename inputs (replace window.prompt which is disabled in Electron)
  const [addingOffline, setAddingOffline] = useState(false);
  const [newOfflineName, setNewOfflineName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const reload = async () => {
    try {
      const list = await window.launcher.accountsList();
      const active = await window.launcher.accountsActive();
      setAccounts(list);
      setActiveId(active?.id ?? null);
      onAccountChange?.();
    } catch (e: unknown) {
      showToast(`Lỗi: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  useEffect(() => { if (open) reload(); }, [open]);

  if (!open) return null;

  const submitAddOffline = async () => {
    const name = newOfflineName.trim();
    if (!name) { setAddingOffline(false); return; }
    try {
      await window.launcher.accountsAddOffline(name);
      showToast(`Đã thêm tài khoản offline: ${name}`, 'success');
      setNewOfflineName('');
      setAddingOffline(false);
      await reload();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const handleAddMicrosoft = async () => {
    try {
      const profile = await window.launcher.accountsAddMicrosoft();
      if (profile) {
        showToast(`Đã thêm Microsoft account: ${profile.username}`, 'success');
        await reload();
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), 'warn');
    }
  };

  const handleAddAzauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!azauthUrl || !azauthSecret) {
      showToast('Nhập URL + auth secret', 'warn');
      return;
    }
    try {
      const profile = { username: `az-${azauthUrl.split('/').pop()?.slice(0, 8) || 'user'}`, uuid: crypto.randomUUID(), url: azauthUrl, authSecret: azauthSecret };
      await window.launcher.accountsAddAzauth(profile);
      showToast(`Đã thêm AZauth: ${profile.username}`, 'success');
      setAzauthOpen(false);
      setAzauthUrl('');
      setAzauthSecret('');
      await reload();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await window.launcher.accountsSetActive(id);
      showToast('Đã chuyển tài khoản', 'success');
      await reload();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const submitRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    try {
      await window.launcher.accountsRename(id, name);
      showToast('Đã đổi tên', 'success');
      setRenamingId(null);
      setRenameValue('');
      await reload();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Xóa tài khoản này?')) return;
    try {
      await window.launcher.accountsRemove(id);
      showToast('Đã xóa tài khoản', 'success');
      await reload();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  return (
    <div className="modal-overlay open" data-testid="account-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>
            <IconBox />
            Quản lý tài khoản
          </h3>
          <button className="btn-close-modal" data-testid="account-modal-close" onClick={onClose}><IconClose /></button>
        </div>
        <div className="modal-body">
          <div className="section-label">Đã lưu ({accounts.length})</div>
          <div className="account-list">
            {accounts.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Chưa có tài khoản nào. Thêm bên dưới.
              </div>
            )}
            {accounts.map((acc) => {
              const t = TYPE_LABELS[acc.type];
              const isRenaming = renamingId === acc.id;
              return (
                <div key={acc.id} className={`account-row ${acc.id === activeId ? 'active' : ''}`} data-testid={`account-row-${acc.id}`} data-active={acc.id === activeId}>
                  <div className={`avatar ${t.cls}`}>{t.short}</div>
                  <div className="info" style={{ flex: 1, minWidth: 0 }}>
                    {isRenaming ? (
                      <input
                        className="form-control"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitRename(acc.id); if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }}
                        maxLength={16}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        data-testid={`rename-input-${acc.id}`}
                      />
                    ) : (
                      <div className="name">{acc.username}</div>
                    )}
                    <div className="type">{t.label} · UUID {acc.uuid.slice(0, 8)}...</div>
                  </div>
                  {isRenaming ? (
                    <>
                      <button className="icon-btn" title="Lưu" onClick={() => submitRename(acc.id)} data-testid={`rename-confirm-${acc.id}`}><IconCheck /></button>
                      <button className="icon-btn" title="Hủy" onClick={() => { setRenamingId(null); setRenameValue(''); }}><IconClose /></button>
                    </>
                  ) : (
                    <>
                      {acc.id === activeId ? (
                        <span className="badge active" style={{ fontSize: 9 }}>ĐANG DÙNG</span>
                      ) : (
                        <button className="btn-mini" data-testid={`account-activate-${acc.id}`} onClick={() => handleSetActive(acc.id)}>Dùng</button>
                      )}
                      <button className="icon-btn" title="Đổi tên" disabled={acc.type !== 'offline'} onClick={() => { setRenamingId(acc.id); setRenameValue(acc.username); }} data-testid={`rename-btn-${acc.id}`}>
                        <IconEdit />
                      </button>
                      <button className="icon-btn" title="Xóa" onClick={() => handleRemove(acc.id)}>
                        <IconLogout />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="section-label">Thêm tài khoản mới</div>
          <div className="account-list">
            {addingOffline ? (
              <div className="account-row" data-testid="add-offline-form" style={{ gap: 8 }}>
                <div className="avatar amber">OF</div>
                <input
                  className="form-control"
                  autoFocus
                  placeholder="Tên nhân vật (1-16 ký tự, chỉ chữ/số/_)"
                  value={newOfflineName}
                  onChange={(e) => setNewOfflineName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitAddOffline(); if (e.key === 'Escape') { setAddingOffline(false); setNewOfflineName(''); } }}
                  maxLength={16}
                  pattern="[A-Za-z0-9_]+"
                  style={{ flex: 1, fontSize: 13 }}
                  data-testid="offline-name-input"
                />
                <button className="icon-btn" title="Lưu" onClick={submitAddOffline} data-testid="offline-submit"><IconCheck /></button>
                <button className="icon-btn" title="Hủy" onClick={() => { setAddingOffline(false); setNewOfflineName(''); }}><IconClose /></button>
              </div>
            ) : (
              <div className="account-row add-row" data-testid="add-offline" onClick={() => setAddingOffline(true)}>
                <div className="avatar amber" style={{ background: 'linear-gradient(135deg, var(--amber), #b06d20)' }}>+</div>
                <div className="info">
                  <div className="name">Tài khoản Offline</div>
                  <div className="type">Tạo username tự do, không cần đăng nhập</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M9 18l6-6-6-6" /></svg>
              </div>
            )}
            <div className="account-row add-row" data-testid="add-microsoft" onClick={handleAddMicrosoft}>
              <div className="avatar ms">MS</div>
              <div className="info">
                <div className="name">Microsoft Account</div>
                <div className="type">Đăng nhập chính thức qua OAuth 2.0</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M9 18l6-6-6-6" /></svg>
            </div>
            <div className="account-row add-row" data-testid="add-azauth" onClick={() => setAzauthOpen(true)}>
              <div className="avatar az">AZ</div>
              <div className="info">
                <div className="name">AZauth <span style={{ color: 'var(--amber)', fontSize: 10 }}>[experimental]</span></div>
                <div className="type">Cho server riêng nội bộ, cần URL + auth secret</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </div>

          {azauthOpen && (
            <form onSubmit={handleAddAzauth} style={{ marginTop: 16, padding: 12, background: 'var(--panel-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>AZauth URL</label>
                <input className="form-control" type="text" placeholder="https://auth.yourserver.com" value={azauthUrl} onChange={(e) => setAzauthUrl(e.target.value)} data-testid="azauth-url" />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auth Secret</label>
                <input className="form-control" type="password" placeholder="••••••••" value={azauthSecret} onChange={(e) => setAzauthSecret(e.target.value)} data-testid="azauth-secret" />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="submit" className="btn-small" style={{ flex: 1, background: 'var(--brand)', color: '#fff', borderColor: 'transparent' }} data-testid="azauth-submit">Lưu</button>
                <button type="button" className="btn-small" onClick={() => setAzauthOpen(false)}>Hủy</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
