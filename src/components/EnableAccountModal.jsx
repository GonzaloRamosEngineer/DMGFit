import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Icon from "./AppIcon";

const INTERNAL_DOMAINS = ["@dmg.internal", "@vcfit.internal"];

const EnableAccountModal = ({ isOpen, onClose, onSuccess, target }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const roleLabel = useMemo(() => {
    if (!target?.role) return "usuario";
    return target.role === "profesor" ? "profesor" : "atleta";
  }, [target?.role]);

  useEffect(() => {
    if (!isOpen) return;
    const hasRealEmail = target?.email && !INTERNAL_DOMAINS.some((domain) => target.email.endsWith(domain));
    setEmail(hasRealEmail ? target.email : "");
    setPassword("");
    setErrorMessage("");
  }, [isOpen, target]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!target?.profileId) {
      setErrorMessage("Error: No se encontró el ID del perfil original.");
      return;
    }
    
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      // 1. Crear el usuario en Auth (Supabase disparará la creación automática de un perfil)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: target?.name || "",
            role: target?.role || "atleta",
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          throw new Error("Este correo ya tiene una cuenta activa.");
        }
        throw signUpError;
      }

      const newAuthId = authData?.user?.id;
      if (!newAuthId) throw new Error("No se pudo obtener el ID de autenticación.");

      /**
       * 2. SOLUCIÓN AL CONFLICTO DE DUPLICADOS (Paso Crítico)
       * Buscamos si Supabase ya creó un perfil automático con el nuevo ID.
       */
      const { data: autoProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", newAuthId)
        .maybeSingle();

      const table = target.role === "profesor" ? "coaches" : "athletes";

      if (autoProfile) {
        /**
         * CASO A: El perfil real ya existe (creado por el Trigger de Supabase).
         * 1. Forzamos el ROL correcto (evita que entre como atleta).
         * 2. Re-vinculamos la ficha técnica (coach/atleta) del ID viejo al nuevo.
         * 3. Borramos el perfil "fantasma" (@dmg.internal).
         */
        await supabase.from("profiles")
          .update({ 
            role: target.role, 
            email: email.trim(),
            full_name: target.name 
          })
          .eq("id", newAuthId);

        const { error: moveError } = await supabase
          .from(table)
          .update({ profile_id: newAuthId })
          .eq("profile_id", target.profileId);

        if (moveError) throw moveError;

        // ELIMINACIÓN DEL FANTASMA: Limpiamos la tabla de perfiles
        await supabase.from("profiles").delete().eq("id", target.profileId);
        
      } else {
        /**
         * CASO B: No se creó perfil automático. 
         * Actualizamos el perfil fantasma transformándolo en el real.
         */
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            id: newAuthId,
            email: email.trim(),
            role: target.role
          })
          .eq("id", target.profileId);

        if (updateError) throw updateError;
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("EnableAccount Error:", error);
      setErrorMessage(error?.message || "Ocurrió un error al habilitar la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !target) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Habilitar cuenta</h2>
            <p className="text-sm text-muted-foreground">
              Activá el acceso de <strong>{target?.name}</strong> ({roleLabel}).
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <Input
            label="Email real"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Contraseña temporal"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />

          {errorMessage && (
            <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg p-3 flex items-center gap-2 font-medium">
              <Icon name="AlertCircle" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex gap-3 italic text-primary">
            <Icon name="Mail" size={20} className="shrink-0" />
            <p className="text-xs">
              Se enviará un correo de confirmación para que el usuario active su acceso.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" variant="default" loading={isSubmitting} iconName="UserCheck">Habilitar ahora</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnableAccountModal;