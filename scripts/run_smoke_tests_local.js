const { chromium } = require('playwright');

async function run() {
  console.log('=== STARTING LOCAL PLAYWRIGHT SMOKE TEST ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Add event listeners for diagnostics
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  page.on('request', request => console.log('BROWSER REQUEST:', request.method(), request.url()));
  page.on('requestfailed', request => console.log('BROWSER REQUEST FAILED:', request.url(), request.failure()?.errorText));
  page.on('requestfinished', request => console.log('BROWSER REQUEST FINISHED:', request.url()));
  page.on('response', async response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('BROWSER LOGIN RESPONSE STATUS:', response.status());
      try {
        console.log('BROWSER LOGIN RESPONSE BODY:', await response.text());
      } catch (e) {}
    }
  });

  try {
    // 1. Go to Login Page
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    
    // Clear localStorage to make sure we start fresh and activation dialog appears
    console.log('Clearing localStorage...');
    await page.evaluate(() => localStorage.clear());
    
    // Fill credentials
    console.log('Entering credentials...');
    await page.fill('#usuario', 'HECTOR');
    await page.fill('#password', '123456');
    
    // Take screenshot before submit
    await page.screenshot({ path: 'C:\\Users\\hecto\\.gemini\\antigravity\\brain\\1c2fd88a-fd50-455c-9041-7be61d1bc324\\before_submit_local.png' });
    
    console.log('Clicking login button...');
    await page.click('button[type="submit"]');

    // Wait and check cookies
    await page.waitForTimeout(2000);
    const cookiesAfterClick = await context.cookies();
    console.log('BROWSER COOKIES AFTER CLICK:', JSON.stringify(cookiesAfterClick, null, 2));

    // Wait and check if we get an error banner
    console.log('Waiting for response...');
    try {
      await page.waitForURL(url => url.pathname === '/', { timeout: 10000 });
      console.log('Successfully logged in! Current URL:', page.url());
    } catch (urlErr) {
      console.log('Timeout waiting for redirect. Diagnosing...');
      const finalCookies = await context.cookies();
      console.log('BROWSER COOKIES AT TIMEOUT:', JSON.stringify(finalCookies, null, 2));
      console.log('CURRENT URL AT TIMEOUT:', page.url());
      const errorText = await page.locator('.bg-red-50').textContent().catch(() => null);
      if (errorText) {
        console.error('Login failed with message:', errorText.trim());
      } else {
        console.error('No visible error banner.');
      }
      // Take screenshot of failure
      await page.screenshot({ path: 'C:\\Users\\hecto\\.gemini\\antigravity\\brain\\1c2fd88a-fd50-455c-9041-7be61d1bc324\\login_failure_local.png' });
      throw new Error('Login redirect failed');
    }

    // 2. Interaction with activation dialog
    console.log('Interacting with activation dialog...');
    // Click "Activar venta" to open the dialog
    console.log('Clicking "Activar venta" button...');
    await page.click('button:has-text("Activar venta")');
    // Search for client
    await page.waitForSelector('input[placeholder="Nombre o código del cliente..."]');
    await page.fill('input[placeholder="Nombre o código del cliente..."]', '5000');
    await page.click('button:has-text("Buscar")');

    // Select the client
    console.log('Selecting client...');
    await page.waitForSelector('button:has-text("PRUEBA WEB NEXUS")');
    await page.click('button:has-text("PRUEBA WEB NEXUS")');

    // Go to Paso B
    await page.click('button:has-text("Siguiente →")');

    // Select Plazo (EFECTIVO)
    console.log('Selecting payment terms...');
    await page.waitForSelector('button:has-text("EFECTIVO")');
    await page.click('button:has-text("EFECTIVO")');

    // Open catalog
    console.log('Opening catalog...');
    await page.click('button:has-text("Ver catálogo →")');
    await page.waitForSelector('text=disp:'); // Wait for products to load

    // 3. Add item to cart
    console.log('Adding an item to the cart...');
    // Find the first '+' button that is enabled and click it
    await page.click('button:not([disabled]):has-text("+")');
    console.log('Item added.');

    // 4. Simulate yesterday\'s session in localStorage
    console.log('Simulating yesterday\'s session in localStorage...');
    await page.evaluate(() => {
      const dataStr = localStorage.getItem('rimec_sesion_venta');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        parsed.state.activatedAt = '2026-05-21T10:00:00.000Z'; // yesterday
        localStorage.setItem('rimec_sesion_venta', JSON.stringify(parsed));
      }
    });

    // 5. Refresh page to see the yellow banner
    console.log('Refreshing page to check the yellow session banner...');
    await page.reload();
    await page.waitForTimeout(2000); // Wait for render

    // Take screenshot of catalog with yellow banner
    const bannerPath = 'C:\\Users\\hecto\\.gemini\\antigravity\\brain\\1c2fd88a-fd50-455c-9041-7be61d1bc324\\sesion_vieja_banner_local.png';
    console.log(`Saving screenshot of yellow banner to ${bannerPath}...`);
    await page.screenshot({ path: bannerPath });

    // 6. Simulate orphan item (Sin precio) in cart
    console.log('Simulating orphan item in cart...');
    await page.evaluate(() => {
      const dataStr = localStorage.getItem('rimec_sesion_venta');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        // Add dummy det_999999 which does not exist in stock list (will have no price)
        parsed.state.carrito['det_999999'] = {
          det_id: 999999,
          linea_codigo: '9999',
          referencia_codigo: '999',
          material_code: 'DUMMY',
          color_code: 'DUMMY',
          color_nombre: 'DUMMY_COLOR',
          pp_id: 1,
          pp_nro: 'PP-2026-0001',
          eta: '2026-06-15',
          marca: 'ACTVITTA',
          marca_id: 7,
          caso: 'ACT-BRSPORT',
          caso_id: 6,
          nombre: 'PRODUCTO HUERFANO DE PRUEBA',
          gradas_fmt: '34-39',
          imagen_url: '',
          lista_precio_id: 1,
          precio_base: 100000,
          cant_caja: 8,
          cajas: 1,
          pares: 8,
          subtotal: 800000
        };
        localStorage.setItem('rimec_sesion_venta', JSON.stringify(parsed));
      }
    });

    // Go to cart page
    console.log('Navigating to cart page...');
    await page.goto('http://localhost:3001/carrito');
    await page.waitForTimeout(3000); // Wait for prices validation

    // Take screenshot of cart with blocked CONFIRMAR PEDIDO button
    const cartPath = 'C:\\Users\\hecto\\.gemini\\antigravity\\brain\\1c2fd88a-fd50-455c-9041-7be61d1bc324\\carrito_huerfano_bloqueo_local.png';
    console.log(`Saving screenshot of cart page to ${cartPath}...`);
    await page.screenshot({ path: cartPath });

    console.log('=== SMOKE TEST SCRIPT FINISHED SUCCESS ===');

  } catch (error) {
    console.error('Error during smoke test:', error.message);
    try {
      await page.screenshot({ path: 'C:\\Users\\hecto\\.gemini\\antigravity\\brain\\1c2fd88a-fd50-455c-9041-7be61d1bc324\\error_screenshot_local.png' });
      console.log('Saved error screenshot to error_screenshot_local.png');
    } catch (e) {
      console.error('Failed to take error screenshot:', e.message);
    }
  } finally {
    await browser.close();
  }
}

run();
