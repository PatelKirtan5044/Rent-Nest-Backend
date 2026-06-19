const http = require('http');

const testPort = (port) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/uploads/images-1781496111248-886661491.jpeg',
      method: 'GET',
      timeout: 1000
    };

    const req = http.request(options, (res) => {
      console.log(`Port ${port} response: Status ${res.statusCode}, Headers: ${JSON.stringify(res.headers)}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(`Port ${port} failed: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`Port ${port} timed out`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

const run = async () => {
  console.log('Testing ports 5000 and 8000 for static uploads...');
  await testPort(5000);
  await testPort(8000);
};

run();
