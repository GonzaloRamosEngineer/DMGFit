import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Icon from "./AppIcon";
import Modal from "./ui/Modal";

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
      /**
       * ÚNICO PUNTO DE SIGNUP:
       * Al ejecutar signUp, el Trigger 'handle_new_user' de la base de datos:
       * 1. Detecta que ya existe un perfil con este email (el fantasma).
       * 2. Migra las relaciones de 'coaches' o 'athletes' al nuevo ID de Auth.
       * 3. Borra el perfil fantasma anterior.
       * 4. Inserta el nuevo perfil real.
       */
      const { error: signUpError } = await supabase.auth.signUp({
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

      // 2. PAUSA DE SEGURIDAD: 
      // Esperamos 800ms para asegurar que el Trigger de la DB terminó su ciclo de 
      // borrado y re-vinculación antes de cerrar el modal y refrescar la lista.
      await new Promise(resolve => setTimeout(resolve, 800));

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("EnableAccount Error:", error);
      setErrorMessage(error?.message || "Ocurrió un error al habilitar la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!target) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Habilitar cuenta"
      subtitle={<>Activá el acceso de <strong>{target?.name}</strong> ({roleLabel}).</>}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" form="enable-account-form" variant="default" loading={isSubmitting} iconName="UserCheck">Habilitar ahora</Button>
        </div>
      }
    >
      <form id="enable-account-form" onSubmit={handleSubmit} className="space-y-5">
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
      </form>
    </Modal>
  );
};

export default EnableAccountModal;