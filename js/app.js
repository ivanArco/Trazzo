async function inject(id, url) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const res = await fetch(url);
    const html = await res.text();
    el.innerHTML = html;
  } catch (e) {
    console.error('[parcial]', url, e);
  }
}

async function boot() {
  await Promise.all([
    inject('app-header', 'partials/header.html'),
    inject('app-main',   'partials/main.html'),
    inject('app-footer', 'partials/footer.html'),
    inject('app-login',  'partials/login.html'),
    inject('app-dialogs','partials/dialogs.html'),
    inject('app-chatbot','partials/chatbot.html'),
    inject('app-toast',  'partials/toast.html'),
  ]);

  // Cargar el core DESPUÉS de inyectar todos los parciales
  const script = document.createElement('script');
  script.src = 'js/trazzo-core.js';
  document.body.appendChild(script);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
