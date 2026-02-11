require('dotenv').config();
const mongoose = require('mongoose');

async function clearUsers() {
  try {
    console.log('🗑️  Clearing all users from database...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB\n');

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Count users before deletion
    const countBefore = await usersCollection.countDocuments();
    console.log(`Found ${countBefore} user(s) in the database`);
    
    // Delete all users
    const result = await usersCollection.deleteMany({});
    
    console.log(`\n✅ Successfully deleted ${result.deletedCount} user(s)`);
    console.log('\n📝 Database is now empty and ready for new user registrations!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
    process.exit(0);
  }
}

clearUsers();
