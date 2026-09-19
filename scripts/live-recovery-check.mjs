// Opt-in live Auth verification. Credentials are stdin/memory only; no traces.
import { chromium, expect } from '@playwright/test';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const data = JSON.parse(input); input = '';
const browser = await chromium.launch();
let stage = 'startup';
const api = 'http://127.0.0.1:8012/api/v1';
try {
  const admin = await browser.newPage();
  const pos = await browser.newPage();
  stage = 'admin-login';
  await admin.goto('http://127.0.0.1:5177/login');
  await admin.getByLabel('Correo', {exact: true}).fill(data.adminEmail);
  await admin.getByLabel('Contraseña', {exact: true}).fill(data.adminPassword);
  await admin.getByRole('button', {name: 'Ingresar', exact: true}).click();
  await admin.waitForURL(url => !url.pathname.includes('login'));
  stage = 'owner-initial-login';
  await pos.goto('http://127.0.0.1:5178/login');
  await pos.getByLabel('Usuario', {exact: true}).fill(data.ownerEmail);
  await pos.getByLabel('Contraseña', {exact: true}).fill(data.ownerPassword);
  const originalContext = pos.waitForResponse(r => r.url().endsWith('/context') && r.status() === 200);
  await pos.getByRole('button', {name: 'Entrar', exact: true}).click();
  const oldResponse = await originalContext;
  const oldToken = (await oldResponse.request().allHeaders()).authorization;
  const ownerHeaders = {Authorization: oldToken, 'Idempotency-Key': crypto.randomUUID()};
  const denied = await pos.request.post(api + '/admin/businesses/11/memberships/11/password-reset', {headers: ownerHeaders, data: {password: 'Isolated-access-check-482!', expected_version: 0}});
  expect(denied.status()).toBe(403);
  stage = 'renew-from-admins';
  await admin.goto('http://127.0.0.1:5177/negocios/11');
  await admin.getByRole('button', {name: 'Renovar contraseña', exact: true}).click();
  await admin.getByRole('button', {name: 'Generar contraseña', exact: true}).click();
  let next = await admin.getByLabel(/Nueva contraseña/).inputValue();
  const changed = admin.waitForResponse(r => r.url().endsWith('/password-reset') && r.request().method() === 'POST');
  await admin.getByRole('button', {name: 'Renovar contraseña y cerrar sesiones'}).click();
  const changeResponse = await changed;
  expect(changeResponse.status()).toBe(200);
  expect((await changeResponse.json()).status).toBe('succeeded');
  await expect(admin.getByText('Contraseña renovada', {exact: true})).toBeVisible();
  stage = 'idempotency';
  const resetRequest = changeResponse.request();
  const resetHeaders = await resetRequest.allHeaders();
  const resetBody = resetRequest.postDataJSON();
  const repeated = await admin.request.post(resetRequest.url(), {headers: resetHeaders, data: resetBody});
  expect((await repeated.json()).operation_id).toBe((await changeResponse.json()).operation_id);
  const conflicting = await admin.request.post(resetRequest.url(), {headers: resetHeaders, data: {...resetBody, password: 'Different-access-check-482!'}});
  expect(conflicting.status()).toBe(409);
  stage = 'old-session-rejected';
  const expired = await pos.request.get(api + '/context', {headers: {Authorization: oldToken}});
  expect(expired.status()).toBe(401);
  const wsCode = await pos.evaluate(async (token) => new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:8012/api/v1/ws/branches/11?access_token=' + encodeURIComponent(token));
    const timer = setTimeout(() => { socket.close(); reject(new Error('socket-timeout')); }, 15000);
    socket.onclose = event => { clearTimeout(timer); resolve(event.code); };
  }), oldToken.replace(/^Bearer /, ''));
  // A rejected upgrade surfaces as 1006 in browsers; no authenticated channel opens.
  expect([1006, 1008]).toContain(wsCode);
  await pos.goto('http://127.0.0.1:5178/pedidos');
  await expect(pos.getByRole('button', {name: 'Entrar', exact: true})).toBeVisible({timeout: 20000});
  stage = 'old-password-rejected';
  const oldLogin = await pos.request.post(data.authUrl + '/auth/v1/token?grant_type=password', {headers: {apikey: data.publicKey}, data: {email: data.ownerEmail, password: data.ownerPassword}});
  expect(oldLogin.status()).toBe(400);
  stage = 'new-password-clientes';
  await pos.getByLabel('Usuario', {exact: true}).fill(data.ownerEmail);
  await pos.getByLabel('Contraseña', {exact: true}).fill(next);
  const newContext = pos.waitForResponse(r => r.url().endsWith('/context') && r.status() === 200);
  await pos.getByRole('button', {name: 'Entrar', exact: true}).click();
  await newContext;
  await pos.goto('http://127.0.0.1:5178/pedidos');
  await expect(pos.getByRole('heading', {name: 'Pedidos', exact: true})).toBeVisible();
  next = ''; data.adminPassword = ''; data.ownerPassword = ''; resetBody.password = '';
  console.log(JSON.stringify({real_admin_ui_reset: true, real_clientes_login: true, previous_password_rejected: true, old_http_session_rejected: true, old_socket_rejected: true, permission_and_idempotency_verified: true, production_data_modified: false}));
} catch {
  console.log(JSON.stringify({live_check_failed_at: stage}));
  process.exitCode = 1;
} finally {
  await browser.close();
}
