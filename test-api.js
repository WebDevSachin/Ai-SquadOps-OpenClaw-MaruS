// Simple API test for login
const http = require('http');

const testLogin = () => {
  const data = JSON.stringify({
    email: 'admin@squadops.local',
    password: 'SquadOps2024!'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('Testing login via API proxy...');
  
  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      const result = JSON.parse(responseData);
      console.log('Status:', res.statusCode);
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (result.accessToken) {
        console.log('\n✅ LOGIN SUCCESS!');
        console.log('User:', result.user.email);
        console.log('Role:', result.user.role);
      } else {
        console.log('\n❌ LOGIN FAILED:', result.error);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request failed:', e.message);
  });

  req.write(data);
  req.end();
};

testLogin();
