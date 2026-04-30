# 📦 Amar Ration — Smart OMS Ration Distribution System

> “একসাথে নিশ্চিত করি খাদ্যের নিরাপত্তা।”  
> *Ensuring food security together.*

---

## 📌 Overview

**Amar Ration** is a secure, digital, and automated **Open Market Sale (OMS) ration distribution system** designed to reduce fraud, inefficiency, inaccurate weighing, and lack of transparency in traditional ration distribution.

The system combines a web-based administration platform, distributor dashboard, Flutter field distributor app, QR-based beneficiary validation, IoT smart weighing, stock management, audit logs, and reporting features.

This project was developed as part of:

> **CSE 3200 – System Development Project**  
> Department of Computer Science and Engineering  
> Khulna University of Engineering & Technology (KUET), Bangladesh

---

## 🚨 Problem Statement

Traditional ration distribution systems often suffer from:

- ID fraud and duplicate beneficiaries
- Manual paper-based ledger maintenance
- Inaccurate ration weighing
- Lack of real-time monitoring
- Weak beneficiary verification
- Limited transparency in stock movement
- Difficulty tracking complaints, appeals, and distribution history

---

## 💡 Proposed Solution

**Amar Ration** introduces a digitally verified, secure, and automated OMS ration distribution system with:

- QR-based digital ration cards
- HMAC-signed QR payloads
- Multi-step beneficiary validation
- Role-based dashboards
- IoT smart weight verification
- Real-time inventory tracking
- Complaint and appeal handling
- Immutable audit logging
- Reports and analytics

---

## 🏗️ System Architecture

### Client Layer

- **Admin Dashboard** — React + TypeScript
- **Distributor Dashboard** — React + TypeScript
- **Field Distributor App** — Flutter
- **IoT Smart Scale** — ESP32, HX711 load cell, LCD display

### API Layer

- Node.js
- Express.js
- REST API
- JWT authentication
- Role-Based Access Control middleware

### Data Layer

- MongoDB
- Multiple domain models
- AES-256-GCM encrypted sensitive data
- Scheduled background tasks
- Audit logs and stock ledger records

---

## 🔐 Security Features

- JWT-based authentication
- Refresh token rotation
- Role-Based Access Control (RBAC)
- AES-256-GCM encryption for sensitive NID data
- HMAC-SHA256 signed QR codes
- TOTP-based two-factor authentication
- Bcrypt password hashing
- Password reset and forced password change support
- Immutable audit logs
- Rate limiting and brute-force protection

---

## 🔍 QR Validation Pipeline

Every QR scan goes through a strict validation flow before a beneficiary can receive ration.

1. QR record exists
2. HMAC signature is valid
3. QR is not expired or revoked
4. Ward/division matches distributor area
5. Consumer is not blacklisted
6. No unresolved duplicate family conflict exists
7. Consumer account is active
8. OMS card is active
9. Distribution session is valid and open
10. No duplicate token has already been issued for the same session

---

## 👥 User Roles

| Role | Description |
|---|---|
| **Admin** | Full system control, user management, QR/card control, stock allocation, policy configuration, reports, complaints, and appeals |
| **Distributor** | Ward-level ration distribution, session management, beneficiary verification, stock handling, and reporting |
| **Field Distributor** | Uses the Flutter mobile app to scan QR cards and verify eligibility in the field |
| **Consumer** | Registered OMS beneficiary who receives ration using a QR-based ration card |

---

## 🗄️ Database Design

Core entities include:

- `User`
- `Consumer`
- `OMSCard`
- `QRCode`
- `DistributionSession`
- `Token`
- `DistributionRecord`
- `StockLedger`
- `AuditLog`
- `BlacklistAppeal`

These models support authentication, beneficiary management, QR card control, session tracking, stock movement, distribution verification, and audit reporting.

---

## 🧑‍💻 Main Modules

### Admin Module

The admin module provides full system control.

Key features:

- KPI dashboard
- Distributor registration and approval
- Consumer registration and management
- Family and duplicate beneficiary checking
- QR card generation, rotation, revocation, and printing
- Distribution session monitoring
- Stock allocation and inventory tracking
- Complaint and blacklist appeal handling
- Policy and system settings
- Audit logs and reports

---

### Distributor Module

The distributor module supports ward-level ration distribution.

#### Distribution Workflow

```text
Open Session → Scan QR → Issue Token → Weigh Ration → Record Stock OUT → Print Receipt → Close Session
```

Key features:

- Session management
- Beneficiary list management
- QR scanning and eligibility checking
- Token issuing
- Stock planning
- Real-time queue monitoring
- Weight mismatch detection
- KPI reports and CSV export
- Audit log viewing

---

### Flutter Field Distributor App

The mobile app is designed for field distributors who verify consumers using QR cards.

Key features:

- Secure login
- Forced password change on first login
- QR code scanning
- Eligibility verification
- Scan history
- Offline queue support
- Server-side validation enforcement

---

### IoT Smart Weight Scale

The IoT smart scale helps verify whether the correct quantity of ration is distributed.

#### Hardware Components

- ESP32 microcontroller
- HX711 load cell amplifier
- Load cell sensor
- 16×2 I2C LCD display
- Product selection buttons
- Wi-Fi or access point fallback configuration

#### IoT Workflow

1. Device boots and connects to Wi-Fi
2. Device fetches product weight thresholds from the backend
3. Distributor selects the product type
4. Scale measures the actual weight
5. Device sends the weight data to the backend
6. Backend compares expected and actual quantity
7. System records the distribution
8. Admin/distributor receives alert if mismatch exceeds threshold

---

## 🖼️ Project Screenshots and Diagrams

### IoT Smart Scale

| Scale View 1 | Scale View 2 |
|---|---|
| <img width="320" alt="scale03" src="https://github.com/user-attachments/assets/80ce02df-b424-4d3c-8130-7db4073577f0" /> | <img width="320" alt="scale02" src="https://github.com/user-attachments/assets/e9104a23-ecee-4875-a96f-2c77bbdef4ea" /> |

| Scale View 3 |
|---|
| <img width="320" alt="scale01" src="https://github.com/user-attachments/assets/800c2250-b91e-42fc-bff8-66228ed47faf" /> |

---

### System Diagrams

| Use Case Diagram | Activity Diagram |
|---|---|
| <img width="420" alt="UseCase OSM drawio" src="https://github.com/user-attachments/assets/841c83f4-5a00-4da3-bbcd-1926a3cc655a" /> | <img width="420" alt="ActivityOMS drawio" src="https://github.com/user-attachments/assets/fe8c9e6c-56e5-419f-968e-74bb11816f73" /> |

---

### Ration Card and QR Print Preview

| Ration Card | QR Print Preview | QR Print Preview 2 |
|---|---|---|
| <img width="300" alt="ration card" src="https://github.com/user-attachments/assets/dacb30f5-cc69-461a-b90a-8b50d087f9e5" /> | <img width="300" alt="qr print preview" src="https://github.com/user-attachments/assets/65ddf836-18e7-49c6-b55f-11a1d0d8e0cd" /> | <img width="300" alt="qr print preview2" src="https://github.com/user-attachments/assets/139a7ee9-10a5-4e22-bc86-3397bc957e21" /> |

---

### Gantt Charts

| Gantt Chart 1 | Gantt Chart 2 |
|---|---|
| <img width="420" alt="gantt_ar2 drawio" src="https://github.com/user-attachments/assets/54ba27c1-4c88-47cd-8365-67828f5dbd11" /> | <img width="420" alt="gantt_ar1 drawio" src="https://github.com/user-attachments/assets/ef1cba62-6291-46d4-9268-0f3ee75054f3" /> |

---

### Entity Relationship Diagrams

| ER Diagram 1 | ER Diagram 2 | ER Diagram 3 |
|---|---|---|
| <img width="300" alt="ER2 drawio" src="https://github.com/user-attachments/assets/37b4799c-fb50-4aac-8da2-25c90b70206f" /> | <img width="300" alt="ER1 drawio" src="https://github.com/user-attachments/assets/18bab46a-6093-4421-8353-f9b508b34f43" /> | <img width="300" alt="ER3 drawio" src="https://github.com/user-attachments/assets/be95389c-1332-4e90-ab72-c70cdf84d0b7" /> |

---

### Email Notifications

| Email Screenshot 1 | Email Screenshot 2 | Email Screenshot 3 | Email Screenshot 4 |
|---|---|---|---|
| <img width="210" alt="emails (1)" src="https://github.com/user-attachments/assets/8fb8ccc1-c62b-4fac-8ccb-e93770b2a7f8" /> | <img width="210" alt="emails (4)" src="https://github.com/user-attachments/assets/324e56a4-1ca1-42ef-bbd7-414226886f54" /> | <img width="210" alt="emails (3)" src="https://github.com/user-attachments/assets/d5aaa3ea-a1d9-4965-8d65-244372b485ac" /> | <img width="210" alt="emails (2)" src="https://github.com/user-attachments/assets/b8f2d05d-186b-4332-b790-cd8be9a682fe" /> |

---

### Flutter App Screenshots

| App Screenshot 1 | App Screenshot 2 | App Screenshot 3 |
|---|---|---|
| <img width="250" alt="app1 (3)" src="https://github.com/user-attachments/assets/91423873-0767-411c-bf7c-68d62c8ddd70" /> | <img width="250" alt="app1 (5)" src="https://github.com/user-attachments/assets/806b5683-e7b0-43ba-88a8-0ea5fa15eaa9" /> | <img width="250" alt="app1 (4)" src="https://github.com/user-attachments/assets/cd26f64b-b37e-4660-8e86-204cd5ce8701" /> |

---

## ⚙️ Tech Stack

### Frontend

- React
- TypeScript
- Flutter

### Backend

- Node.js
- Express.js
- REST API

### Database

- MongoDB

### IoT

- ESP32
- HX711
- Load cell
- I2C LCD

### Security

- JWT
- Refresh token rotation
- AES-256-GCM
- HMAC-SHA256
- Bcrypt
- 2FA/TOTP
- RBAC

---

## 🧪 Testing

The project was tested using multiple testing approaches.

- **Unit Testing:** Individual modules such as authentication, beneficiary, token, stock, and QR validation were tested separately.
- **Integration Testing:** API request-response flows were tested using Postman.
- **Functional Testing:** Complete role-based workflows were tested for admin, distributor, field distributor, and consumer-related operations.
- **Security Testing:** Authentication, JWT expiry, 2FA, QR tampering, and protected routes were tested.
- **Usability Testing:** User flows were reviewed for clarity and task completion.
- **Performance Testing:** Concurrent QR scan and distribution-related operations were checked for responsiveness.

---

## 📊 Key Features

- Secure role-based authentication
- Admin and distributor dashboards
- QR-based ration card verification
- HMAC-signed QR payloads
- Consumer and family management
- Token-based ration distribution
- Stock ledger and inventory tracking
- IoT weight verification
- Weight mismatch detection
- Complaint and appeal handling
- Email notifications
- Reports and analytics
- Immutable audit logs

---

## ⚠️ Limitations

- No direct government NID API integration
- Academic-scale dataset
- Not officially deployed in a government environment
- IoT hardware requires stronger field-ready enclosure for production use
- Large-scale deployment requires further performance and security validation

---

## 🚀 Future Work

- Government NID API integration
- Biometric or e-KYC verification
- Predictive stock analytics
- Real-time alert system using WebSocket or Server-Sent Events
- Multi-ward pilot deployment
- Stronger IoT hardware enclosure
- Advanced fraud analytics
- SMS notification support

---

## 👨‍👩‍👧 Team

| Name | Roll | Contribution |
|---|---|---|
| **Afifa Sultana** | 2107087 | Backend, admin panel, authentication, QR system, token system |
| **Shormi Ghosh** | 2107109 | Field distributor app, beneficiary management, stock management, reports |

---

## 🧭 Setup Instructions

Follow the steps below to run the project locally.

### Prerequisites

Make sure the following tools are installed:

- Node.js
- npm
- MongoDB
- Flutter SDK
- Android Studio or a connected physical Android device
- Git

---

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

This will:

- Install backend dependencies
- Start the Node.js/Express development server
- Connect the backend to MongoDB using the configured environment variables

---

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

This will:

- Install all frontend dependencies
- Start the React development server
- Open the web dashboard locally

Default frontend URL:

```text
http://localhost:3000
```

---

### Flutter Mobile App Setup

```bash
cd mobile_app
flutter pub get
flutter run
```

This will:

- Fetch Flutter dependencies
- Build the mobile app
- Run the app on an emulator or physical device

Make sure an Android emulator is running or a physical device is connected before running the app.

---

## 🔑 Environment Variables

Create a `.env` file in the backend root directory and configure the following values:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
AES_KEY=your_encryption_key
HMAC_SECRET=your_qr_secret
```

### Environment Variable Description

| Variable | Description |
|---|---|
| `PORT` | Backend server port |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key used for JWT authentication |
| `AES_KEY` | Encryption key used for sensitive data such as NID |
| `HMAC_SECRET` | Secret used to sign and verify QR codes |

> ⚠️ Keep these values secure. Do not commit real secrets to GitHub or any public repository.

---

## 📜 License

This project is developed for **academic purposes only**.

It is not licensed for commercial, production, or government deployment without proper review, approval, and authorization.

---

## 🙏 Acknowledgement

We would like to express our sincere gratitude to:

- **Dr. Kazi Md. Rokibul Alam** — Project Supervisor
- **Department of Computer Science and Engineering, KUET**
- Field participants, OMS stakeholders, and contributors

Their guidance, feedback, and support were invaluable in the successful completion of this project.

---

## 📣 Final Note

**Amar Ration** is a step toward transparent, secure, and efficient public food distribution.

By combining digital identity verification, QR-based ration cards, IoT weight validation, stock tracking, and real-time auditing, the system aims to improve accountability and reduce leakage in OMS ration distribution.
