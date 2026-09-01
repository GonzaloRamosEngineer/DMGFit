// Edge Function: reset-athlete-password
// Restablece la contraseña de un atleta a su DNI (el mismo esquema con el que nace
// la cuenta: usuario y clave = DNI). Pensada para cuando el atleta cambió su clave
// desde el portal y la olvidó: el "olvidé mi contraseña" por email no le sirve,
// porque su identidad de login es interna (`{DNI}@vcfit.internal`) y no recibe correo.
//
// Solo ADMIN puede invocarla. Requiere service_role (inyectada por Supabase).
//
// Deploy:  supabase functions deploy reset-athlete-password
// Invocar (frontend): supabase.functions.invoke('reset-athlete-password', { body: { athlete_id } })

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
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Autorización: solo admin (restablecer una clave ajena no es tarea de profesor)
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "No autenticado" }, 401);
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    const callerId = userData?.user?.id;
    if (uErr || !callerId) return json({ error: "Sesión inválida" }, 401);
    const { data: caller } = await admin.from("profiles").select("role").eq("id", callerId).maybeSingle();
    if (!caller || String(caller.role) !== "admin") {
      return json({ error: "Solo el admin puede restablecer contraseñas" }, 403);
    }

    // 2) Datos del atleta
    const { athlete_id } = await req.json();
    if (!athlete_id) return json({ error: "Falta athlete_id" }, 400);
    const { data: ath } = await admin
      .from("athletes")
      .select("id, dni, profile_id, profiles:profile_id ( full_name )")
      .eq("id", athlete_id)
      .maybeSingle();
    if (!ath) return json({ error: "Atleta no encontrado" }, 404);

    const dni = String(ath.dni || "").replace(/\D/g, "");
    if (!dni) return json({ error: "El atleta no tiene un DNI válido para usar como clave" }, 400);

    // 3) Tiene que existir el usuario de auth (si no, lo que corresponde es habilitar
    //    el acceso, no restablecer la clave)
    const { data: authUser } = await admin.auth.admin
      .getUserById(ath.profile_id)
      .catch(() => ({ data: null }));
    if (!authUser?.user) {
      return json(
        { error: "Este atleta todavía no tiene acceso al portal. Habilitá el acceso primero." },
        409,
      );
    }

    // 4) Restablecer la clave al DNI
    const { error: updErr } = await admin.auth.admin.updateUserById(authUser.user.id, {
      password: dni,
    });
    if (updErr) throw updErr;

    // 5) Con qué usuario entra: el DNI (identidad interna) o su email real
    const email = String(authUser.user.email || "").toLowerCase();
    const usesDni = INTERNAL_DOMAINS.some((d) => email.endsWith(d));

    return json({
      ok: true,
      dni,
      uses_dni: usesDni,
      login_hint: usesDni ? dni : email,
      message: usesDni
        ? "Contraseña restablecida (usuario y clave = DNI)."
        : `Contraseña restablecida al DNI. Esta cuenta ingresa con ${email}.`,
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
