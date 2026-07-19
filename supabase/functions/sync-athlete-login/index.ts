// Edge Function: sync-athlete-login
// Sincroniza el login interno de un atleta cuando el admin le cambia el DNI:
// re-apunta el email de auth a {DNI nuevo}@vcfit.internal y, si la clave seguía
// siendo el DNI anterior, la resetea al DNI nuevo (no pisa claves personalizadas).
// No toca cuentas con email real (el DNI no es su identidad de login). Idempotente.
// Solo admin puede invocarla. Requiere service_role (inyectada por Supabase).
//
// Deploy:  supabase functions deploy sync-athlete-login
// Invocar (frontend): supabase.functions.invoke('sync-athlete-login', { body: { athlete_id } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INTERNAL_DOMAINS = ["@vcfit.internal", "@dmg.internal"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Autorización: el que invoca debe ser admin (la edición de datos es admin-only)
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "No autenticado" }, 401);
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    const callerId = userData?.user?.id;
    if (uErr || !callerId) return json({ error: "Sesión inválida" }, 401);
    const { data: caller } = await admin.from("profiles").select("role").eq("id", callerId).maybeSingle();
    if (!caller || String(caller.role) !== "admin") {
      return json({ error: "Solo el admin puede sincronizar logins" }, 403);
    }

    // 2) Datos del atleta
    const { athlete_id } = await req.json();
    if (!athlete_id) return json({ error: "Falta athlete_id" }, 400);
    const { data: ath } = await admin
      .from("athletes")
      .select("id, dni, profile_id")
      .eq("id", athlete_id)
      .maybeSingle();
    if (!ath?.dni) return json({ error: "Atleta o DNI no encontrado" }, 404);

    const dni = String(ath.dni).replace(/\D/g, "");
    if (!dni) return json({ error: "El atleta no tiene DNI válido" }, 400);
    const targetEmail = `${dni}@vcfit.internal`;

    // 3) ¿Tiene login? Si su perfil no es un usuario de auth, no hay nada que sincronizar.
    const { data: authUser } = await admin.auth.admin.getUserById(ath.profile_id).catch(() => ({ data: null }));
    if (!authUser?.user) {
      return json({ ok: true, synced: false, reason: "Sin login activado." });
    }

    const currentEmail = String(authUser.user.email || "").toLowerCase();

    // 4) Cuentas con email real: el DNI no es su identidad de login → no se tocan.
    if (!INTERNAL_DOMAINS.some((d) => currentEmail.endsWith(d))) {
      return json({ ok: true, synced: false, reason: "Login con email real; no depende del DNI." });
    }

    // 5) ¿Ya está alineado?
    if (currentEmail === targetEmail) {
      return json({ ok: true, synced: false, already: true, reason: "El login ya usa este DNI." });
    }

    // 6) ¿La clave seguía siendo el DNI anterior? (esquema "usuario y clave = DNI")
    //    Se verifica con un sign-in efímero; si entra, es seguro resetearla al DNI nuevo.
    const oldDni = currentEmail.split("@")[0];
    let passwordWasDni = false;
    if (oldDni) {
      const probe = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: probeErr } = await probe.auth.signInWithPassword({
        email: currentEmail,
        password: oldDni,
      });
      passwordWasDni = !probeErr;
    }

    // 7) Sincronizar email (y clave solo si era el DNI viejo)
    const { error: updErr } = await admin.auth.admin.updateUserById(authUser.user.id, {
      email: targetEmail,
      email_confirm: true,
      ...(passwordWasDni ? { password: dni } : {}),
    });
    if (updErr) throw updErr;

    return json({
      ok: true,
      synced: true,
      dni,
      passwordReset: passwordWasDni,
      message: passwordWasDni
        ? "Login sincronizado: usuario y clave = DNI nuevo."
        : "Login sincronizado al DNI nuevo. La clave personalizada no se modificó.",
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
