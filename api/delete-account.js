import { createSupabaseAdminClient } from '../server/supabaseAdmin.js';

export function createDeleteAccountHandler({ createAdmin = createSupabaseAdminClient } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false });
    }
    const token = /^Bearer ([^\s]+)$/i.exec(req.headers?.authorization ?? '')?.[1];
    if (!token) return res.status(401).json({ ok: false });
    try {
      const admin = createAdmin();
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ ok: false });
      const result = await admin.auth.admin.deleteUser(data.user.id);
      if (result.error) return res.status(500).json({ ok: false });
      return res.status(200).json({ ok: true });
    } catch { return res.status(500).json({ ok: false }); }
  };
}

export default createDeleteAccountHandler();
