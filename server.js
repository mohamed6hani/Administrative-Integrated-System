const path = require('path');

const backendEntry = path.join(
  __dirname,
  'public',
  'Program',
  'General',
  'backend',
  'server.js'
);

console.log('📦 Starting Administrative Integrated System backend server...');
try {
  require(backendEntry);
  console.log('✅ Backend server initialised via root entry.');
} catch (error) {
  console.error('❌ Failed to start backend server.');
  console.error('Path attempted:', backendEntry);
  console.error(error);
  process.exit(1);
}
