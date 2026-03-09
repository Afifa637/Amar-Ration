# Amar Ration Backend - MongoDB

Complete backend system for food distribution management with MongoDB.

## Features

✅ **4 User Types:**
- **Admin** - System administrators
- **Distributor** - Distribution center managers (can scan QR codes)
- **FieldUser** - Field workers (can scan QR codes)
- **Consumer** - Ration beneficiaries with auto-generated QR tokens

✅ **QR Token System:**
- Auto-generates unique QR tokens for consumers on registration
- Secure 64-character hex tokens stored in user record
- Ready for future hardware IoT integration

✅ **Authentication & Authorization:**
- JWT-based authentication
- Role-based access control
- Secure password hashing with bcrypt
- Login via email, phone, or consumerCode

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file (already exists):
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/amar_ration?replicaSet=rs0
JWT_SECRET=change_me_in_production
JWT_EXPIRES_IN=2h
```

### 3. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

Server runs at: **http://localhost:5000**

## API Routes

### Authentication (`/api/auth`)
- `POST /signup` - Register user (Admin/Distributor/FieldUser/Consumer)
- `POST /login` - Login user
- `GET /me` - Get current user (protected)
- `PUT /change-password` - Change password (protected)

### Other Routes
- `/api/distribution` - Distribution management
- `/api/monitoring` - System monitoring
- `/api/reports` - Reports and analytics
- `/api/settings` - System settings (Admin only)

## Database Schema

### Users Collection
All 4 user types stored in single collection with discriminated fields:
- Common: userType, name, email, phone, passwordHash, status
- Consumer: consumerCode, qrToken, nidLast4, category
- Distributor: wardNo, officeAddress, division, district, etc.
- FieldUser: wardNo, division, district, etc.

### QRCodes Collection
- consumerId, consumerCode, qrTok (64-char hex), nidLast4, category
- Distributor: wardNo, officeAddress, division, district, etc.
- FieldUser: wardNo, division, district, etc.
POST /api/auth/signup
{
  "userType": "Consumer",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "01712345678",
  "password": "password123",
  "nidLast4": "1234",
  "category": "A"
}
```
**Auto-generates:** `consumerCode` (C0001) + `qrToken` (64-char hex)

### Distributor Signup
```json
POST /api/auth/signup
{
  "userType": "Distributor",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "01798765432",
  "password": "password123",
  "wardNo": "01",
  "officeAddress": "123 Main St, Dhaka",
**Note:** QR token is stored in user record for future hardware IoT scanning integration.

  "division": "Dhaka",
  "district": "Dhaka"
}
```

### FieldUser Signup
```json
POST /api/auth/signup
{
  "userType": "FieldUser",
  "name": "Bob Wilson",
  "email": "bob@example.com",
  "phone": "01787654321",
  "password": "password123",
  "wardNo": "02",
  "division": "Dhaka",
  "district": "Dhaka"
}
```

## Login
```json
POST /api/auth/login
{
  "identifier": "john@example.com",  // or phone or consumerCode (C0001)
  "password": "password123"
}
```

## QR Token Verification
```json
POST /api/qr/verify
Authorization: Bearer DISTRIBUTOR_OR_FIELDUSER_TOKEN

{
  "qrToken": "consumer_qr_token_here"
}
```

## Tech Stack

- **Node.js** + **Express** - Backend framework
- **MongoDB** + **Mongoose** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **crypto** - QR token generation

## Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

## Project Structure

```
backend/
├── src/
│   ├── app.js              # Express app setup
│   ├── config/
│   │   └── db.js           # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js        # Authentication
│   │   ├── qr.controller.js          # QR operations
│   │   ├── distribution.controller.js
│   │   ├── monitoring.controller.js
│   │   └── reports.controller.js
│   ├── middauth.js         # JWT & authorization
│   │   └── error.js        # Error handling
│   ├── models/
│   │   ├── User.js         # All user types
│   │   ├── QRCode.js       # QR tokens
│   │   ├── Consumer.js
│   │   ├── Distributor.js
│   │   └── ... (other models)
│   ├── routes/
│   │   ├── qr.routes.js
│   │   ├── distribution.routes.js
│   │   ├── monitoring.routes.js
│   │   ├── reports.routes.js
│   │   └── settings.routes.js
│   └── services/
│       ├── token.service.js
│       └── ... (other services)
├── server.js               # Entry point
├── package.json
└── .env
```


✅ Password hashing (bcrypt)  
✅ JWT authentication  
✅ Role-based authorization  
✅ Secure QR token generation  
⚠️ **Change JWT_SECRET in production!**

## Development

```bash
# Install nodemon for auto-reload
npm install -D nodemon

# Run in dev mode
npm run dev
```

## License

MIT
