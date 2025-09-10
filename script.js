/* Merged & polished script.js
   - Auth via Formspree + localStorage
   - Toasts (aria-live) + fallback notification
   - Idea loading & rendering
   - Stats animation + intersection observer
   - Accessibility widget handlers
   - Minor accessibility improvements: focus management for modals
*/

/* NOTE:
   - Formspree endpoint used for signup submissions:
     https://formspree.io/f/mwpnakkl
   - This file intentionally keeps remote API fallbacks where reasonable:
     if your server exists it will be used; otherwise localStorage fallback is used.
*/

/* ---------------------------
   Config / LocalStorage keys
   --------------------------- */
const API_BASE = "http://127.0.0.1:5000"; // still available for ideas/users if you later run an API
const FORMSPREE_URL = "https://formspree.io/f/mwpnakkl";
const USERS_KEY = "ignite_users_v1";
const AUTH_KEY = "ignite_current_auth";
const IDEAS_KEY = "ignite_ideas_v1";

/* ---------- Utility & UX helpers ---------- */
function createLiveRegion() {
  let el = document.getElementById('ic-live');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ic-live';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.overflow = 'hidden';
    document.body.appendChild(el);
  }
  return el;
}
const liveRegion = createLiveRegion();

function toast(message, type = 'info', timeout = 3500) {
  // accessible live region
  liveRegion.textContent = message;

  // visual toast
  let container = document.getElementById('ic-toast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ic-toast';
    container.style.position = 'fixed';
    container.style.right = '20px';
    container.style.bottom = '20px';
    container.style.zIndex = 99999;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const t = document.createElement('div');
  t.className = `ic-toast-item ic-${type}`;
  t.textContent = message;
  t.style.padding = '10px 14px';
  t.style.borderRadius = '10px';
  t.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
  t.style.background = type === 'error' ? '#fff0f0' : type === 'success' ? '#f0fff4' : '#ffffff';
  t.style.color = '#111';
  t.style.fontWeight = '700';
  t.style.opacity = '0';
  t.style.transform = 'translateY(8px)';
  t.style.transition = 'opacity .24s ease, transform .24s ease';
  container.appendChild(t);

  // animate in
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 300);
  }, timeout);
}

/* legacy fallback notification */
function showNotification(message, type = 'info') {
  toast(message, type);
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notificationText');
  if (notification && notificationText) {
    notificationText.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
  }
}

/* spinner small SVG */
function spinnerHTML(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" stroke-width="4" stroke="#333" stroke-opacity="0.18" fill="none"/><path d="M45 25a20 20 0 0 1-20 20" stroke="#333" stroke-width="4" fill="none"/></svg>`;
}

/* small HTML escape */
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

/* ---------- fetchWithCreds (kept for optional API calls) ---------- */
const fetchWithCreds = (url, opts = {}) => {
  opts.credentials = 'include';
  return fetch(url, opts);
};

/* ---------- LocalStorage simple DB helpers ---------- */
function loadUsersLocal() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch (err) {
    return [];
  }
}
function saveUsersLocal(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function loadCurrentAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch (err) {
    return null;
  }
}
function saveCurrentAuth(obj) {
  if (!obj) localStorage.removeItem(AUTH_KEY);
  else localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
}
function clearCurrentAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/* ---------- Ideas local storage helpers ---------- */
function loadIdeasLocal() {
  try {
    return JSON.parse(localStorage.getItem(IDEAS_KEY)) || [];
  } catch (err) {
    return [];
  }
}
function saveIdeasLocal(ideas) {
  localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
}

/* ---------- Auth UI injection & modals ---------- */
function injectAuthUI() {
  const header = document.querySelector('header .nav-container');
  if (!header) return;

  if (!document.getElementById('ic-account-wrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'ic-account-wrap';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    wrap.style.marginLeft = '16px';
    wrap.style.justifyContent = 'flex-end';
    // insert before nav-actions (if exists)
    const navActions = header.querySelector('.nav-actions');
    header.insertBefore(wrap, navActions);
  }

  const accountWrap = document.getElementById('ic-account-wrap');
  accountWrap.innerHTML = `
    <button id="ic-login-btn" class="cta-button" aria-haspopup="dialog">Log in</button>
    <button id="ic-signup-btn" class="secondary-button" aria-haspopup="dialog">Sign up</button>
    <div id="ic-user-menu" style="display:none;align-items:center;gap:8px;">
      <span id="ic-user-name" style="font-weight:700;color:#fff"></span>
      <span id="ic-verified-badge" style="display:none;background:#e6ffef;color:#0a7a3a;padding:4px 8px;border-radius:12px;font-size:12px;">Verified</span>
      <button id="ic-logout-btn" class="secondary-button">Logout</button>
    </div>
  `;

  // container for injected auth modals
  if (!document.getElementById('ic-modals')) {
    const container = document.createElement('div');
    container.id = 'ic-modals';
    document.body.appendChild(container);
  }

  /* Login modal */
  if (!document.getElementById('ic-login-modal')) {
    const loginModal = document.createElement('div');
    loginModal.id = 'ic-login-modal';
    loginModal.className = 'ic-modal';
    loginModal.setAttribute('aria-hidden', 'true');
    loginModal.innerHTML = `
      <div class="ic-modal-backdrop" data-modal="backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;"></div>
      <div class="ic-modal-card" role="dialog" aria-modal="true" aria-labelledby="ic-login-title" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;width:360px;padding:18px;border-radius:10px;z-index:10001;box-shadow:0 12px 40px rgba(0,0,0,0.12);">
        <h3 id="ic-login-title" style="margin:0 0 8px 0;">Log in to Ignite Code</h3>
        <p style="margin:0 0 14px 0;color:#666">Please log in with your email</p>
        <form id="ic-login-form">
          <input required id="ic-login-email" type="email" placeholder="Email" style="width:100%;padding:10px;margin-bottom:8px;border-radius:8px;border:1px solid #ddd" />
          <input required id="ic-login-password" type="password" placeholder="Password" style="width:100%;padding:10px;margin-bottom:8px;border-radius:8px;border:1px solid #ddd" />
          <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;">
            <button type="button" id="ic-login-cancel" class="secondary-button" style="color: #000">Cancel</button>
            <button type="submit" id="ic-login-submit" class="cta-button">Log in</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById('ic-modals').appendChild(loginModal);
  }

  /* Signup modal */
  if (!document.getElementById('ic-signup-modal')) {
    const signupModal = document.createElement('div');
    signupModal.id = 'ic-signup-modal';
    signupModal.className = 'ic-modal';
    signupModal.setAttribute('aria-hidden', 'true');
    signupModal.innerHTML = `
      <div class="ic-modal-backdrop" data-modal="backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;"></div>
      <div class="ic-modal-card" role="dialog" aria-modal="true" aria-labelledby="ic-signup-title" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;width:420px;padding:18px;border-radius:10px;z-index:10001;box-shadow:0 12px 40px rgba(0,0,0,0.12);">
        <h3 id="ic-signup-title" style="margin:0 0 8px 0;">Create your account</h3>
        <p style="margin:0 0 12px 0;color:#666">We'll send a verification link to your email (Formspree will email you).</p>
        <form id="ic-signup-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input required id="ic-signup-first" placeholder="First name" style="padding:10px;border-radius:8px;border:1px solid #ddd" />
            <input required id="ic-signup-last" placeholder="Last name" style="padding:10px;border-radius:8px;border:1px solid #ddd" />
          </div>
          <input required id="ic-signup-email" type="email" placeholder="Email" style="width:100%;padding:10px;margin-top:8px;border-radius:8px;border:1px solid #ddd" />
          <input required id="ic-signup-password" type="password" placeholder="Choose a password" style="width:100%;padding:10px;margin-top:8px;border-radius:8px;border:1px solid #ddd" />
          <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px">
            <button type="button" id="ic-signup-cancel" class="secondary-button" style="color: #000">Cancel</button>
            <button type="submit" id="ic-signup-submit" class="cta-button">Sign up</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById('ic-modals').appendChild(signupModal);
  }
}

/* ---------- Auth state and UI reflection (local) ---------- */
let currentAuth = loadCurrentAuth() || { loggedIn: false, user: null, verified: false };

function checkAuth() {
  // In a front-end-only setup we rely on localStorage
  const auth = loadCurrentAuth();
  if (auth) {
    currentAuth = { loggedIn: true, user: auth, verified: true }; // we treat local signups as verified for demo
  } else {
    currentAuth = { loggedIn: false, user: null, verified: false };
  }
  reflectAuthInUI();
  return Promise.resolve(currentAuth);
}

function reflectAuthInUI() {
  const loginBtn = document.getElementById('ic-login-btn');
  const signupBtn = document.getElementById('ic-signup-btn');
  const userMenu = document.getElementById('ic-user-menu');
  const userName = document.getElementById('ic-user-name');
  const verifiedBadge = document.getElementById('ic-verified-badge');

  const auth = loadCurrentAuth();

  if (!loginBtn || !signupBtn || !userMenu) return;

  if (auth) {
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    userMenu.style.display = 'flex';
    userName.textContent = auth.firstName || auth.email || 'Member';
    verifiedBadge.style.display = 'none'; // we don't have an email verification step in local demo
  } else {
    loginBtn.style.display = 'inline-block';
    signupBtn.style.display = 'inline-block';
    userMenu.style.display = 'none';
  }

  // protect CTA buttons if not logged in
  const ideaButtons = document.querySelectorAll('.cta-button, #submitIdeaBtn, #ctaIdeaBtn');
  ideaButtons.forEach(btn => {
    if (!auth) {
      btn.classList.add('ic-locked');
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'Please log in to use this';
    } else {
      btn.classList.remove('ic-locked');
      btn.removeAttribute('aria-disabled');
      btn.title = '';
    }
  });
}

/* open/close utility for modals (works for injected modals too) */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'grid';
  el.setAttribute('aria-hidden', 'false');
  // focus first input
  const first = el.querySelector('input, button, textarea, select');
  if (first) first.focus();
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
}

/* Focus trap for simple modal accessibility (basic) */
function trapFocus(modalEl) {
  if (!modalEl) return;
  const focusable = modalEl.querySelectorAll('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  const handler = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    } else if (e.key === 'Escape') {
      modalEl.style.display = 'none';
    }
  };
  modalEl.addEventListener('keydown', handler);
  // return remover
  return () => modalEl.removeEventListener('keydown', handler);
}

/* ---------- Wire auth modals & handlers (local + Formspree) ---------- */
function wireAuthModals() {
  const loginBtn = document.getElementById('ic-login-btn');
  const signupBtn = document.getElementById('ic-signup-btn');

  if (loginBtn) loginBtn.addEventListener('click', () => openModal('ic-login-modal'));
  if (signupBtn) signupBtn.addEventListener('click', () => openModal('ic-signup-modal'));

  // close / cancel buttons for injected modals
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.matches('#ic-login-cancel')) closeModal('ic-login-modal');
    if (target.matches('#ic-signup-cancel')) closeModal('ic-signup-modal');
    // backdrop click closes
    if (target.closest('.ic-modal') && target.dataset.modal === 'backdrop') {
      const modal = target.closest('.ic-modal');
      if (modal) modal.style.display = 'none';
    }
  });

  // resend verification link (not functional without backend) - provide helpful message
  const resend = document.getElementById('ic-resend-link');
  if (resend) resend.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('ic-login-email')?.value;
    if (!email) return toast('Enter your email above then click Resend', 'error');
    // No backend to resend in frontend-only mode — inform the user.
    toast('This demo does not send verification emails. Use signup to register locally.', 'info', 5000);
  });

  /* Login submit (local validation) */
  const loginForm = document.getElementById('ic-login-form');
  if (loginForm) loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (document.getElementById('ic-login-email')?.value || '').trim();
    const password = document.getElementById('ic-login-password')?.value || '';
    const submitBtn = document.getElementById('ic-login-submit');
    const prev = submitBtn?.innerHTML;
    if (submitBtn) { submitBtn.innerHTML = spinnerHTML(14) + ' Logging in...'; submitBtn.disabled = true; }

    // local check
    const users = loadUsersLocal();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    setTimeout(() => { // small delay to improve UX
      if (!user) {
        toast('No account found with that email. Please sign up.', 'error');
      } else if (user.password !== password) {
        // EXACT message requested
        toast('Incorrect password, try again.', 'error');
      } else {
        // success
        saveCurrentAuth(user);
        toast('Welcome back!', 'success');
        closeModal('ic-login-modal');
        reflectAuthInUI();
      }
      if (submitBtn) { submitBtn.innerHTML = prev; submitBtn.disabled = false; }
    }, 400);
  });

  /* Signup submit (save locally + send to Formspree) */
  const signupForm = document.getElementById('ic-signup-form');
  if (signupForm) signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = (document.getElementById('ic-signup-first')?.value || '').trim();
    const last = (document.getElementById('ic-signup-last')?.value || '').trim();
    const email = (document.getElementById('ic-signup-email')?.value || '').trim().toLowerCase();
    const password = document.getElementById('ic-signup-password')?.value || '';
    const submitBtn = document.getElementById('ic-signup-submit');
    if (!first || !email || !password) return toast('Please fill required fields', 'error');

    const prev = submitBtn?.innerHTML;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = spinnerHTML(14) + ' Creating...'; }

    try {
      const users = loadUsersLocal();
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        toast('Email already registered. Try logging in.', 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = prev; }
        return;
      }

      const newUser = { firstName: first, lastName: last, email, password, createdAt: new Date().toISOString() };
      users.push(newUser);
      saveUsersLocal(users);

      // Send signup info to Formspree (firstName,lastName,email)
      try {
        await fetch(FORMSPREE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: first, lastName: last, email })
        });
        // don't require success — it's best-effort
      } catch (err) {
        console.warn('Formspree signup send failed', err);
      }

      // auto-login demo user
      saveCurrentAuth(newUser);
      toast('Account created — you are now logged in (demo).', 'success');
      closeModal('ic-signup-modal');
      reflectAuthInUI();
    } catch (err) {
      console.error('Signup error', err);
      toast('Could not create account locally', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = prev; }
    }
  });

  /* Logout (local-only) */
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'ic-logout-btn') {
      clearCurrentAuth();
      toast('Logged out', 'info');
      reflectAuthInUI();
    }
  });
}

/* ---------- Load users (legacy/fallback remote optional) ---------- */
async function loadUsers() {
  // attempt remote user list for admin debugging if API exists
  try {
    const res = await fetch(`${API_BASE}/get`);
    if (res.ok) {
      const users = await res.json();
      const userList = document.getElementById('userList');
      if (userList) {
        userList.innerHTML = '';
        users.forEach(u => {
          const li = document.createElement('li');
          li.textContent = `${u.id}: ${u.name || u.email || 'User'}`;
          userList.appendChild(li);
        });
      }
      return;
    }
  } catch (err) {
    // ignore remote failures
  }
  // fallback to local DB
  if (typeof DB !== 'undefined' && DB.getUsers) {
    const users = DB.getUsers();
    const userList = document.getElementById('userList');
    if (userList) {
      userList.innerHTML = '';
      users.forEach(u => {
        const li = document.createElement('li');
        li.textContent = `${u.id || '-'}: ${u.firstName || u.name || u.email || 'User'}`;
        userList.appendChild(li);
      });
    }
  } else {
    // populate from localStorage users for visibility
    const users = loadUsersLocal();
    const userList = document.getElementById('userList');
    if (userList) {
      userList.innerHTML = '';
      users.forEach((u, idx) => {
        const li = document.createElement('li');
        li.textContent = `${idx + 1}: ${u.firstName || u.email}`;
        userList.appendChild(li);
      });
    }
  }
}

/* ---------- Stats animation ---------- */
function animateValue(id, start, end, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  let startTime = null;
  const step = (ts) => {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    el.textContent = Math.floor(progress * (end - start) + start);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* observe stats */
const statsEl = document.getElementById('our-impact');
if (statsEl) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateValue('ideasCount', 0, 1250, 2000);
        animateValue('startupsCount', 0, 240, 2000);
        animateValue('membersCount', 0, 5600, 2000);
        animateValue('countriesCount', 0, 85, 2000);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  observer.observe(statsEl);
}

/* ---------- Idea submission + registration protection ---------- */
async function setupIdeaProtection() {
  // IDEA FORM
  const ideaForm = document.getElementById('ideaForm');
  if (ideaForm) {
    ideaForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const auth = loadCurrentAuth();
      if (!auth) { toast('Please log in to submit ideas', 'error'); openModal('ic-login-modal'); return; }
      if (!auth) { toast('Please verify your email before submitting ideas', 'error', 5000); return; }

      const formData = new FormData(this);
      const tags = (formData.get('ideaTags') || '').split(',').map(t => t.trim()).filter(Boolean);
      const ideaPayload = {
        title: formData.get('ideaTitle'),
        description: formData.get('ideaDescription'),
        category: formData.get('ideaCategory'),
        tags,
        author: auth.email || (auth.firstName ? `${auth.firstName} ${auth.lastName || ''}` : 'Anonymous'),
        image: "https://images.unsplash.com/photo-1518823380156-2dd66e1745e3?auto=format&fit=crop&w=500&q=80",
        createdAt: new Date().toISOString()
      };

      const submitBtn = this.querySelector('button[type="submit"]');
      const prev = submitBtn?.innerHTML;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = spinnerHTML(14) + ' Submitting...'; }

      try {
        const res = await fetchWithCreds(`${API_BASE}/api/ideas`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ideaPayload)
        });
        if (res.ok) {
          showNotification('Your idea has been submitted successfully!', 'success');
          loadIdeas();
          this.reset();
          const modal = document.getElementById('ideaModal'); if (modal) modal.style.display = 'none';
        } else {
          const localIdeas = loadIdeasLocal();
          localIdeas.unshift(ideaPayload);
          saveIdeasLocal(localIdeas);
          showNotification('Your idea was saved locally (demo mode).', 'success');
          loadIdeas();
          this.reset();
          const modal = document.getElementById('ideaModal'); if (modal) modal.style.display = 'none';
        }
      } catch (err) {
        console.error(err);
        const localIdeas = loadIdeasLocal();
        localIdeas.unshift(ideaPayload);
        saveIdeasLocal(localIdeas);
        showNotification('Network error — saved idea locally.', 'success');
        loadIdeas();
        this.reset();
        const modal = document.getElementById('ideaModal'); if (modal) modal.style.display = 'none';
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = prev; }
      }
    });
  }

  // REGISTRATION FORM
  const regForm = document.getElementById('registrationForm');
  if (regForm) {
    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const auth = loadCurrentAuth();
      if (!auth) { toast('Please log in to register', 'error'); openModal('ic-login-modal'); return; }

      const fd = new FormData(this);
      const userProfile = {
        firstName: fd.get('firstName'),
        lastName: fd.get('lastName'),
        email: fd.get('email'),
        password: fd.get('password'),
        educationLevel: fd.get('educationLevel'),
        interests: fd.getAll('interests'),
        about: fd.get('about'),
        joined: new Date().toISOString()
      };

      try {
        const res = await fetchWithCreds(`${API_BASE}/api/profile`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userProfile)
        });
        if (res.ok) {
          showNotification('Registration successful! Welcome to Ignite Code.', 'success');
          this.reset();
          loadUsers();
        } else {
          const users = loadUsersLocal();
          users.push(userProfile);
          saveUsersLocal(users);
          showNotification('Registration saved locally (demo).', 'success');
          this.reset();
          loadUsers();
        }
      } catch (err) {
        console.error(err);
        const users = loadUsersLocal();
        users.push(userProfile);
        saveUsersLocal(users);
        showNotification('Network error — registration saved locally.', 'success');
        this.reset();
        loadUsers();
      }
    });
  }
}

/* ---------- Ideas loading & rendering ---------- */
async function loadIdeas() {
  const container = document.getElementById('ideasContainer');
  if (container) container.innerHTML = `<div class="placeholder">Loading ideas…</div>`;
  try {
    const res = await fetch(`${API_BASE}/api/ideas`);
    if (res.ok) {
      const ideas = await res.json();
      ideas.forEach(i => { if (typeof i.tags === 'string') i.tags = i.tags ? i.tags.split(',').map(t => t.trim()) : []; });
      renderIdeas(ideas);
      return;
    }
  } catch (err) { }

  if (typeof DB !== 'undefined' && DB.getIdeas) {
    renderIdeas(DB.getIdeas());
    return;
  }
  const local = loadIdeasLocal();
  if (local && local.length) {
    renderIdeas(local);
    return;
  }
  const fallback = [{
    title: 'Campus Compost Bot',
    description: 'A simple bot to collect organic waste on campuses and turn it into compost.',
    tags: ['Sustainability', 'EdTech'],
    image: 'https://images.unsplash.com/photo-1505575967454-47f8b1f7e74e?auto=format&fit=crop&w=800&q=60'
  }];
  renderIdeas(fallback);
}

function renderIdeas(ideas = []) {
  const c = document.getElementById('ideasContainer');
  if (!c) return;
  c.innerHTML = '';
  if (!ideas.length) {
    c.innerHTML = `<div class="placeholder">No ideas yet — be the first to submit one!</div>`;
    return;
  }
  ideas.forEach(idea => {
    const card = document.createElement('div');
    card.className = 'idea-card';
    card.innerHTML = `
      <div class="idea-image"><img src="${escapeHtml(idea.image || '')}" alt="${escapeHtml(idea.title)}"></div>
      <div class="idea-content">
        <h3>${escapeHtml(idea.title)}</h3>
        <p>${escapeHtml(idea.description)}</p>
        <div class="idea-tags">${Array.isArray(idea.tags) ? idea.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') : ''}</div>
        <div style="margin-top:12px"><button class="secondary-button" aria-label="View details for ${escapeHtml(idea.title)}">View Details</button></div>
      </div>
    `;
    c.appendChild(card);
  });
}

/* ---------- Hero / navigation wiring ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".mobile-menu-btn");
  const navLinks = document.querySelector(".nav-links");
  const icon = menuBtn.querySelector("i");

  navLinks.style.transform = "translateX(-100%)";
  navLinks.style.transition = "transform 0.4s ease-in-out";

  menuBtn.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");

    if (isOpen) {
      navLinks.style.transform = "translateX(0)";
      menuBtn.setAttribute("aria-expanded", "true");
      icon.classList.replace("fa-bars", "fa-times");
    } else {
      navLinks.style.transform = "translateX(-100%)";
      menuBtn.setAttribute("aria-expanded", "false");
      icon.classList.replace("fa-times", "fa-bars");
    }
  });

  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      navLinks.style.transform = "translateX(-100%)";
      menuBtn.setAttribute("aria-expanded", "false");
      icon.classList.replace("fa-times", "fa-bars");
    });
  });
});

/* ---------- Hook up hero / CTA buttons ---------- */
function wireCTAs() {
  const gsBtn = document.getElementById('getStartedBtn');
  if (gsBtn) {
    if (!document.getElementById('videoModal')) {
      gsBtn.addEventListener('click', () => {
        document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  const openIdeaBtns = document.querySelectorAll('.cta-button:not(#getStartedBtn)');
  openIdeaBtns.forEach(btn => btn.addEventListener('click', (e) => {
    const auth = loadCurrentAuth();
    if (!auth) { openModal('ic-login-modal'); toast('Log in to submit ideas', 'info'); return; }
    if (!auth.verified) { toast('Please verify your email to submit ideas', 'error', 5000); return; }
    const modal = document.getElementById('ideaModal');
    if (modal) { modal.style.display = 'grid'; modal.setAttribute('aria-hidden', 'false'); modal.querySelector('input,textarea,select')?.focus(); }
  }));

  document.querySelectorAll('.close-modal').forEach(el => el.addEventListener('click', () => {
    const m = el.closest('.modal'); if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
  }));
}

/* ---------- Video modal wiring ---------- */
function setupVideoModal() {
  const openBtn = document.getElementById('getStartedBtn');
  const modal = document.getElementById('videoModal');
  const closeBtn = document.getElementById('closeVideo');
  const ytFrame = document.getElementById('ytVideo');

  if (!openBtn || !modal || !closeBtn || !ytFrame) {
    console.warn('Video modal: required elements missing.');
    return;
  }

  function openModalVid() {
    const videoId = ytFrame.dataset.videoId || 'dQw4w9WgXcQ';
    ytFrame.src = `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1&autoplay=1&mute=1`;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModalVid() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    ytFrame.src = '';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    openBtn.focus();
  }

  openBtn.addEventListener('click', (e) => { e.preventDefault(); openModalVid(); });
  closeBtn.addEventListener('click', closeModalVid);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModalVid(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModalVid(); });
}

/* ---------- Load everything ---------- */
document.addEventListener('DOMContentLoaded', function () {
  injectAuthUI();
  wireAuthModals();

  checkAuth().then(() => setupIdeaProtection());

  wireCTAs();
  setupVideoModal();

  const ideaModal = document.getElementById('ideaModal');
  if (ideaModal) ideaModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') ideaModal.style.display = 'none'; });

  loadIdeas();
  loadUsers();

  document.addEventListener('click', (e) => {
    if (e.target.matches('.ic-modal-backdrop')) {
      const modal = e.target.closest('.ic-modal');
      if (modal) modal.style.display = 'none';
    }
  });

  trapFocus(document.getElementById('ideaModal') || null);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') openModal('ic-login-modal');
  });
});

/* ---------- Hero typewriter ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("hero-title");
  if (!el) return;

  const base = "Build ";
  const phrases = [
    "bold startup ideas",
    "real products with peers",
    "your network & career"
  ];

  let idx = 0;
  let charPos = 0;
  let isDeleting = false;

  function typeLoop() {
    const current = phrases[idx];
    const visible = current.substring(0, charPos);

    el.textContent = base + visible;

    if (!isDeleting && charPos < current.length) {
      charPos++;
      setTimeout(typeLoop, 120);
    } else if (isDeleting && charPos > 0) {
      charPos--;
      setTimeout(typeLoop, 60);
    } else {
      if (!isDeleting) {
        isDeleting = true;
        setTimeout(typeLoop, 1500);
      } else {
        isDeleting = false;
        idx = (idx + 1) % phrases.length;
        setTimeout(typeLoop, 500);
      }
    }
  }

  typeLoop();
});

(function (d) {
  var s = d.createElement("script");
  s.setAttribute("data-position", "3");

  s.setAttribute("data-widget_layout", "full");
  s.setAttribute("data-account", "LioieMYIKq");
  s.setAttribute("src", "https://cdn.userway.org/widget.js");
  (d.body || d.head).appendChild(s);
})(document)

function showNotification(message, type) {
  alert(`${type.toUpperCase()}: ${message}`);
}

function loadUsersLocal() {
  return JSON.parse(localStorage.getItem('users')) || [];
}

function saveUsersLocal(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function loadCurrentAuth() {
  const email = sessionStorage.getItem('authEmail');
  if (!email) return null;
  const users = loadUsersLocal();
  return users.find(user => user.email === email && user.verified);
}

// OTP Generation and Verification
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000);
}

function sendOtp(email) {
  const otp = generateOtp();
  localStorage.setItem(`otp_${email}`, otp);
  console.log(`OTP for ${email}: ${otp}`); // Simulate sending OTP
  alert(`OTP sent to ${email} (for demo purposes: ${otp})`);
}

// Event Listeners
document.getElementById('getStartedBtn').addEventListener('click', () => {
  const email = prompt('Enter your email to get started:');
  if (!email) return;
  const users = loadUsersLocal();
  const user = users.find(u => u.email === email);
  if (user && user.verified) {
    alert('You are already verified!');
    return;
  }
  if (user) {
    alert('Please verify your email to proceed.');
    return;
  }
  const newUser = { email, verified: false };
  users.push(newUser);
  saveUsersLocal(users);
  sendOtp(email);
  openOtpModal(email);
});

function openOtpModal(email) {
  const modal = document.getElementById('otpModal');
  modal.style.display = 'flex';
  document.getElementById('verifyOtpBtn').dataset.email = email;
}

document.getElementById('verifyOtpBtn').addEventListener('click', () => {
  const email = document.getElementById('verifyOtpBtn').dataset.email;
  const enteredOtp = document.getElementById('otpInput').value.trim();
  const storedOtp = localStorage.getItem(`otp_${email}`);
  if (enteredOtp === storedOtp) {
    alert('Email verified successfully!');
    const users = loadUsersLocal();
    const user = users.find(u => u.email === email);
    if (user) {
      user.verified = true;
      saveUsersLocal(users);
      sessionStorage.setItem('authEmail', email);
    }
    document.getElementById('otpModal').style.display = 'none';
  } else {
    alert('Invalid OTP. Please try again.');
  }
});

document.getElementById('resendOtpBtn').addEventListener('click', () => {
  const email = document.getElementById('verifyOtpBtn').dataset.email;
  sendOtp(email);
});