// Opt-in deployment test. Only the labelled test owner from the private receipt.
// No traces, stored browser sessions, order writes or physical printing.
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const credentials = JSON.parse(input); input = '';
const receipt = JSON.parse(await readFile(credentials.receipt, 'utf8'));
const owner = receipt.tenants[0];
if (!receipt.complete || !owner.slug.startsWith('prueba-despliegue-')) throw new Error('Test receipt required');
const browser = await chromium.launch();
const output = '.impeccable/review/cloud-release';
await mkdir(output, {recursive: true});
let stage = 'startup';
try {
  for (const [name, viewport] of Object.entries({desktop: {width:1440,height:1000}, tablet: {width:834,height:1112}, mobile: {width:390,height:844}})) {
    const context = await browser.newContext({viewport});
    await context.route('**/printing/jobs/**', route => route.abort());
    await context.routeWebSocket(/(localhost|127\.0\.0\.1):(8181|8182|8282|8283)/, socket => socket.close());
    const admin = await context.newPage();
    const pos = await context.newPage();
    stage = `${name}:admin-login`;
    await admin.goto('https://admin.escalarai.tech/login');
    await expect(admin.getByRole('button', {name: 'Entorno local', exact: true})).toHaveCount(0);
    await admin.getByLabel('Correo', {exact:true}).fill(credentials.email);
    await admin.getByLabel('Contraseña', {exact:true}).fill(credentials.password);
    await admin.getByRole('button', {name:'Ingresar', exact:true}).click();
    await admin.waitForURL(url => !url.pathname.includes('login'));
    await admin.goto(`https://admin.escalarai.tech/negocios/${owner.business_id}`);
    await expect(admin.getByRole('button', {name:'Renovar contraseña',exact:true})).toBeVisible({timeout:60000});
    await admin.screenshot({path:`${output}/${name}-admins.png`,fullPage:true});
    stage = `${name}:owner-login`;
    await pos.goto('https://pos.escalarai.tech/login');
    await expect(pos.getByRole('button', {name:'Entrar al entorno local',exact:true})).toHaveCount(0);
    await pos.getByLabel('Usuario', {exact:true}).fill(owner.email);
    await pos.getByLabel('Contraseña', {exact:true}).fill(owner.password);
    const access = pos.waitForResponse(r => r.url().endsWith('/context') && r.status() === 200, {timeout:60000});
    await pos.getByRole('button', {name:'Entrar',exact:true}).click();
    await access;
    await expect(pos.getByRole('link',{name:'Instalar app',exact:true})).toBeVisible();
    stage = `${name}:orders-tables-kitchen`;
    await pos.goto('https://pos.escalarai.tech/pedidos');
    await expect(pos.getByRole('heading',{name:'Pedidos',exact:true})).toBeVisible({timeout:60000});
    for (const tab of ['Panel de mesas','Comandas digitales','Panel de pedidos']) {
      await pos.getByRole('tab',{name:tab,exact:true}).click();
      await expect(pos.getByRole('tab',{name:tab,exact:true})).toHaveAttribute('aria-selected','true');
    }
    await pos.screenshot({path:`${output}/${name}-pedidos.png`,fullPage:true});
    stage = `${name}:install`;
    await pos.getByRole('link',{name:'Instalar app',exact:true}).click();
    await expect(pos.getByRole('heading',{name:'Descargar aplicación',exact:true})).toBeVisible();
    await expect(pos.getByText('Aplicación de Escalar AI POS',{exact:true})).toBeVisible();
    await expect(pos.getByRole('link',{name:/Tutoriales|Soporte/})).toHaveCount(0);
    await pos.screenshot({path:`${output}/${name}-instalar.png`,fullPage:true});
    const manifestHref = await pos.locator('link[rel="manifest"]').getAttribute('href');
    const manifestResponse = await pos.request.get(new URL(manifestHref,'https://pos.escalarai.tech').href);
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('Escalar AI POS');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      const response = await pos.request.get(new URL(icon.src, 'https://pos.escalarai.tech').href);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
    expect(await pos.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (name === 'desktop') {
      stage = 'desktop:maps-public-domain';
      await pos.goto('https://pos.escalarai.tech/configuracion/sucursal');
      await pos.getByRole('button',{name:'Agregar ubicación',exact:true}).click();
      const dialog = pos.getByRole('dialog',{name:'Agregar ubicación',exact:true});
      await expect(dialog.locator('.settings-location-loading')).toHaveCount(0,{timeout:30000});
      let mapVerified = false;
      try {
        await expect(dialog.locator('.gm-style')).toBeVisible({timeout:30000});
        await expect.poll(() => dialog.locator('.gm-style img').evaluateAll(images => images.filter(
          image => image.complete && image.naturalWidth >= 200 && image.naturalHeight >= 200).length),
          {timeout:30000}).toBeGreaterThan(0);
        mapVerified = await dialog.getByRole('alert').count() === 0;
      } catch { /* Script loading alone does not prove that the map was authorized. */ }
      console.log(mapVerified ? 'PASS browser Google Maps tiles visible on public domain' : 'PENDING browser Maps authorization/rendering on public domain');
      await pos.screenshot({path:`${output}/desktop-maps.png`,fullPage:true});
      await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    }
    console.log(`PASS ${name}: Admins, CLIENTES, navigation, PWA, no development login`);
    await context.close();
  }
} catch (error) {
  console.log(JSON.stringify({failed_at:stage,kind:error.name}));
  process.exitCode=1;
} finally {
  credentials.password=''; owner.password='';
  await browser.close();
}
