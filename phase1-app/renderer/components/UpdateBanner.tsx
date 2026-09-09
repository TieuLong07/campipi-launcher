import { useState, useEffect } from 'react';
import { showToast } from './Toast';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  modsToAdd: { filename: string; size: number }[];
  modsToUpdate: { filename: string; size: number }[];
  modsToRemove: string[];
  totalSize: number;
}

export function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Auto-check update on mount
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const result = await window.launcher.checkUpdate();
        if (result.ok && result.hasUpdate) {
          setUpdateInfo({
            hasUpdate: true,
            latestVersion: result.latestVersion || '0.0.2',
            modsToAdd: result.modsToAdd || [],
            modsToUpdate: result.modsToUpdate || [],
            modsToRemove: result.modsToRemove || [],
            totalSize: result.totalSize || 0,
          });
        }
      } catch (err) {
        console.error('Failed to check update:', err);
      }
    };
    checkUpdate();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await window.launcher.checkUpdate();
      if (result.ok) {
        if (result.hasUpdate) {
          setUpdateInfo({
            hasUpdate: true,
            latestVersion: result.latestVersion || '0.0.2',
            modsToAdd: result.modsToAdd || [],
            modsToUpdate: result.modsToUpdate || [],
            modsToRemove: result.modsToRemove || [],
            totalSize: result.totalSize || 0,
          });
          const totalCount = (result.modsToAdd?.length || 0) + (result.modsToUpdate?.length || 0);
          showToast(`Có ${totalCount} mod cần cập nhật: v${result.latestVersion}`, 'info');
        } else {
          setUpdateInfo(null);
          showToast('Đã là bản mới nhất', 'success');
        }
      } else {
        showToast('Không thể kiểm tra cập nhật', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi kiểm tra cập nhật', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const result = await window.launcher.applyUpdate();
      if (result.ok) {
        showToast('Cập nhật thành công!', 'success');
        setUpdateInfo(null);
      } else {
        showToast('Cập nhật thất bại: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Lỗi khi cập nhật', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (!updateInfo) return null;

  const addCount = updateInfo.modsToAdd.length;
  const updateCount = updateInfo.modsToUpdate.length;
  const removeCount = updateInfo.modsToRemove.length;
  const totalCount = addCount + updateCount;

  return (
    <div className="update-banner" data-testid="update-banner">
      <div className="update-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
        <span>
          Có bản cập nhật mới: <strong>v{updateInfo.latestVersion}</strong>
          {addCount > 0 && <span> &middot; +{addCount} mới</span>}
          {updateCount > 0 && <span> &middot; {updateCount} cập nhật</span>}
          {removeCount > 0 && <span> &middot; -{removeCount} bỏ</span>}
        </span>
        <span className="update-size">({formatBytes(updateInfo.totalSize)})</span>
      </div>
      <div className="update-actions">
        <button
          className="btn-small"
          onClick={handleRefresh}
          disabled={loading}
          data-testid="btn-refresh-update"
          title="Kiểm tra cập nhật"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {loading ? 'Đang kiểm tra...' : 'Refresh'}
        </button>
        <button
          className="btn-small btn-primary"
          onClick={handleUpdate}
          disabled={updating || totalCount === 0}
          data-testid="btn-apply-update"
        >
          {updating ? 'Đang cập nhật...' : `Cập nhật ${totalCount} mod`}
        </button>
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
