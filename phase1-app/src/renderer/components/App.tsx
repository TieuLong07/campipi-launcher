import { useEffect, useState, useCallback } from 'react';
import type { Launcher } from '../../shared/types';
import { Sidebar } from './Sidebar';
import { HomeScreen } from './HomeScreen';
import { LibraryScreen } from './LibraryScreen';
import { SettingsScreen } from './SettingsScreen';
import { LogModal } from './LogModal';
import { AccountModal } from './AccountModal';
import { UpdateBanner } from './UpdateBanner';
import { ToastHost, showToast } from './Toast';

declare global {
  interface Window { launcher: Launcher.IpcApi; }
}

type Tab = 'home' | 'library' | 'settings';

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [state, setState] = useState<Launcher.AppState | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logLines, setLogLines] = useState<Launcher.LogLine[]>([]);
  const [logStream, setLogStream] = useState<'all' | Launcher.LogLine['stream']>('all');
  const [launchState, setLaunchState] = useState<'idle' | 'launching' | 'running' | 'failed'>('idle');
  const [account, setAccount] = useState<Launcher.Account | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const refreshAccount = useCallback(async () => {
    try {
      const a = await window.launcher.accountsActive();
      setAccount(a);
    } catch {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    window.launcher.getState().then(setState).catch((e) => {
      showToast(`Lỗi tải state: ${e.message ?? e}`, 'error');
    });
    refreshAccount();
    const offLog = window.launcher.onLog((l) => setLogLines((prev) => [...prev, l].slice(-500)));
    const offState = window.launcher.onLaunchState((s) => setLaunchState(s));
    return () => { offLog(); offState(); };
  }, [refreshAccount]);

  const handleLaunch = useCallback(async () => {
    if (launchState === 'launching') return;
    if (launchState === 'running') {
      const ok = window.confirm('Đang có phiên chơi. Dừng ngay?');
      if (ok) { await window.launcher.killInstance(); setLaunchState('idle'); }
      return;
    }
    setLaunchState('launching');
    const res = await window.launcher.launchInstance({ instanceId: state?.selectedInstanceId ?? 'cam', jvmArgs: [`-Xmx${state?.ramMaxMb ?? 4096}M`] });
    if (!res.ok) {
      setLaunchState('failed');
      showToast(res.error ?? 'Launch thất bại', 'error');
    }
  }, [launchState, state]);

  const handleSelect = useCallback(async (id: string) => {
    await window.launcher.selectInstance(id);
    const next = await window.launcher.getState();
    setState(next);
  }, []);

  const handleUpdate = useCallback(async (id: string) => {
    await window.launcher.triggerUpdateInstance(id);
    const next = await window.launcher.getState();
    setState(next);
  }, []);

  const handleOpenLog = useCallback(async () => {
    const lines = await window.launcher.openLogModal();
    setLogLines(lines);
    setLogOpen(true);
  }, []);

  const handleClearLog = useCallback(() => {
    window.launcher.clearLog();
    setLogLines([]);
  }, []);

  const handleSaveLog = useCallback(async () => {
    const path = await window.launcher.saveLog();
    if (path) showToast(`Đã lưu log: ${path}`, 'success');
  }, []);

  const handleClean = useCallback(async () => {
    const res = await window.launcher.cleanCache();
    showToast(`Đã dọn dẹp cache (giải phóng ~${Math.round(res.freedBytes / 1024 / 1024)} MB)`, 'success');
  }, []);

  if (!state) {
    return <div className="app-shell" data-testid="loading"><main style={{ display: 'grid', placeItems: 'center' }}>Đang tải…</main><ToastHost /></div>;
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <Sidebar tab={tab} onTab={setTab} hasUpdate={state.hasUpdate} account={account} onOpenAccountModal={() => setAccountModalOpen(true)} launcherVersion={state.launcherVersion} />
      <main>
        <UpdateBanner />
        {tab === 'home' && <HomeScreen state={state} onLaunch={handleLaunch} launchState={launchState} />}
        {tab === 'library' && <LibraryScreen state={state} onSelect={handleSelect} onUpdate={handleUpdate} />}
        {tab === 'settings' && (
          <SettingsScreen
            ramMax={state.ramMaxMb}
            onRam={(mb) => { window.launcher.setRamMax(mb); setState({ ...state, ramMaxMb: mb }); }}
            onOpenLog={handleOpenLog}
            onClean={handleClean}
            javaVersion={state.java.version}
          />
        )}
      </main>
      <LogModal open={logOpen} lines={logLines} onClose={() => setLogOpen(false)} onClear={handleClearLog} onSave={handleSaveLog} stream={logStream} onStream={setLogStream} />
      <AccountModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} onAccountChange={refreshAccount} />
      <ToastHost />
    </div>
  );
}
