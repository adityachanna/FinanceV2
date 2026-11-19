const PROFILE_KEY = 'alphasharp_demo_profile';
const SESSION_KEY = 'alphasharp_demo_session';

const encode = (buffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

const digest = async (value) => {
  if (!window.crypto?.subtle) throw new Error('Local profiles require HTTPS or localhost.');
  const data = new TextEncoder().encode(value);
  return encode(await window.crypto.subtle.digest('SHA-256', data));
};

export const authService = {
  async createDemoProfile(email, password, name = '') {
    if (!email || !password || password.length < 6) {
      throw new Error('Use a valid email and a password with at least 6 characters.');
    }
    const user = {
      id: `demo_${Date.now()}`,
      email: email.trim().toLowerCase(),
      name: name.trim() || email.split('@')[0],
      mode: 'local-demo',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ user, passwordVerifier: await digest(password) }));
    sessionStorage.setItem(SESSION_KEY, 'active');
    return user;
  },

  async loginDemo(email, password) {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) throw new Error('No local profile exists. Create one first.');
    const profile = JSON.parse(raw);
    const verifier = await digest(password);
    if (profile.user.email !== email.trim().toLowerCase() || profile.passwordVerifier !== verifier) {
      throw new Error('Email or password does not match this local profile.');
    }
    sessionStorage.setItem(SESSION_KEY, 'active');
    return profile.user;
  },

  hasProfile() {
    return Boolean(localStorage.getItem(PROFILE_KEY));
  },

  isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === 'active' && this.hasProfile();
  },

  getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}').user || null;
    } catch {
      return null;
    }
  },

  clearAllLocalData() {
    localStorage.clear();
    sessionStorage.clear();
  },
};

