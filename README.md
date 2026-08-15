# Panel Empresa Impulsa

Panel React + TypeScript reservado al equipo superadmin de Impulsa. Administra tenants sin exponer contraseñas, credenciales de pago ni tokens de integración.

## Funciones

- Métricas globales y actividad reciente.
- Alta, edición y suspensión segura de negocios.
- Sucursales, planes y módulos habilitados.
- Invitaciones de propietarios y empleados mediante Supabase Auth.
- Membresías, roles, activación y auditoría administrativa.
- Vista operativa agregada sin mostrar secretos del restaurante.

El backend valida el rol `superadmin`; ocultar una ruta en React no se considera seguridad.

## Desarrollo

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --port 5174
```

Configure `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `VITE_DEV_AUTH_TOKEN` existe únicamente para desarrollo y debe omitirse en Vercel.

## Verificación y despliegue

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
```

Vercel sirve la SPA mediante `vercel.json`. El primer usuario superadmin se crea en Supabase Auth y se vincula desde el script `scripts/bootstrap_superadmin.py` del repositorio de la API.
