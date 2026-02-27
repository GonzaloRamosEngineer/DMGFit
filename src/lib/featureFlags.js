const parseBooleanFlag = (value, fallback = true) => {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() !== 'false';
};

export const featureFlags = {
  kioskRpcEnabled: parseBooleanFlag(import.meta.env.VITE_KIOSK_RPC_ENABLED, true)
};
