import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Icon from "./AppIcon";

const INTERNAL_DOMAIN = "@dmg.internal";

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
    // Si el email que viene del target es real (no interno), lo precargamos
    const hasRealEmail = target?.email && !target.email.endsWith(INTERNAL_DOMAIN);
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
      // 1. Crear el usuario en Supabase Auth
      // Esto genera un nuevo UUID en auth.users y dispara el email de confirmación
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: target?.name || "",
            role: target?.role || "atleta",
            origin: "admin_enable" // Metadato útil para auditoría
          },
        },
      });

      if (signUpError) throw signUpError;
      
      // Verificación de seguridad: Supabase a veces devuelve éxito pero el usuario ya existe
      if (!authData?.user?.id) {
        throw new Error("La cuenta ya podría estar registrada o el servicio no respondió.");
      }

      const newAuthId = authData.user.id;

      // 2. ACTUALIZACIÓN CRÍTICA: Sincronización de IDs
      // Actualizamos la tabla 'profiles' cambiando el ID temporal por el de Auth.
      // El 'ON UPDATE CASCADE' en la DB actualizará 'athletes' o 'coaches' automáticamente.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          id: newAuthId,           // Sincronizamos con el ID de Auth
          email: email.trim()      // Guardamos el email real definitivo
        })
        .eq("id", target.profileId); // Usamos el ID temporal que traía el perfil

      if (updateError) {
        // En este punto el usuario Auth ya se creó. El error aquí es de DB.
        console.error("Error crítico de vinculación:", updateError);
        throw new Error("El acceso se creó, pero no se pudo vincular con los datos deportivos. Contacta a soporte.");
      }

      // Éxito total
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
            <h2 className="text-xl font-heading font-bold text-foreground">
              Habilitar cuenta
            </h2>
            <p className="text-sm text-muted-foreground">
              Activá el acceso de <strong>{target?.name}</strong> ({roleLabel}).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <Input
              label="Email real del usuario"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ejemplo@correo.com"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Este será el email definitivo para iniciar sesión.
            </p>
          </div>

          <div>
            <Input
              label="Contraseña temporal"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Comunícale esta contraseña al usuario para su primer ingreso.
            </p>
          </div>

          {errorMessage && (
            <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg p-3 flex items-center gap-2">
              <Icon name="AlertCircle" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex gap-3">
            <Icon name="Mail" size={20} className="text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              Al confirmar, el sistema creará la credencial de acceso y enviará un correo de verificación al usuario.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="default" loading={isSubmitting} iconName="UserCheck">
              Habilitar ahora
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnableAccountModal;