const { spawn } = require('child_process');

async function run() {
  console.log("🌐 Booting QA Subsystems...");

  console.log("1. Starting Firebase Database Emulators [Port 8080/9099]");
  const emu = spawn('npx.cmd', ['firebase', 'emulators:start', '--project', 'ayursutra-test', '--only', 'firestore,auth'], { cwd: './server', shell: true });
  
  console.log("2. Starting AyurSutra Backend [Port 3001]");
  const backend = spawn('npm.cmd', ['run', 'dev'], { cwd: './server', shell: true });

  console.log("3. Starting React Frontend [Port 5173]");
  const frontend = spawn('npm.cmd', ['run', 'dev'], { cwd: './client', shell: true });

  // Stream occasional outputs to know if they died
  emu.stderr.on('data', d => console.log(`[EMU_ERR]: ${d}`));
  backend.stderr.on('data', d => console.log(`[BACKEND_ERR]: ${d}`));

  console.log("⏳ Waiting 20 seconds for internal network routing tables to settle...");
  await new Promise(r => setTimeout(r, 20000));

  console.log("4. Firing Database Mock Seeder...");
  const seed = spawn('node', ['scripts/seed.js'], { cwd: './server', shell: true });
  
  await new Promise(r => {
      seed.on('close', r);
  });
  console.log("Seed injection finished.");

  console.log("5. Initializing Headless Cypress Pipeline...");
  const cypress = spawn('npx.cmd', ['cypress', 'run'], { cwd: './client', stdio: 'inherit', shell: true });
  
  cypress.on('close', (code) => {
    console.log(`\n\n🏁 Cypress E2E Matrix Finished (Exit Code: ${code})`);
    console.log("Shutting down background port listeners...");
    emu.kill();
    backend.kill();
    frontend.kill();
    process.exit(code);
  });
}

run().catch(console.error);
