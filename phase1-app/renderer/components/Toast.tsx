import { useEffect, useState } from 'react';
import type { Launcher } from '../../shared/types';
import { IconCheck, IconX, IconWarn, IconInfo } from './Icons';

type ToastType = Launcher.ToastType;

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <IconCheck size={16} />,
  error: <IconX size={16} />,
  warn: <IconWarn size={16} />,
  info: <IconInfo size={16} />,
};

let setterRef: ((msg: string, type?: ToastType) => void) | null = null;

export function showToast(msg: string, type: ToastType = 'success') {
  setterRef?.(msg, type);
}

export function ToastHost() {
  const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({ msg: '', type: 'success', visible: false });

  useEffect(() => {
    setterRef = (msg, type = 'success') => {
      setToast({ msg, type, visible: true });
      window.setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400);
    };
    return () => { setterRef = null; };
  }, []);

  if (!toast.msg) return null;
  return (
    <div className={`toast ${toast.type} ${toast.visible ? 'show' : ''}`} data-testid="toast" role="status">
      <span className="toast-icon" data-testid={`toast-icon-${toast.type}`}>{ICONS[toast.type]}</span>
      <span data-testid="toast-msg">{toast.msg}</span>
    </div>
  );
}
