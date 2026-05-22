import * as fs from 'fs';
import * as path from 'path';

// Parse .env manually
try {
  const envPath = path.resolve(process.cwd(), '.env');
  console.log('Resolving env path:', envPath);
  console.log('Env file exists:', fs.existsSync(envPath));
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
      if (key === 'DATABASE_URL') {
        console.log('Loaded DATABASE_URL successfully (masked):', val.substring(0, 15) + '...');
      }
    });
  }
} catch (err) {
  console.error('Error loading .env file:', err);
}

async function listUsers() {
  console.log('Querying all profiles from database...');
  try {
    const { db } = await import('./index');
    const { profiles } = await import('./schema/users');
    const users = await db.select().from(profiles);
    console.log('Total profiles found:', users.length);
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Failed to retrieve profiles:', error);
    process.exit(1);
  }
}

listUsers();
