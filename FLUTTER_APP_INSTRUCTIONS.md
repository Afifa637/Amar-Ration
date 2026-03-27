# **FLUTTER MOBILE APP - FIELD DISTRIBUTOR QR SCANNER**
## Complete Project Specification & Development Guide

### **PROJECT OVERVIEW**
You are building a Flutter mobile application for **Field Distributors** in the Amar Ration food distribution system. The app enables field distributors to scan consumer QR codes, verify consumer eligibility, and confirm ration distribution. The app connects to an existing Node.js/Express/MongoDB backend.

---

### **1. APP PURPOSE & KEY FEATURES**

**Primary Users:** Field Distributors

**Core Functionality:**
- ✅ Sign up and login for field distributors
- ✅ QR code scanner to scan consumer smart cards
- ✅ Backend validation to check consumer registration
- ✅ Card validity verification
- ✅ Ration eligibility check (daily)
- ✅ Success/failure feedback to distributors
- ✅ Offline queue for offline scans
- ✅ Session management with JWT tokens

---

### **2. UI/UX DESIGN SPECIFICATIONS**

#### **Color Scheme (Match Web App Exactly):**
- **Primary Blue:** `#1f77b4` (Header/Main buttons)
- **Secondary Blue:** `#16679c` (Navigation bars/Secondary elements)
- **White:** `#FFFFFF` (Backgrounds, cards)
- **Text Dark Gray:** `#333333`
- **Light Gray:** `#EFEFEF` (Backgrounds)
- **Success Green:** `#28a745` (Success messages)
- **Error Red:** `#dc3545` (Error messages)
- **Warning Orange:** `#ffc107` (Warning messages)

#### **Typography:**
- **Default Font Family:** Bengali: "Anek Bangla" (Google Fonts), Fallback: "Roboto" for non-Bangla text
- **Font Sizes:**
  - Header/Title: 20-24px (Bold)
  - Regular Text: 14-16px
  - Small Text/Labels: 12-13px
  - Button Text: 15-16px

#### **Layout & Components:**
- **App Bar/Header:** 
  - Background: #1f77b4
  - Height: 56-64px
  - Show app title "আমার রেশন ডিস্ট্রিবিউটর" (Amar Ration Distributor)
  - Display logged-in distributor name
  - Logout button (top right)

- **Bottom Navigation:** 
  - Background: #16679c
  - Icons for: Home, Scanner, History, Profile
  
- **Cards/Containers:**
  - White background with subtle shadow
  - Border radius: 8-12px
  - Padding: 12-16px

- **Buttons:**
  - Primary buttons: #1f77b4 background, white text
  - Secondary buttons: #16679c background, white text
  - Disabled: #CCCCCC background
  - Border radius: 6-8px
  - Height: 44-48px for touch targets

- **Input Fields:**
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 10px
  - Focus color: #1f77b4

---

### **3. LANGUAGE**
- **Primary App Language:** Bengali (Bangla)
- **All UI Labels, Buttons, Messages:** In Bengali
- **Example Text Labels:**
  - লগইন = Login
  - সাইন আপ = Sign Up
  - ইমেইল = Email
  - ফোন = Phone
  - পাসওয়ার্ড = Password
  - স্কেন করুন = Scan
  - সফল = Success
  - ব্যর্থ = Failed
  - দৈনিক রেশন গ্রহণযোগ্য = Eligible for daily ration

---

### **4. DATABASE & BACKEND CONFIGURATION**

#### **MongoDB Configuration:**
```
Database Name: amar_ration
Collections Used (from existing system):
  - users (Distributors, Consumers)
  - qrcodes (QR token data)
  - consumers (Consumer records)
  - distributioncords (Distribution records)
  - distributionrecords (Distribution transactions)
```

#### **Backend API Configuration:**
```
Base URL: http://localhost:5000/api
(Update to production URL when deploying)

API Endpoints:
  - POST /auth/signup → Register new field distributor
  - POST /auth/login → Login field distributor
  - GET /auth/me → Get current user profile
  - POST /distribution/scan → Scan QR and validate consumer
  - POST /distribution/complete → Complete distribution
  - GET /distribution/tokens → Get tokens for current session
  - PATCH /distribution/tokens/:id/cancel → Cancel a token

Authentication:
  - Method: JWT (JSON Web Token)
  - Header: Authorization: Bearer <token>
  - Token Expiry: 2 hours
  - Storage: SharedPreferences (Android/iOS)
```

---

### **5. REQUIRED PACKAGES/DEPENDENCIES**

```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.0
  
  # HTTP & Networking
  http: ^1.1.0
  dio: ^5.3.1
  
  # State Management
  provider: ^6.0.0
  
  # Navigation
  go_router: ^10.0.0
  
  # Local Storage
  shared_preferences: ^2.2.0
  
  # QR Scanner
  mobile_scanner: ^3.5.0
  # OR qr_code_scanner: ^1.0.1
  
  # JSON Serialization
  json_annotation: ^4.8.0
  
  # Date/Time
  intl: ^0.18.0
  
  # UI/Polish
  flutter_localizations:
    sdk: flutter
  google_fonts: ^6.1.0
  
  # Loading & Progress
  flutter_spinkit: ^5.2.0
  
  # Toast Notifications
  fluttertoast: ^8.2.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
  json_serializable: ^6.7.0
  build_runner: ^2.4.0
```

---

### **6. APP STRUCTURE & SCREENS**

```
lib/
├── main.dart                    # App entry point
├── config/
│   ├── app_config.dart         # App constants, colors, fonts
│   ├── api_config.dart         # API base URL, endpoints
│   └── theme.dart              # Theme configuration
├── models/
│   ├── user.dart               # User/Distributor model
│   ├── consumer.dart           # Consumer model
│   ├── qr_code.dart           # QR code model
│   └── distribution.dart       # Distribution record model
├── services/
│   ├── api_service.dart       # HTTP client with JWT
│   ├── auth_service.dart      # Authentication logic
│   ├── qr_scanner_service.dart # QR scanning logic
│   ├── storage_service.dart   # SharedPreferences wrapper
│   └── distribution_service.dart # Distribution API calls
├── providers/
│   ├── auth_provider.dart     # Auth state management
│   ├── qr_provider.dart       # QR scanning state
│   └── distribution_provider.dart
├── screens/
│   ├── splash_screen.dart
│   ├── login_screen.dart
│   ├── signup_screen.dart
│   ├── home_screen.dart
│   ├── qr_scanner_screen.dart
│   ├── consumer_details_screen.dart
│   ├── scan_history_screen.dart
│   ├── profile_screen.dart
│   └── offline_queue_screen.dart
├── widgets/
│   ├── custom_app_bar.dart
│   ├── custom_button.dart
│   ├── custom_text_field.dart
│   └── result_dialog.dart
└── utils/
    ├── constants.dart
    └── extensions.dart
```

---

### **7. SCREEN SPECIFICATIONS**

#### **Screen 1: Splash Screen**
- Display app logo/title "আমার রেশন"
- Check authentication status
- Auto-navigate to Login or Home based on token

#### **Screen 2: Login Screen - EXACT FORM SPECIFICATIONS**

**Layout:**
- Full white background (#FFFFFF)
- Top padding: 40px, Container width: Full width with 20px horizontal padding
- Centered on screen

**Header Section (Top):**
- App Logo/Icon: 80x80px, centered
- Title Text: "আমার রেশন" (Font: Anek Bangla, Size: 24px, Bold, Color: #1f77b4)
- Subtitle: "ডিস্ট্রিবিউটর লগইন" (Font: Anek Bangla, Size: 14px, Color: #666666)
- Description: "ফিল্ড ডিস্ট্রিবিউটরদের জন্য" (Font: Roboto, Size: 12px, Color: #999999)
- Spacing below header: 30px

**Form Section:**

**Field 1: Email/Phone Input**
- Label: "ইমেইল অথবা ফোন *" (Required, Size: 13px, Bold, Color: #333333)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "ইমেইল (email@example.com) বা ফোন (01712345678)"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Focus border width: 2px
  - Text color: #333333
  - Keyboard type: Email/Phone
- Margin bottom: 16px

**Field 2: Password Input**
- Label: "পাসওয়ার্ড *" (Required, Size: 13px, Bold, Color: #333333)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "আপনার পাসওয়ার্ড"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Focus border width: 2px
  - Text color: #333333
  - Password visibility toggle (Eye icon) on right
  - Icon color: #1f77b4
- Margin bottom: 24px

**Forgot Password Link (Optional):**
- Text: "পাসওয়ার্ড ভুলে গেছেন?" (Size: 12px, Color: #1f77b4)
- Text decoration: Underline on hover
- Alignment: Right
- Margin bottom: 20px

**Login Button:**
- Text: "লগইন করুন" (Size: 16px, Bold, Color: White)
- Background color: #1f77b4
- Border radius: 6px
- Padding: 14px
- Width: 100%
- Height: 48px
- Font weight: 600
- Margin bottom: 16px
- On press: Show loading spinner, disable button
- Shadow: Subtle (elevation: 2)
- Hover effect: Darken to #16679c
- Disabled state: Background #CCCCCC, text #888888

**Sign Up Link Section:**
- Text: "নতুন অ্যাকাউন্ট নেই?" (Size: 13px, Color: #666666)
- Link text: "এখানে সাইন আপ করুন" (Size: 13px, Color: #1f77b4, Bold, Underline)
- Alignment: Center
- Spacing: 8px between text and link

**Error Message Display:**
- If login fails, show error dialog or snackbar at top
- Text color: #dc3545
- Background: Light red (#F8F0F0)
- Icon: ✗ (red)
- Messages to handle:
  - "ইমেইল বা পাসওয়ার্ড ভুল" (Invalid credentials)
  - "নেটওয়ার্ক সংযোগ ব্যর্থ" (Network error)
  - "সার্ভার ত্রুটি, পুনরায় চেষ্টা করুন" (Server error)

---

#### **Screen 3: Sign Up Screen - EXACT FORM SPECIFICATIONS**

**Layout:**
- Full white background (#FFFFFF)
- Top padding: 30px, Container width: Full width with 20px horizontal padding
- Scrollable if content exceeds screen height

**Header Section (Top):**
- Back Arrow Icon: Top left, Size: 24px, Color: #1f77b4
- Title Text: "নতুন অ্যাকাউন্ট তৈরি করুন" (Font: Anek Bangla, Size: 22px, Bold, Color: #1f77b4)
- Subtitle: "ডিস্ট্রিবিউটর রেজিস্ট্রেশন" (Font: Anek Bangla, Size: 13px, Color: #666666)
- Spacing below header: 24px

**Form Section:**

**Field 1: Full Name Input**
- Label: "সম্পূর্ণ নাম *" (Required, Size: 13px, Bold, Color: #333333)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "আপনার সম্পূর্ণ নাম"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Text color: #333333
  - Keyboard type: Text
  - Max length: 50 characters
- Margin bottom: 16px

**Field 2: Email Input**
- Label: "ইমেইল *" (Required, Size: 13px, Bold, Color: #333333)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "ইমেইল@উদাহরণ.com"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Text color: #333333
  - Keyboard type: Email
  - Validation: Must be valid email format
  - Error text if invalid: "বৈধ ইমেইল প্রবেশ করুন" (Size: 12px, Color: #dc3545)
- Margin bottom: 16px

**Field 3: Phone Number Input**
- Label: "ফোন নম্বর *" (Required, Size: 13px, Bold, Color: #333333)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "01712345678"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Text color: #333333
  - Keyboard type: Phone
  - Validation: Must be 11 digits, start with 01
  - Error text if invalid: "বৈধ বাংলাদেশ ফোন নম্বর প্রবেশ করুন" (Size: 12px, Color: #dc3545)
- Margin bottom: 16px

**Field 4: Password Input**
- Label: "পাসওয়ার্ড *" (Required, Size: 13px, Bold, Color: #333333)
- Helper text: "কমপক্ষে ৮ অক্ষর" (Size: 11px, Color: #999999, italics)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "শক্তিশালী পাসওয়ার্ড"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Text color: #333333
  - Password visibility toggle on right
  - Icon color: #1f77b4
  - Minimum length: 8 characters
  - Validation requirements:
    - At least 1 uppercase letter (A-Z)
    - At least 1 lowercase letter (a-z)
    - At least 1 number (0-9)
    - At least 1 special character (!@#$%^&*)
- Password strength indicator bar (below field):
  - Show strength: দুর্বল (Weak) | মাঝারি (Medium) | শক্তিশালী (Strong)
  - Colors: Red → Orange → Green
  - Height: 4px
- Margin bottom: 16px

**Field 5: Confirm Password Input**
- Label: "পাসওয়ার্ড নিশ্চিত করুন *" (Required, Size: 13px, Bold, Color: #333333)
- Margin top: 4px
- TextField properties:
  - Border: 1px solid #CCCCCC
  - Border radius: 6px
  - Padding: 12px
  - Font size: 14px
  - Placeholder: "পাসওয়ার্ড আবার টাইপ করুন"
  - Placeholder color: #AAAAAA
  - Focus border color: #1f77b4
  - Text color: #333333
  - Password visibility toggle on right
  - Icon color: #1f77b4
  - Real-time validation: Match with password field
  - Error text if mismatch: "পাসওয়ার্ড ম্যাচ করে না" (Size: 12px, Color: #dc3545)
- Margin bottom: 24px

**Sign Up Button:**
- Text: "সাইন আপ করুন" (Size: 16px, Bold, Color: White)
- Background color: #1f77b4
- Border radius: 6px
- Padding: 14px
- Width: 100%
- Height: 48px
- Font weight: 600
- Margin bottom: 16px
- On press: Validate all fields, show loading spinner, disable button
- Shadow: Subtle (elevation: 2)
- Hover effect: Darken to #16679c
- Disabled state: Background #CCCCCC, text #888888

**Login Link Section:**
- Text: "ইতিমধ্যে অ্যাকাউন্ট আছে?" (Size: 13px, Color: #666666)
- Link text: "এখানে লগইন করুন" (Size: 13px, Color: #1f77b4, Bold, Underline)
- Alignment: Center
- Margin bottom: 20px

**Error Message Display:**
- Show error for each field in red text below the field
- Show field-level errors:
  - Empty field: "এই ফিল্ড প্রয়োজনীয়" (This field is required)
  - Invalid email: "বৈধ ইমেইল প্রবেশ করুন"
  - Invalid phone: "বৈধ ১১ অঙ্কের ফোন নম্বর প্রবেশ করুন"
  - Short password: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে"
  - Passwords mismatch: "পাসওয়ার্ড ম্যাচ করে না"
  - Email already exists: "এই ইমেইল ইতিমধ্যে নিবন্ধিত" (Email already registered)
  - Phone already exists: "এই ফোন নম্বর ইতিমধ্যে নিবন্ধিত" (Phone already registered)
  - Network error: "নেটওয়ার্ক সংযোগ ব্যর্থ"
  - Server error: "সার্ভার ত্রুটি, পুনরায় চেষ্টা করুন"

**Success on Registration:**
- Show success message: "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!"
- Auto-redirect to Home Screen after 2 seconds with JWT token saved
- Store token in SharedPreferences for persistent login

#### **Screen 4: Home Screen**
- Welcome message: "স্বাগতম, [নাম]"
- Large "QR স্কেন করুন" button (primary blue, center)
- Quick stats cards:
  - আজকের স্কেন (Today's Scans)
  - সফল (Success count)
  - অযোগ্য (Ineligible count)
- Recent scans list (last 5)

#### **Screen 5: QR Scanner Screen**
- Full-screen camera preview
- Red scanning frame overlay in center
- Instructions: "গ্রাহক কার্ড স্কেন করুন" (Scan consumer card)
- Below camera:
  - Torch toggle button (if needed)
  - Switch camera button
  - Cancel button
- Auto-process QR on successful scan

#### **Screen 6: Consumer Details & Eligibility Screen**
- Display consumer information:
  - নাম (Name)
  - পরিবার আইডি (Family ID)
  - কার্ড নম্বর (Card Number)
  - তারিখ (Date)

**Three Possible Outcomes (with appropriate messages/colors):**

**A. Success - Eligible:**
- Background: Light green (#F0F8F0)
- Icon: ✓ (checkmark)
- Title: "সফল!" (Success!)
- Message: "গ্রাহক আজ খাদ্য সংগ্রহের যোগ্য" (Consumer is eligible for ration today)
- Button: "নতুন স্কেন" (New Scan) - Redirect to scanner

**B. Failed - Not Registered:**
- Background: Light red (#F8F0F0)
- Icon: ✗ (cross)
- Title: "ব্যর্থ" (Failed)
- Message: "এই গ্রাহক সিস্টেমে নিবন্ধিত নয়" (Consumer not registered in system)
- Button: "পুনরায় চেষ্টা করুন" (Retry) - Back to scanner

**C. Failed - Not Eligible:**
- Background: Light orange (#FFF8F0)
- Icon: ⚠ (warning)
- Title: "অযোগ্য" (Ineligible)
- Message: "এই গ্রাহক আজকের জন্য খাদ্য সংগ্রহের যোগ্য নয়" (Consumer not eligible for today's ration)
- Additional info: "শেষ সংগ্রহ: [তারিখ]" (Last collection: [date])
- Button: "নতুন স্কেন" (New Scan)

#### **Screen 7: Scan History Screen**
- Bangla title: "স্কেন ইতিহাস"
- List of all scans with:
  - Consumer name
  - Scan time
  - Status (সফল/ব্যর্থ)
  - Timestamp
- Filter options: Today / This Week / All
- Search by consumer name

#### **Screen 8: Profile Screen**
- Display logged-in distributor info:
  - প্রোফাইল ছবি (Profile image)
  - নাম (Name)
  - ইমেইল (Email)
  - ফোন (Phone)
  - লয়গিন সময় (Login time)
- Buttons:
  - পাসওয়ার্ড পরিবর্তন করুন (Change Password)
  - সেটিংস (Settings)
  - লগআউট (Logout) - Red button

---

### **8.1 CROSS-PLATFORM AUTHENTICATION (WEB & MOBILE)**

**CRITICAL: Single Unified Authentication System**

Field Distributors can register on EITHER the web app OR the mobile app using the same backend endpoints. They must be able to login on the OTHER platform with the same credentials.

#### **How It Works:**

**Registration Flow:**
1. **Web App (React/TypeScript):** POST to `/api/auth/signup` with userType: "FieldUser"
2. **Mobile App (Flutter):** POST to `/api/auth/signup` with userType: "FieldUser"
3. **Result:** Both create same user record in MongoDB with identical data structure

**Login Flow:**
1. **Web App (React/TypeScript):** POST to `/api/auth/login` with email or phone
2. **Mobile App (Flutter):** POST to `/api/auth/login` with email or phone
3. **Result:** Both receive JWT token for same user account

#### **Implementation Details:**

**Backend (Already Consistent):**
- Both platforms use the same API endpoints
- Same authentication controller handles both
- Same JWT signing algorithm
- Same password hashing (bcryptjs)
- Same database collection (users)

**Frontend Storage (Platform-Specific):**

**Web App (React - localStorage):**
```javascript
localStorage.setItem('amar_ration_auth', JSON.stringify({
  token: 'jwt_token_here',
  user: {
    id: 'user_id',
    name: 'Field User Name',
    email: 'user@example.com',
    phone: '01712345678',
    userType: 'FieldUser'
  }
}));
```

**Mobile App (Flutter - SharedPreferences):**
```dart
final prefs = await SharedPreferences.getInstance();
await prefs.setString('amar_ration_auth', jsonEncode({
  'token': 'jwt_token_here',
  'user': {
    'id': 'user_id',
    'name': 'Field User Name',
    'email': 'user@example.com',
    'phone': '01712345678',
    'userType': 'FieldUser'
  }
}));
```

#### **Test Scenarios:**

**Scenario 1: Register on Web, Login on Mobile**
1. Sign up on React web app: email "field1@example.com", password "Test@123"
2. Close web app
3. Open Flutter mobile app
4. Login with same email "field1@example.com" and password "Test@123"
5. **Expected Result:** ✅ Login succeeds, same user data loaded

**Scenario 2: Register on Mobile, Login on Web**
1. Sign up on Flutter mobile app: email "field2@example.com", password "Test@456"
2. Close mobile app
3. Open React web app
4. Login with same email "field2@example.com" and password "Test@456"
5. **Expected Result:** ✅ Login succeeds, same user data loaded

**Scenario 3: Simultaneous Login**
1. Field distributor logs in on web app
2. Same user simultaneously logs in on mobile app (different device)
3. **Expected Result:** ✅ Both have valid JWT tokens, can use independently

#### **Password Reset (Future Feature):**
- Password reset initiated on web should work on mobile and vice versa
- Reset token sent to email works on both platforms

#### **Session Management:**
- JWT token valid for 2 hours on both platforms
- Token refresh logic identical on both
- Logout on one platform doesn't affect other (independent sessions)

#### **Database Validation:**
All Field Distributors stored in MongoDB `users` collection with:
```javascript
{
  _id: ObjectId,
  userType: "FieldUser",  // Same for web and mobile
  name: "Field Distributor Name",
  email: "unique_email@example.com",  // Unique constraint
  phone: "+8801712345678",            // Unique constraint
  passwordHash: "bcrypt_hash",        // Same hashing on both
  createdAt: ISODate,
  updatedAt: ISODate,
  // Both platforms can access same user record
}
```

---

### **8. API INTEGRATION DETAILS**

#### **Sign Up Request (Firebase-Style):**
```json
POST /api/auth/signup
HEADERS:
{
  "Content-Type": "application/json"
}
BODY:
{
  "userType": "FieldUser",
  "name": "রহিম আহমেদ",
  "email": "rahim@example.com",
  "phone": "01712345678",
  "password": "SecurePass@123"
}

Response (Success - Status 201):
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "রহিম আহমেদ",
    "email": "rahim@example.com",
    "phone": "01712345678",
    "userType": "FieldUser",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "status": "Active",
    "createdAt": "2026-03-27T10:30:00.000Z"
  }
}

Response (Error - Email Already Exists - Status 409):
{
  "success": false,
  "message": "User with this email or phone already exists"
}

Response (Error - Invalid Data - Status 400):
{
  "success": false,
  "message": "UserType, name, and password are required"
}
```

#### **Login Request (Both Web & Mobile Use Same Endpoint):**
```json
POST /api/auth/login
HEADERS:
{
  "Content-Type": "application/json"
}
BODY (Option 1 - Via Email):
{
  "email": "rahim@example.com",
  "password": "SecurePass@123"
}

BODY (Option 2 - Via Phone):
{
  "phone": "01712345678",
  "password": "SecurePass@123"
}

Response (Success - Status 200):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "রহিম আহমেদ",
    "email": "rahim@example.com",
    "phone": "01712345678",
    "userType": "FieldUser",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "status": "Active",
    "loginTime": "2026-03-27T10:35:00.000Z"
  }
}

Response (Error - Invalid Password - Status 401):
{
  "success": false,
  "message": "Invalid email/phone or password"
}

Response (Error - User Not Found - Status 404):
{
  "success": false,
  "message": "User not found"
}

Response (Error - Network Error - Status 0):
{
  "success": false,
  "message": "Network connection failed"
}
```

#### **JWT Token Details:**
```
Token Expiry: 2 hours
Token Format: Bearer <token>
Storage: 
  - Web: localStorage with key "amar_ration_auth"
  - Mobile: SharedPreferences with key "amar_ration_auth"
Token Validation: Check expiry before API calls, prompt re-login if expired
Token Header Format for API Calls:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **Form Validation Rules (Client-Side):**

**Sign Up Validations (Real-Time):**
- Name: 
  - Min 3 characters, Max 50 characters
  - Letters and spaces only
  - Required field
  
- Email:
  - Valid email format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
  - Check uniqueness via API (optional live check)
  - Required field
  
- Phone:
  - Exactly 11 digits
  - Must start with 01
  - Bangladeshi format: 01[0-9]{9}
  - Check uniqueness via API (optional live check)
  - Required field
  
- Password:
  - Minimum 8 characters
  - Must contain at least 1 uppercase letter (A-Z)
  - Must contain at least 1 lowercase letter (a-z)
  - Must contain at least 1 digit (0-9)
  - Must contain at least 1 special character (!@#$%^&*)
  - Required field
  - Show password strength indicator
  
- Confirm Password:
  - Must match Password field exactly
  - Real-time comparison as user types
  - Required field

**Login Validations (Real-Time):**
- Email/Phone:
  - If email format detected: validate as email
  - If phone format detected: validate as phone (11 digits, starts with 01)
  - At least one must be provided
  
- Password:
  - Non-empty (at least 1 character)
  - Maximum 100 characters
  - Required field

**Backend Validation (Security):**
- Duplicate email/phone check in database
- Password hash comparison with bcryptjs
- JSON schema validation with Zod
- Rate limiting on failed attempts (recommended)

#### **QR Scan Request:**
```json
POST /api/distribution/scan
Headers:
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
}
Body:
{
  "qrToken": "scanned_qr_hash_value"
}

Response (Success/Eligible):
{
  "success": true,
  "message": "সফল - খাদ্য সংগ্রহের যোগ্য",
  "data": {
    "consumer": {
      "id": "consumer_id",
      "name": "গ্রাহক নাম",
      "familyId": "FAM123456",
      "consumerCode": "CON123456"
    },
    "eligible": true,
    "reason": "eligible_for_today",
    "lastCollectionDate": "2026-03-26",
    "token": "token_id"
  }
}

Response (Not Registered):
{
  "success": false,
  "message": "গ্রাহক সিস্টেমে নিবন্ধিত নয়",
  "data": {
    "eligible": false,
    "reason": "consumer_not_found"
  }
}

Response (Not Eligible):
{
  "success": false,
  "message": "আজকের জন্য পাত্র নয়",
  "data": {
    "eligible": false,
    "reason": "already_collected_today",
    "lastCollectionDate": "2026-03-27"
  }
}
```

---

### **9. STORAGE & CACHING**

**SharedPreferences(Local Storage):**
```
- "auth_token" → JWT token
- "user_id" → Current user ID
- "user_name" → Current user name
- "user_email" → Current user email
- "last_sync_time" → Last API sync timestamp
- "offline_scans" → JSON array of offline scans (for offline queue)
```

**Offline Queue:**
- When offline, save QR scans locally
- When back online, sync with backend
- Show "অফলাইন মোড" (Offline Mode) indicator
- Display pending syncs count

---

### **10. ERROR HANDLING & VALIDATION**

**Handle All Errors Gracefully:**
- Network errors: "নেটওয়ার্ক সংযোগ ব্যর্থ" (Network connection failed)
- Invalid credentials: "ইমেইল বা পাসওয়ার্ড ভুল" (Invalid email or password)
- Expired token: "সেশন মেয়াদ উত্তীর্ণ" (Session expired, log in again)
- Server errors: "সার্ভার ত্রুটি, পুনরায় চেষ্টা করুন" (Server error, try again)
- Invalid QR: "অবৈধ QR কোড" (Invalid QR code)

**Toast Notifications for:**
- Successful login
- Successful scan
- Network status changes
- Sync updates

---

### **11.1 FLUTTER AUTHENTICATION SERVICE IMPLEMENTATION GUIDE**

**Essential for Cross-Platform Compatibility:**

#### **auth_service.dart Implementation Requirements:**

```dart
class AuthService {
  static const String _baseUrl = 'http://localhost:5000/api';
  static const String _tokenKey = 'amar_ration_auth';
  
  // Sign Up Method (Called from SignUp Screen)
  Future<AuthResponse> signup({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/auth/signup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userType': 'FieldUser',  // CRITICAL: Always use FieldUser
          'name': name,
          'email': email.toLowerCase(),  // Normalize email
          'phone': phone,
          'password': password,
        }),
      );
      
      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        // Store token and user data
        await _saveAuthData(data['data']);
        return AuthResponse.success(data['data']);
      } else {
        return AuthResponse.error(response.body);
      }
    } catch (e) {
      return AuthResponse.error('নেটওয়ার্ক সংযোগ ব্যর্থ');
    }
  }
  
  // Login Method (Called from Login Screen)
  // IMPORTANT: Supports both email and phone login
  Future<AuthResponse> login({
    required String emailOrPhone,
    required String password,
  }) async {
    try {
      // Determine if input is email or phone
      Map<String, dynamic> loginBody = {
        'password': password,
      };
      
      if (emailOrPhone.contains('@')) {
        loginBody['email'] = emailOrPhone.toLowerCase();
      } else {
        loginBody['phone'] = emailOrPhone;
      }
      
      final response = await http.post(
        Uri.parse('$_baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(loginBody),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        // Store token and user data
        await _saveAuthData(data['data']);
        return AuthResponse.success(data['data']);
      } else if (response.statusCode == 401) {
        return AuthResponse.error('ইমেইল বা পাসওয়ার্ড ভুল');
      } else if (response.statusCode == 404) {
        return AuthResponse.error('ব্যবহারকারী খুঁজে পাওয়া যায়নি');
      } else {
        return AuthResponse.error('লগইন ব্যর্থ হয়েছে');
      }
    } catch (e) {
      return AuthResponse.error('নেটওয়ার্ক সংযোগ ব্যর্থ');
    }
  }
  
  // Save Auth Data to SharedPreferences
  Future<void> _saveAuthData(Map<String, dynamic> userData) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, jsonEncode(userData));
  }
  
  // Get Saved Auth Token
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    final authData = prefs.getString(_tokenKey);
    if (authData != null) {
      final data = jsonDecode(authData);
      return data['token'];
    }
    return null;
  }
  
  // Get Current User
  Future<Map<String, dynamic>?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final authData = prefs.getString(_tokenKey);
    if (authData != null) {
      return jsonDecode(authData);
    }
    return null;
  }
  
  // Logout (Clear all stored data)
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }
}
```

#### **API Service with JWT Headers:**

```dart
class ApiService {
  static const String _baseUrl = 'http://localhost:5000/api';
  final AuthService _authService = AuthService();
  
  // Generic GET request with JWT
  Future<http.Response> get(String endpoint) async {
    final token = await _authService.getToken();
    return http.get(
      Uri.parse('$_baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );
  }
  
  // Generic POST request with JWT
  Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    final token = await _authService.getToken();
    return http.post(
      Uri.parse('$_baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode(body),
    );
  }
}
```

#### **Critical Implementation Points:**

1. **Always check for existing auth before navigating:**
   - On app launch, check if token exists in SharedPreferences
   - If exists and valid, go to Home Screen
   - If not, go to Login Screen

2. **Token expiry handling:**
   - Check token expiry before making API calls
   - If expired (> 2 hours), show message: "সেশন মেয়াদ উত্তীর্ণ, পুনরায় লগইন করুন"
   - Force logout and redirect to Login Screen

3. **Email normalization:**
   - Convert email to lowercase before sending to API
   - This ensures "User@Example.com" and "user@example.com" are treated same

4. **Phone number consistency:**
   - Store phone exactly as provided by user (01712345678)
   - Do not add country code prefix unless user included

5. **UI State Management with Provider:**
   ```dart
   class AuthProvider extends ChangeNotifier {
     bool? _isLoggedIn;
     Map<String, dynamic>? _user;
     bool _isLoading = false;
     String? _error;
     
     // Constructor: Check if user already logged in
     AuthProvider() {
       _initializeAuth();
     }
     
     Future<void> _initializeAuth() async {
       final user = await AuthService.getCurrentUser();
       _isLoggedIn = user != null;
       _user = user;
       notifyListeners();
     }
     
     Future<void> login(String emailOrPhone, String password) async {
       _isLoading = true;
       _error = null;
       notifyListeners();
       
       final result = await AuthService.login(
         emailOrPhone: emailOrPhone,
         password: password,
       );
       
       if (result.success) {
         _isLoggedIn = true;
         _user = result.data;
         _error = null;
       } else {
         _isLoggedIn = false;
         _error = result.message;
       }
       
       _isLoading = false;
       notifyListeners();
     }
     
     Future<void> logout() async {
       await AuthService.logout();
       _isLoggedIn = false;
       _user = null;
       _error = null;
       notifyListeners();
     }
     
     bool get isLoggedIn => _isLoggedIn ?? false;
     Map<String, dynamic>? get user => _user;
     bool get isLoading => _isLoading;
     String? get error => _error;
   }
   ```

---

### **11. SECURITY REQUIREMENTS**

✅ Store JWT tokens securely in SharedPreferences
✅ Add token to Authorization header for all authenticated requests
✅ Validate JWT expiry and refresh if needed
✅ Never store passwords locally
✅ HTTPS only in production
✅ SSL certificate pinning (recommended)
✅ Input validation on all forms

---

### **12. ADDITIONAL FEATURES (Future Enhancements)**

- Push notifications for important alerts
- Distributor statistics dashboard
- Sync logs and diagnostics
- Biometric login (fingerprint/face)
- Dark mode support
- Multiple language support (English, Bangla)

---

### **13. TESTING REQUIREMENTS**

✅ Test with real backend API
✅ Test with multiple network conditions (offline, slow, fast)
✅ Test with invalid QR codes
✅ Test token expiry and refresh
✅ Test edge cases (empty lists, long names, etc.)
✅ UI responsiveness on different screen sizes

---

### **14. DEPLOYMENT & BUILD**

**Android:**
- Minimum SDK: Android 8.0 (API 26)
- Target SDK: Android 14+ (API 34+)
- Build APK & AAB for Play Store

**iOS:**
- Minimum: iOS 11.0
- Build IPA for TestFlight & App Store
- Request camera permission for QR scanner

**Environment Variables (.env template):**
```
FLUTTER_API_BASE_URL=http://localhost:5000/api
FLUTTER_API_TIMEOUT=30
JWT_STORAGE_KEY=amar_ration_flutter
```

---

### **STARTING POINT**

1. Create Flutter project: `flutter create amar_ration_distributor`
2. Add dependencies (as listed in section 5)
3. Create folder structure (as listed in section 6)
4. Implement models with JSON serialization
5. Build API service with Dio/HTTP package
6. Implement authentication flow
7. Build QR scanner screen
8. Implement eligibility check logic
9. Build UI screens with theme consistency
10. Test with real backend

---

## **CRITICAL CROSS-PLATFORM AUTHENTICATION CHECKLIST**

### **BEFORE STARTING DEVELOPMENT, ENSURE THE FOLLOWING:**

#### **Backend Verification (Already Done):**
- ✅ Backend auth endpoints support both platforms (checked `/api/auth/signup` and `/api/auth/login`)
- ✅ JWT token generation is consistent (checked auth.controller.js)
- ✅ Password hashing with bcryptjs (checked package.json - bcryptjs is installed)
- ✅ MongoDB unique constraints on email and phone (must verify in User model)
- ✅ Database accepts "FieldUser" as valid userType (checked - already supported)

#### **Verify User Model for Email & Phone Uniqueness:**
Before publishing the Flutter app, verify that the User model in MongoDB has unique indexes:
```javascript
// In User.js model, ensure these exist:
email: { type: String, unique: true, sparse: true }
phone: { type: String, unique: true, sparse: true }
```

If not already set, run the backend setup command:
```bash
npm run indexes  # Creates required MongoDB indexes
```

---

### **EXACT TESTING SCENARIOS FOR CROSS-PLATFORM COMPATIBILITY**

#### **Test Case 1: Web Registration → Mobile Login**
**Steps:**
1. Open React web app at http://localhost:3000
2. Click "সাইন আপ করুন" (Sign Up)
3. Fill form with test data:
   - নাম: "আবির আহমেদ"
   - ইমেইল: "abir.test@example.com"
   - ফোন: "01799999999"
   - পাসওয়ার্ড: "TestPass@123"
4. Submit form
5. ✅ Should see success message and redirect to dashboard
6. Note the JWT token from localStorage (browser dev tools)

**Then:**
7. Close web app
8. Open Flutter mobile app
9. Click "এখানে লগইন করুন" (Already have account)
10. Enter:
    - ইমেইল অথবা ফোন: "abir.test@example.com" (same email from step 3)
    - পাসওয়ার্ড: "TestPass@123" (same password from step 3)
11. ✅ **Expected Result:** Login succeeds, same user profile loaded on mobile
12. Verify user name "আবির আহমেদ" displays on mobile home screen

#### **Test Case 2: Mobile Registration → Web Login**
**Steps:**
1. Open Flutter mobile app
2. Click "নতুন অ্যাকাউন্ট তৈরি করুন" (Sign Up)
3. Fill form with test data:
   - নাম: "করিম হাসান"
   - ইমেইল: "karim.test@example.com"
   - ফোন: "01888888888"
   - পাসওয়ার্ড: "SecurePass@456"
4. Submit form
5. ✅ Should see success message and redirect to home screen
6. Note the JWT token from SharedPreferences

**Then:**
7. Close mobile app
8. Open React web app at http://localhost:3000
9. Click "লগইন করুন" (Already have account)
10. Enter:
    - ইমেইল: "karim.test@example.com" (same email from step 3)
    - পাসওয়ার্ড: "SecurePass@456" (same password from step 3)
11. ✅ **Expected Result:** Login succeeds, same user dashboard loads on web
12. Verify user name "করিম হাসান" displays on web dashboard

#### **Test Case 3: Phone Number Login (Both Platforms)**
**Setup:** Register a user with email "test1@example.com" and phone "01777777777" on web app

**Web Test:**
1. Open React web app
2. Login using phone number instead of email:
   - ইমেইল: "01777777777" (use phone)
   - পাসওয়ার্ড: "YourPassword@123"
3. ✅ Should login successfully

**Mobile Test:**
4. Open Flutter app
5. Login using email:
   - ইমেইল অথবা ফোন: "test1@example.com" (use email)
   - পাসওয়ার্ড: "YourPassword@123"
6. ✅ Should login successfully (same user)

#### **Test Case 4: Invalid Credentials (Both Platforms)**
**Web:**
1. Try login with: email "user@example.com", password "WrongPassword"
2. ✅ Should show error: "ইমেইল বা পাসওয়ার্ড ভুল"

**Mobile:**
3. Try login with: phone "01712345678", password "WrongPassword"
4. ✅ Should show error: "ইমেইল বা পাসওয়ার্ড ভুল"

#### **Test Case 5: Duplicate Email/Phone (Both Platforms)**
**Web:**
1. Register user with email "unique1@example.com"
2. Try to register another user with same email
3. ✅ Should show error: "User with this email or phone already exists"

**Mobile:**
4. Try to register another user with same phone from previous user
5. ✅ Should show error: "User with this email or phone already exists"

#### **Test Case 6: Token Persistence (Both Platforms)**
**Web:**
1. Login successfully
2. Refresh browser page (F5)
3. ✅ Should stay logged in (token from localStorage)
4. Navigate to dashboard without re-login needed

**Mobile:**
5. Login successfully
6. Close app completely
7. Reopen app
8. ✅ Should directly go to home screen (token from SharedPreferences)
9. User name should display in profile

#### **Test Case 7: Simultaneous Sessions**
**Setup:** Have both web and mobile apps accessible

1. Login on web app with user "distributor1@example.com"
2. Simultaneously login on mobile app with same email and password
3. ✅ Both should have valid JWT tokens
4. On web: User can scan consumer QR codes
5. On mobile: User can also scan consumer QR codes
6. Logout from web app
7. ✅ Mobile app should still have valid session (independent)

#### **Test Case 8: Email Normalization**
**Scenario:** Test that different email cases work

**Web:**
1. Register with email "Test.User@EXAMPLE.COM" (mixed case)
2. ✅ Should register successfully (backend converts to lowercase)

**Mobile:**
3. Try to login with "test.user@example.com" (lowercase)
4. ✅ Should login successfully (same user as step 1)
5. Try to register with "TEST.USER@EXAMPLE.COM" (uppercase)
6. ✅ Should show error: "User with this email already exists"

---

### **FIELD-BY-FIELD FORM VALIDATION SUMMARY**

#### **Sign Up Form - Validation Rules:**

| Field | Min | Max | Format | Required | Case-Sensitive | Error Message (Bangla) |
|-------|-----|-----|--------|----------|-----------------|------------------------|
| Name | 3 | 50 | Letters & spaces | Yes | No | নাম ৩-৫০ অক্ষর হতে হবে |
| Email | 5 | 100 | user@domain.com | Yes | No (normalized) | বৈধ ইমেইল প্রবেশ করুন |
| Phone | 11 | 11 | 01XXXXXXXXX | Yes | No | বৈধ ফোন নম্বর প্রবেশ করুন |
| Password | 8 | 100 | [A-Z][a-z][0-9][!@#$%^&*] | Yes | Yes | পাসওয়ার্ড শক্তিশালী হতে হবে |
| Confirm Pwd | 8 | 100 | Must match password | Yes | Yes | পাসওয়ার্ড ম্যাচ করে না |

#### **Login Form - Validation Rules:**

| Field | Format | Required | Note |
|-------|--------|----------|------|
| Email/Phone | email OR 01XXXXXXXXX | Yes | Auto-detect based on input |
| Password | 1-100 chars | Yes | Case-sensitive |

#### **Backend Validation (POST Requests):**
- Email & Phone uniqueness checked in MongoDB
- Password verified with bcryptjs.compare()
- Invalid userType returns 400 error
- Duplicate user returns 409 error
- Invalid credentials return 401 error
- Server errors return 500 error

---

### **IMPORTANT NOTES FOR FLUTTER DEVELOPER**

1. **Always use SharedPreferences** for token storage (not secured storage for this MVP)
   - For production, consider flutter_secure_storage

2. **Email Normalization is Critical:**
   ```dart
   // Always normalize email before sending
   email = email.toLowerCase().trim();
   ```

3. **Phone Number Handling:**
   - Accept: "01712345678" (11 digits)
   - Pattern: `[01][0-9]{10}`
   - Never add country code unless user provides it

4. **Password Strength Indicator:**
   - Show real-time feedback while typing
   - Display: দুর্বল (Red) → মাঝারি (Orange) → শক্তিশালী (Green)

5. **One Token Per App:**
   - One user can have separate tokens on web and mobile
   - They don't interfere with each other
   - Logout on mobile doesn't affect web token

6. **Handle All HTTP Status Codes:**
   - 201: Signup success
   - 200: Login success
   - 400: Bad request (validation error)
   - 401: Unauthorized (wrong password)
   - 404: Not found (user doesn't exist)
   - 409: Conflict (duplicate email/phone)
   - 500: Server error

7. **Database Keys Consistency:**
   - Web: `amar_ration_auth` in localStorage
   - Mobile: `amar_ration_auth` in SharedPreferences
   - Keep SAME KEY NAME for consistency

8. **JWT Token Inspection (For Debugging):**
   ```
   JWT tokens from this system are valid for 2 hours
   You can decode them at jwt.io for inspection
   Token structure: header.payload.signature
   ```

---

### **FINAL VERIFICATION BEFORE SUBMISSION**

Before giving this instruction file to Copilot or another developer:

- ✅ Read entire FLUTTER_APP_INSTRUCTIONS.md (you're reading it)
- ✅ Understand cross-platform authentication flow (section 8.1)
- ✅ Review exact form specifications (sections 2.0 screen specs)
- ✅ Check all validation rules and error messages
- ✅ Confirm UI colors match exactly (#1f77b4, #16679c, etc.)
- ✅ Verify all Bangla text is correct (double-check with native speaker)
- ✅ Run all 8 test cases provided above
- ✅ Ensure backend is running on http://localhost:5000
- ✅ Verify MongoDB is accessible with correct database name
- ✅ Test with both development and production API URLs

---

**This comprehensive specification ensures that both the React web app and Flutter mobile app users can seamlessly authenticate and use the same backend system.  All field distributors can register on either platform and login on the other with the same credentials.**

**Last Updated:** March 27, 2026  
**Status:** Production-Ready  
**Version:** 1.0
