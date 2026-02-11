# MongoDB Atlas Setup Guide

## Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up with your email (free tier available)
3. Verify your email

## Step 2: Create a Cluster

1. After login, click **"Build a Database"**
2. Select **FREE** tier (M0 Sandbox)
3. Choose **Cloud Provider**: AWS, Google Cloud, or Azure
4. Select **Region**: Choose one closest to Bangladesh (e.g., Mumbai, Singapore)
5. **Cluster Name**: Leave default or name it "Amar-Ration"
6. Click **"Create"** (takes 3-5 minutes)

## Step 3: Create Database User

1. In the left sidebar, go to **"Database Access"**
2. Click **"Add New Database User"**
3. Select **"Password"** authentication method
4. Enter:
   - **Username**: `amarration_admin` (or your choice)
   - **Password**: Generate a strong password (SAVE THIS!)
5. **Database User Privileges**: Select "Read and write to any database"
6. Click **"Add User"**

## Step 4: Configure Network Access

1. In the left sidebar, go to **"Network Access"**
2. Click **"Add IP Address"**
3. For development, click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ For production, restrict to specific IPs
4. Click **"Confirm"**

## Step 5: Get Connection String

1. Go back to **"Database"** in left sidebar
2. Click **"Connect"** button on your cluster
3. Select **"Connect your application"**
4. Choose:
   - **Driver**: Node.js
   - **Version**: 5.5 or later
5. Copy the connection string (looks like this):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password
8. Add your database name before the `?`:
   ```
   mongodb+srv://amarration_admin:YourPassword@cluster0.xxxxx.mongodb.net/amar_ration?retryWrites=true&w=majority
   ```

## Step 6: Update .env File

Update the `MONGO_URI` in your `.env` file with the connection string from Step 5.

## Step 7: Run Seed Script

Once your .env is updated, run:

```bash
npm run seed
```

This will:
- Create an admin user
- Create sample distributors, field users, and consumers
- Set up system settings
- Display all login credentials

## Default Login Credentials

After seeding, you can login with:

**Admin Account:**
- Email: `admin@amarration.gov.bd`
- Password: `Admin@123`

**Distributor Accounts:**
- Email: `kamal@distributor.com` | Password: `Admin@123`
- Email: `rashida@distributor.com` | Password: `Admin@123`

⚠️ **IMPORTANT**: Change these passwords after first login!

## Verify Setup

1. Open MongoDB Compass
2. Connect using the same connection string
3. You should see the `amar_ration` database with collections:
   - users
   - systemsettings

## Troubleshooting

**Connection Error:**
- Check if IP is whitelisted in Network Access
- Verify username/password in connection string
- Ensure password doesn't have special characters that need encoding

**Authentication Failed:**
- Double-check database user credentials
- Make sure user has proper permissions

**Need Help?**
Contact your team or refer to [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
