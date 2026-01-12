import tcb from 'tcb-js-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize TCB
// Note: We use the environment ID provided by the user.
// In a real production app, you might want to fetch this from config,
// but for this implementation we hardcode it as requested.
const ENV_ID = 'cloudbase-9g9g0ob127d1dc25';

let app: any = null;
let auth: any = null;
let db: any = null;

export const initTCB = async () => {
  if (app) return;

  try {
    app = tcb.init({
      env: ENV_ID
    });

    auth = app.auth();
    
    // Anonymous login
    if (!auth.hasLoginState()) {
      await auth.signInAnonymously();
    }

    db = app.database();
    console.log('TCB initialized');
  } catch (e) {
    console.error('TCB init failed', e);
  }
};

export const getDB = () => {
    if (!db && app) db = app.database();
    return db;
}

export const recordInstall = async () => {
  try {
    const installId = localStorage.getItem('quick_install_id');
    if (installId) return; // Already recorded

    const newId = uuidv4();
    localStorage.setItem('quick_install_id', newId);

    if (!db) await initTCB();
    if (!db) return;

    await db.collection('quick_users').add({
      uuid: newId,
      install_time: new Date(),
      platform: navigator.platform,
      user_agent: navigator.userAgent
    });
  } catch (e) {
    console.error('Record install failed', e);
  }
};

export const recordDailyActive = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('quick_last_active_date');

    if (lastActive === today) return; // Already recorded today

    const installId = localStorage.getItem('quick_install_id') || 'unknown';
    
    if (!db) await initTCB();
    if (!db) return;

    await db.collection('quick_daily_active').add({
      uuid: installId,
      date: today,
      timestamp: new Date()
    });

    localStorage.setItem('quick_last_active_date', today);
  } catch (e) {
    console.error('Record daily active failed', e);
  }
};

export const recordFileStats = async (type: 'upload' | 'download', count: number, size: number) => {
    try {
        if (!db) await initTCB();
        if (!db) return;

        await db.collection('quick_file_stats').add({
            type,
            count,
            size,
            timestamp: new Date()
        });
    } catch (e) {
        console.error('Record file stats failed', e);
    }
}
