import { useEffect, useRef } from 'react';
import { IconClose, IconLog } from './Icons';
import type { Launcher } from '../../shared/types';
import { showToast } from './Toast';

export function LogModal({ open, lines, onClose, onClear, onSave, stream, onStream }: {
  open: boolean;
  lines: Launcher.LogLine[];
  onClose: () => void;
  onClear: () => void;
  onSave: () => void;
  stream: 'all' | Launcher.LogLine['stream'];
  onStream: (s: 'all' | Launcher.LogLine['stream']) => void;
}) {
  const consoleRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [lines]);
  if (!open) return null;
  const visible = stream === 'all' ? lines : lines.filter((l) => l.stream === stream);
  return (
    <div className="modal-overlay open" data-testid="log-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3><IconLog /> Nhật ký khởi động (Launcher Logs)</h3>
          <button className="btn-close-modal" data-testid="btn-close-log" onClick={onClose}><IconClose /></button>
        </div>
        <div className="modal-body">
          <div className="log-toolbar">
            <select data-testid="log-stream" value={stream} onChange={(e) => onStream(e.target.value as typeof stream)}>
              <option value="all">Tất cả log</option>
              <option value="forge">Forge stdout</option>
              <option value="forge-err">Forge stderr</option>
              <option value="launcher">Launcher</option>
              <option value="network">Network / Proxy</option>
            </select>
            <button className="btn-mini" data-testid="btn-clear-log" onClick={() => { onClear(); showToast('Đã xóa log', 'info'); }}>Xóa</button>
            <button className="btn-mini" data-testid="btn-save-log" onClick={() => { onSave(); }}>Lưu file</button>
          </div>
          <div className="log-console" data-testid="log-console" ref={consoleRef}>
            {visible.length === 0 && <div className="log-line"><span className="ts">[--:--:--]</span> <span className="info">Chưa có log. Mở và đóng modal để buffer log.</span></div>}
            {visible.map((l, i) => (
              <div key={i} className="log-line">
                <span className="ts">[{new Date(l.ts).toLocaleTimeString('vi-VN')}]</span> <span className={l.level}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
