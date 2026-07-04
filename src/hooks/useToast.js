import { useToastContext } from '../components/ui/Toast/ToastProvider';

/**
 * Hook de notificaciones branded. Reemplaza window.alert().
 *   const { toast } = useToast();
 *   toast.success('Pago registrado');
 *   toast.error('Error: ' + err.message);
 *   toast({ title, description, variant, duration });
 */
export function useToast() {
  const { toast, dismiss } = useToastContext();
  return { toast, dismiss };
}

export default useToast;
