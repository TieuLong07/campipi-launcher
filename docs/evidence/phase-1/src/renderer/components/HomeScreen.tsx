import { useEffect, useRef } from 'react';
import { IconPlay, IconBox } from './Icons';
import type { Launcher } from '../../shared/types';

export function HomeScreen({ state, onLaunch, launchState }: {
  state: Launcher.AppState;
  onLaunch: () => void;
  launchState: 'idle' | 'launching' | 'running' | 'failed';
}) {
  const selected = state.instances.find((i) => i.id === state.selectedInstanceId) ?? state.instances[0];
  const playLabel = launchState === 'launching' ? 'ĐANG VÀO...'
                  : launchState === 'running'   ? 'ĐANG CHẠY'
                  : launchState === 'failed'    ? 'THỬ LẠI'
                  : 'VÀO GAME';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let particles: { x: number; y: number; r: number; vx: number; vy: number; life: number }[] = [];
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const spawn = () => {
      if (particles.length > 50) return;
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.6 - 0.2,
        life: 1,
      });
    };
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      spawn();
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life -= 0.004;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 83, 44, ${p.life * 0.5})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="screen active" id="screen-home" data-testid="screen-home">
      <div className="hero" data-testid="hero">
        <canvas id="ambient-canvas" ref={canvasRef} />
        <div className="hero-top">
          <div className="server-status-card" data-testid="server-status">
            <span className="live-dot" />
            <span className="server-ip">mc.tiulong.site</span>
            <span className="server-players">24/100 người chơi</span>
          </div>
        </div>
        <div className="hero-bottom">
          <div className="hero-headline">
            <div className="hero-tag">VÕ THUẬT SỐNG CÒN</div>
            <h1 className="hero-title">MCPubg: Sinh Tồn Bo Thu</h1>
            <p className="hero-desc">Modpack 49 mods tối ưu cho combat 1.20.1. Vào chung server hoặc chơi đơn với bạn bè qua Hamachi.</p>
          </div>
          <div className="play-dock" data-testid="play-dock">
            <div className="instance-picker">
              <div className="instance-icon"><IconBox /></div>
              <div className="instance-select-wrap">
                <select className="instance-select" data-testid="instance-select" value={state.selectedInstanceId} onChange={(e) => window.launcher.selectInstance(e.target.value)}>
                  {state.instances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <div className="instance-meta" data-testid="instance-meta">{selected?.version ?? ''}</div>
              </div>
            </div>
            <div className="dock-actions">
              <button className="btn-launch" data-testid="btn-play" onClick={onLaunch} disabled={launchState === 'launching'}>
                <IconPlay />
                <span data-testid="play-text">{playLabel}</span>
                <div className="launch-progress" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
