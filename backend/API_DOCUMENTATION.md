# Amar Ration Backend API Documentation

## Overview
MongoDB-based backend for the Amar Ration food distribution system supporting 4 user types:
- **Admin** - System administrators
- **Distributor** - Main distribution center managers
- **FieldUser** - Field workers for on-ground distribution
- **Consumer** - Ration beneficiaries with QR tokens

---

## Database Setup

### MongoDB Connection (No Username/Password Needed for Local)
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/amar_ration?replicaSet=rs0
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=2h
```

**⚠️ Production Security:**
- Change `JWT_SECRET` to a strong random string
- Use MongoDB Atlas or secured MongoDB instance with authentication

---

## User Types & Features

### 1. **Admin**
- Full system access
- Manage all users and settings
- **Required fields:** name, email/phone, password

### 2. **Distributor**
- Manage distribution centers
- Scan consumer QR codes
- **Required fields:** name, email/phone, password, wardNo, officeAddress
- **Optional:** division, district, upazila, unionName, ward

### 3. **FieldUser**
- Field-level distribution workers
- Scan consumer QR codes
- **Required fields:** name, email/phone, password, wardNo
- **Optional:** division, district, upazila, unionName, ward

### 4. **Consumer** (Auto-generates QR token on registration)
- Receive rations using QR code
- **Required fields:** name, email/phone, password, nidLast4
- **Auto-generated:** consumerCode (C0001, C0002...), qrToken (64-char hex)
- **Optional:** category (A/B/C, defaults to "A")

---

## API Endpoints

### Authentication Routes (`/api/auth`)

#### 1. **Signup** - Register New User
```http
POST /api/auth/signup
Content-Type: application/json

{
  "userType": "Consumer|Distributor|FieldUser|Admin",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "01712345678",
  "password": "securepassword123",
  
  // Consumer-specific (optional)
  "nidLast4": "1234",
  "category": "A",
  
  // Distributor-specific
  "wardNo": "01",
  "officeAddress": "123 Main St, Dhaka",
  "division": "Dhaka",
  "district": "Dhaka",
  "upazila": "Gulshan",
  
  // FieldUser-specific
  "wardNo": "02",
  "division": "Dhaka"
}
```

**Response (Consumer):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "userType": "Consumer",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "01712345678",
      "status": "Active",
      "consumerCode": "C0001",
      "category": "A",
      "qrToken": "a1b2c3d4...64-character-hex-token"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 2. **Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "john@example.com",  // Email, phone, OR consumerCode
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* user object */ },
    "token": "JWT_TOKEN_HERE"
  }
}
```

#### 3. **Get Current User** (Protected)
```http
GET /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 4. **Change Password** (Protected)
```http
PUT /api/auth/change-password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

## QR Token System

### How It Works:
1. **Consumer Registration** → Auto-generates unique 64-character hex QR token
2. **Token stored in User record** for future hardware IoT integration
3. Token can be used later for QR code scanning via hardware devices

**Note:** QR verification/scanning endpoints will be implemented later with hardware IoT integration.

---

## Authorization Rules

| Route | Admin | Distributor | FieldUser | Consumer |
|-------|-------|-------------|-----------|----------|
| `/api/auth/*` | ✅ | ✅ | ✅ | ✅ |
| `/api/settings/*` | ✅ | ❌ | ❌ | ❌ |

---

## QR Token System

## Running the Backend

### Install Dependencies
```bash
cd backend
npm install
```

### Start Development Server
```bash
npm run dev
```

### Start Production Server
```bash
npm start
```

**Backend runs at:** `http://localhost:5000`

---

## Database Collections

1. **users** - All user types (Admin, Distributor, FieldUser, Consumer with qrToken)
2. **distributionrecords** - Distribution transaction history
3. **tokens** - Ration distribution tokens
4. **stockledgers** - Inventory tracking
5. **auditlogs** - System activity logs

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid token. Authorization denied."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Only Admin can access this resource."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "email already exists"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Server Error",
  "error": "Detailed error message"
}
```

---

## Testing Examples

### Test Consumer Signup & Login
```bash
# 1. Signup
curl -X POS (generates qrToken automatically)
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "userType": "Consumer",
    "name": "Test Consumer",
    "email": "consumer@test.com",
    "phone": "01712345678",
    "password": "test123",
    "nidLast4": "5678",
    "category": "A"
  }'

# 2. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "consumer@test.com",
    "password": "test123
```

---

## Security Notes

✅ **Implemented:**
- bcrypt password hashing (10 rounds)
- JWT authentication
- Role-based authorization
- QR token security (64-byte random hex)
- Unique consumer codes
- Status tracking for users and QR codes

⚠️ **Production Checklist:**
- [ ] Change JWT_SECRET to strong random value
- [ ] Use HTTPS/TLS for all connections
- [ ] Enable MongoDB authentication
- [ ] Add rate limiting
- [ ] Implement refresh tokens
- [ ] Add request validation middleware
- [ ] Enable CORS for specific origins only
- [ ] Add logging and monitoring
- [ ] Implement QR token expiration policy
- [ ] Add 2FA for admin accounts
