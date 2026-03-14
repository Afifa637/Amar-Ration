require('dotenv').config();
const mongoose = require('mongoose');

async function viewUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    console.log('Attempting to connect to Atlas...');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✓ Connected to MongoDB\n');

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Fetch all users
    const users = await usersCollection.find({}).toArray();
    
    console.log(`Found ${users.length} user(s) in the database:\n`);
    console.log('='.repeat(100));
    
    if (users.length === 0) {
      console.log('No users found in the database.');
    } else {
      users.forEach((user, index) => {
        console.log(`\nUser ${index + 1}:`);
        console.log(`  ID: ${user._id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email || 'N/A'}`);
        console.log(`  Phone: ${user.phone || 'N/A'}`);
        console.log(`  User Type: ${user.userType}`);
        console.log(`  Status: ${user.status}`);
        if (user.consumerCode) {
          console.log(`  Consumer Code: ${user.consumerCode}`);
          console.log(`  Category: ${user.category}`);
        }
        if (user.wardNo) {
          console.log(`  Ward No: ${user.wardNo}`);
        }
        console.log(`  Created: ${user.createdAt || 'N/A'}`);
        console.log('-'.repeat(100));
      });
    }
    
  } catch (error) {
    console.error('❌ Error occurred:');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
  }
}

viewUsers();
