require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function updateAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const email = 'admin_amarration@gmail.com';
    const password = 'adminadmin';
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await User.findOneAndUpdate(
      { userType: 'Admin' },
      {
        $set: {
          email,
          passwordHash: hashedPassword,
          status: 'Active',
        }
      },
      { upsert: true, new: true }
    );

    console.log('✅ Admin credentials updated:', result.email);
    console.log('   Email   :', email);
    console.log('   Password: adminadmin');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

updateAdmin();
