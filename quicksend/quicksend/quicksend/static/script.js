(() => {
  const installGlobalGuards = () => {
    window.addEventListener('error', (e) => {
      const msg = (e?.error?.message) || e?.message || '未知错误';
      if (String(msg).includes('MetaMask')) return;
      console.error('Global Error:', msg);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e?.reason;
      const msg = (reason && (reason.message || String(reason))) || '未知错误';
      const s = String(msg);
      if (s.includes('MetaMask')) return;
      console.error('Unhandled Rejection:', s);
    });
  };

  const fixLoopbackIpDisplay = () => {
    try {
      const loc = typeof window !== 'undefined' ? window.location : null;
      const host = loc ? loc.hostname : '';
      if (!['localhost', '127.0.0.1', '::1'].includes(host)) return;
      fetch('/api/ip')
        .then(r => r.json())
        .then(data => {
          const ip = String(data.ip || '');
          const port = data.port;
          const proto = String(data.proto || (loc ? (loc.protocol.replace(':','')) : 'http'));
          const addr = `${proto}://${ip.includes(':') && !ip.startsWith('[') ? `[${ip}]` : ip}${port ? `:${port}` : ''}`;
          try { window.__qs_addr__ = addr; } catch {}
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(el => (el.textContent || '').includes('局域网连接地址'));
          if (!label) return;
          const code = label.parentElement?.querySelector('code span')
            || label.parentElement?.nextElementSibling?.querySelector('code span');
          if (code) code.textContent = addr;
        })
        .catch(() => {});
    } catch {}
  };

  const installCopyOverride = () => {
    try {
      const mo = new MutationObserver(() => {
        try {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(el => (el.textContent || '').includes('局域网连接地址'));
          const card = label ? label.parentElement?.querySelector('.group\/ip') : null;
          if (!card) return;
          card.addEventListener('click', (e) => {
            try {
              const addr = window.__qs_addr__;
              if (!addr) return;
              e.stopPropagation();
              e.preventDefault();
              if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(addr).catch(() => {});
              }
            } catch {}
          }, true);
        } catch {}
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch {}
  };

  const installQrOverride = () => {
    try {
      const mo = new MutationObserver(() => {
        try {
          const canvas = document.getElementById('qr-code-canvas');
          if (!canvas) return;
          const addr = window.__qs_addr__;
          if (!addr) return;
          const parent = canvas.parentElement;
          const img = document.createElement('img');
          img.width = canvas.width || 240;
          img.height = canvas.height || 240;
          img.alt = '二维码';
          img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${img.width}x${img.height}&data=${encodeURIComponent(addr)}`;
          parent?.replaceChild(img, canvas);
          let p = null;
          const modal = parent ? parent.closest('.fixed') : null;
          if (parent && parent.nextElementSibling) {
            p = parent.nextElementSibling.querySelector('p');
          }
          if (!p && modal) {
            p = modal.querySelector('div.w-full.bg-slate-50.border.border-slate-200.rounded-lg.p-3.text-center p');
          }
          if (!p && modal) {
            const ps = Array.from(modal.querySelectorAll('p'));
            p = ps.find(el => (el.textContent||'').includes('://')) || ps.find(el => el.className.includes('font-mono')) || null;
          }
          if (p) p.textContent = addr;
        } catch {}
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch {}
  };

  const installGlobalCopyHandlers = () => {
    try {
      const orig = (navigator && navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;
      if (orig) {
        navigator.clipboard.writeText = (text) => {
          try {
            const addr = window.__qs_addr__;
            if (addr && /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)/i.test(String(text || ''))) {
              return orig(addr);
            }
          } catch {}
          return orig(text);
        };
      }
    } catch {}
    try {
      document.addEventListener('copy', (e) => {
        try {
          const addr = window.__qs_addr__;
          if (addr && e && e.clipboardData) {
            e.clipboardData.setData('text/plain', addr);
            e.preventDefault();
          }
        } catch {}
      }, true);
    } catch {}
  };

  const installExitOnUnload = () => {
    try {
      const hn = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
      if (!['localhost', '127.0.0.1'].includes(hn)) return;
      let sent = false;
      const send = () => {
        if (sent) return; sent = true;
        try {
          if (navigator && typeof navigator.sendBeacon === 'function') {
            const b = new Blob(['exit'], { type: 'text/plain' });
            navigator.sendBeacon('/api/exit', b);
            return;
          }
        } catch { }
        try { fetch('/api/exit', { method: 'POST', keepalive: true }); } catch { }
      };
      window.addEventListener('pagehide', send);
      window.addEventListener('beforeunload', send);
      window.addEventListener('unload', send);
    } catch { }
  };

  installGlobalGuards();
  document.addEventListener('DOMContentLoaded', () => {
    fixLoopbackIpDisplay();
    installCopyOverride();
    installQrOverride();
    installGlobalCopyHandlers();
  });
  // installExitOnUnload(); // 已禁用
})();
