require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await SystemSetting.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // Hash password for all users
    const defaultPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create Admin User
    console.log('👤 Creating Admin user...');
    const admin = await User.create({
      userType: 'Admin',
      name: 'System Administrator',
      email: 'admin@amarration.gov.bd',
      phone: '01711000000',
      passwordHash: hashedPassword,
      status: 'Active',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Dhaka Sadar',
    });
    console.log('✅ Admin created:', admin.email);

    // Create Distributor Users
    console.log('\n🏪 Creating Distributor users...');
    const distributors = await User.insertMany([
      {
        userType: 'Distributor',
        name: 'Kamal Hossain',
        email: 'kamal@distributor.com',
        phone: '01711111111',
        passwordHash: hashedPassword,
        status: 'Active',
        wardNo: '1',
        officeAddress: 'Shop No. 5, Main Road, Mirpur-1',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        unionName: 'Mirpur',
        ward: '1',
        authorityStatus: 'Active',
        authorityFrom: new Date('2024-01-01'),
        authorityTo: new Date('2026-12-31'),
      },
      {
        userType: 'Distributor',
        name: 'Rashida Begum',
        email: 'rashida@distributor.com',
        phone: '01722222222',
        passwordHash: hashedPassword,
        status: 'Active',
        wardNo: '2',
        officeAddress: 'House No. 12, Block-C, Uttara',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Uttara',
        unionName: 'Uttara',
        ward: '2',
        authorityStatus: 'Active',
        authorityFrom: new Date('2024-01-01'),
        authorityTo: new Date('2026-12-31'),
      }
    ]);
    console.log(`✅ Created ${distributors.length} distributors`);

    // Create Field Users
    console.log('\n👷 Creating Field users...');
    const fieldUsers = await User.insertMany([
      {
        userType: 'FieldUser',
        name: 'Rahim Ahmed',
        email: 'rahim@field.com',
        phone: '01733333333',
        passwordHash: hashedPassword,
        status: 'Active',
        wardNo: '1',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        unionName: 'Mirpur',
        ward: '1',
        authorityStatus: 'Active',
        authorityFrom: new Date('2024-01-01'),
        authorityTo: new Date('2026-12-31'),
      }
    ]);
    console.log(`✅ Created ${fieldUsers.length} field users`);

    // Create Consumer Users
    console.log('\n🏠 Creating Consumer users...');
    const consumers = await User.insertMany([
      {
        userType: 'Consumer',
        name: 'Fatema Khatun',
        email: 'fatema@consumer.com',
        phone: '01744444444',
        passwordHash: hashedPassword,
        status: 'Active',
        consumerCode: 'CONS001',
        nidLast4: '1234',
        category: 'A',
        qrToken: 'QR-CONS-001-' + Date.now(),
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        ward: '1',
      },
      {
        userType: 'Consumer',
        name: 'Abdul Hamid',
        email: 'hamid@consumer.com',
        phone: '01755555555',
        passwordHash: hashedPassword,
        status: 'Active',
        consumerCode: 'CONS002',
        nidLast4: '5678',
        category: 'B',
        qrToken: 'QR-CONS-002-' + Date.now(),
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        ward: '1',
      },
      {
        userType: 'Consumer',
        name: 'Amina Begum',
        email: 'amina@consumer.com',
        phone: '01766666666',
        passwordHash: hashedPassword,
        status: 'Active',
        consumerCode: 'CONS003',
        nidLast4: '9012',
        category: 'C',
        qrToken: 'QR-CONS-003-' + Date.now(),
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Uttara',
        ward: '2',
      }
    ]);
    console.log(`✅ Created ${consumers.length} consumers`);

    // Create System Settings
    console.log('\n⚙️  Creating system settings...');
    const settings = await SystemSetting.insertMany([
      {
        key: 'pricing',
        value: {
          rice: 30,
          wheat: 25,
          oil: 120,
          sugar: 60
        }
      },
      {
        key: 'distribution_hours',
        value: {
          start: '09:00',
          end: '17:00',
          timezone: 'Asia/Dhaka'
        }
      },
      {
        key: 'monthly_quotas',
        value: {
          categoryA: { rice: 15, wheat: 10 },
          categoryB: { rice: 10, wheat: 5 },
          categoryC: { rice: 5, wheat: 3 }
        }
      }
    ]);
    console.log(`✅ Created ${settings.length} system settings`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📋 Created Users:');
    console.log(`   • 1 Admin`);
    console.log(`   • ${distributors.length} Distributors`);
    console.log(`   • ${fieldUsers.length} Field Users`);
    console.log(`   • ${consumers.length} Consumers`);
    console.log(`   • Total: ${1 + distributors.length + fieldUsers.length + consumers.length} users`);
    
    console.log('\n🔐 Default Login Credentials:');
    console.log(`   Password for all users: ${defaultPassword}`);
    console.log('\n   Admin Account:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${defaultPassword}`);
    
    console.log('\n   Distributor Accounts:');
    distributors.forEach(d => {
      console.log(`   Email: ${d.email} | Password: ${defaultPassword}`);
    });

    console.log('\n⚠️  IMPORTANT: Change these default passwords in production!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error seeding database:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the seed function
seedDatabase();
