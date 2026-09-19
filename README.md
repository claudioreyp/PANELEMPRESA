# Escalar AI - Admins

Panel React + TypeScript reservado al equipo superadmin de Escalar AI. Administra tenants sin persistir contraseñas ni exponer credenciales de pago o tokens de integración.

## Funciones

- Métricas globales y actividad reciente.
- Alta guiada y transaccional de negocio, sucursal principal, propietario y credencial de integracion.
- Sucursales y POS completo, sin asignacion de planes comerciales.
- Creación directa del usuario propietario en Supabase Auth y entrega única de su contraseña.
- Invitaciones de empleados adicionales mediante Supabase Auth.
- Membresías, roles, activación y auditoría administrativa.
- Vista operativa agregada sin mostrar secretos del restaurante.
- Paquete de conexión mostrado una sola vez con token, IDs y todas las APIs del agente listas para copiar.

El backend valida el rol `superadmin`; ocultar una ruta en React no se considera seguridad.

Guia generica y requisitos de activacion: [Acceso e integracion API](../Apis/docs/access-integration.md).
Resultados y limites de la revision local: [Verificacion segura](../CLIENTES/docs/safe-optimization-verification.md).

Al crear un restaurante, Admins genera o acepta una contraseña segura y crea inmediatamente el usuario propietario en Supabase Auth. La pantalla final permite copiar **URL, Usuario y contraseña** para entregárselos al restaurante. La contraseña solo permanece en memoria durante esa alta: no se envía de vuelta desde la API, no se guarda en `localStorage` y no se persiste en la base del POS. El token privado tambien aparece una sola vez. Si se pierde, el superadministrador debe revisar el estado del alta antes de decidir una rotacion; nunca se rota automaticamente. Las rutas y los permisos pueden consultarse despues desde Ver APIs, sin recuperar el secreto.

## Desarrollo

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --port 5174
```

Configure `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_CLIENT_POS_URL`. Esta última es la URL de CLIENTES que se entrega al restaurante. `VITE_DEV_AUTH_TOKEN` existe únicamente para desarrollo y debe omitirse en Vercel.

## Verificación y despliegue

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
```

Vercel sirve la SPA mediante `vercel.json`. El primer usuario superadmin se crea en Supabase Auth y se vincula desde el script `scripts/bootstrap_superadmin.py` del repositorio de la API.
