// Test script to verify signup and login functionality
const http = require('http');

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function testSignup() {
  console.log('🧪 Testing Signup...');
  try {
    const signupData = {
      userType: 'FieldUser',
      name: 'Test User 2',
      email: 'test2@example.com',
      phone: '01712345679',
      password: 'test123',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Mirpur',
      unionName: 'Test Union',
      ward: 'Ward 1',
      wardNo: '01'
    };

    const response = await makeRequest('/api/auth/signup', 'POST', signupData);
    if (response.statusCode === 201) {
      console.log('✅ Signup successful:', response.data);
      return response.data;
    } else {
      console.log('❌ Signup failed:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Signup error:', error.message);
    return null;
  }
}

async function testLogin(identifier, password, userType) {
  console.log(`🧪 Testing Login with ${identifier}...`);
  try {
    const loginData = {
      identifier,
      password,
      userType
    };

    const response = await makeRequest('/api/auth/login', 'POST', loginData);
    if (response.statusCode === 200) {
      console.log('✅ Login successful:', response.data);
      return response.data;
    } else {
      console.log('❌ Login failed:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

async function runTests() {
  // Test signup
  const signupResult = await testSignup();

  if (signupResult) {
    // Wait a bit for database to sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test login with email
    await testLogin('test2@example.com', 'test123', 'FieldUser');

    // Test login with phone
    await testLogin('01712345679', 'test123', 'FieldUser');

    // Test login with wrong password
    await testLogin('test2@example.com', 'wrongpass', 'FieldUser');
  }
}

runTests();