// Edge Function: activate-athlete
// Crea el login por DNI de un atleta (email interno {DNI}@vcfit.internal, clave = DNI),
// re-apunta el perfil al nuevo usuario de auth y borra el fantasma. Idempotente.
// Solo staff (admin/profesor) puede invocarla. Requiere service_role (inyectada por Supabase).
//
// Deploy:  supabase functions deploy activate-athlete
// Invocar (frontend): supabase.functions.invoke('activate-athlete', { body: { athlete_id } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Autorización: el que invoca debe ser staff (admin/profesor)
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "No autenticado" }, 401);
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    const callerId = userData?.user?.id;
    if (uErr || !callerId) return json({ error: "Sesión inválida" }, 401);
    const { data: caller } = await admin.from("profiles").select("role").eq("id", callerId).maybeSingle();
    if (!caller || !["admin", "profesor"].includes(String(caller.role))) {
      return json({ error: "Solo el staff puede activar accesos" }, 403);
    }

    // 2) Datos del atleta
    const { athlete_id } = await req.json();
    if (!athlete_id) return json({ error: "Falta athlete_id" }, 400);
    const { data: ath } = await admin
      .from("athletes")
      .select("id, dni, profile_id, profiles:profile_id ( full_name, email )")
      .eq("id", athlete_id)
      .maybeSingle();
    if (!ath?.dni) return json({ error: "Atleta o DNI no encontrado" }, 404);

    const dni = String(ath.dni).replace(/\D/g, "");
    const internalEmail = `${dni}@vcfit.internal`;
    const fullName = ath.profiles?.full_name || "Atleta";
    const realEmail = ath.profiles?.email || null;

    // 3) ¿Ya tiene login? (su perfil ya es un usuario de auth)
    const { data: alreadyUser } = await admin.auth.admin.getUserById(ath.profile_id).catch(() => ({ data: null }));
    if (alreadyUser?.user) {
      return json({ ok: true, already: true, dni, message: "Ya tenía login." });
    }

    // 4) Crear (o encontrar) el usuario de auth con email interno
    let authUid: string;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: internalEmail, password: dni, email_confirm: true,
      user_metadata: { full_name: fullName, role: "atleta" },
    });
    if (cErr) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const u = (list?.users || []).find((x: { email?: string }) => x.email === internalEmail);
      if (!u) throw cErr;
      authUid = u.id;
    } else {
      authUid = created.user.id;
      await new Promise((r) => setTimeout(r, 400)); // trigger handle_new_user
    }

    // 5) Re-apuntar el atleta al nuevo perfil y borrar el fantasma
    if (ath.profile_id !== authUid) {
      await admin.from("athletes").update({ profile_id: authUid }).eq("id", ath.id);
      await admin.from("profiles").delete().eq("id", ath.profile_id);
    }
    // 6) Completar el perfil nuevo (nombre + dni + email real de contacto si hay)
    const patch: Record<string, string> = { full_name: fullName, dni };
    if (realEmail && !realEmail.includes("@vcfit.internal")) patch.email = realEmail;
    await admin.from("profiles").update(patch).eq("id", authUid);

    return json({ ok: true, dni, message: "Login activado (usuario y clave = DNI)." });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
