import './polyfill-websocket';
import { appRouter } from '../server/routers/app';
import { db } from './index';


async function testApi() {
  console.log('Testing tRPC API router integration...');
  try {
    // Instantiate a caller with a mock Context (bypassing Supabase cookie auth, but using the same database instance)
    const caller = appRouter.createCaller({
      user: { id: 'test-admin-id', email: 'admin@catering.com' } as any,
      dbUser: { id: 'test-admin-id', role: 'super_admin', organizationId: null } as any,
      db: db
    });

    console.log('Invoking caller.organization.getAll()...');
    const orgs = await caller.organization.getAll();
    console.log('API call successful!');
    console.log(`Retrieved ${orgs.length} organizations from DB:`);
    console.log(orgs);
    process.exit(0);
  } catch (error) {
    console.error('API call execution failed:', error);
    process.exit(1);
  }
}

testApi();
