export const CAN_USE_DEV_AUTH = Boolean(
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_TOKEN
  && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname),
);
