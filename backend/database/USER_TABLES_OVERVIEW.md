# Database Tables for 3 User Types - Quick Reference

## 📊 THREE SEPARATE USER TABLES

### 1️⃣ CENTRAL_ADMINS Table
```sql
central_admins
├── id (PRIMARY KEY)
├── name
├── email (UNIQUE)
├── password_hash
├── phone
├── profile_image
├── status (active/inactive/suspended)
├── created_at
├── updated_at
└── last_login
```

**Powers:**
- ✅ Approves distributors
- ✅ System-wide monitoring
- ✅ Access all reports
- ✅ Manage products
- ✅ Configure system settings

---

### 2️⃣ DISTRIBUTORS Table
```sql
distributors
├── id (PRIMARY KEY)
├── name
├── email (UNIQUE)
├── password_hash
├── phone
├── ward_no ⭐
├── office_address ⭐
├── license_number ⭐
├── district
├── upazila
├── profile_image
├── status (active/inactive/suspended)
├── created_at
├── updated_at
├── last_login
├── approved_by (FK → central_admins) ⭐
└── approved_at
```

**Powers:**
- ✅ Register consumers
- ✅ Assign field distributors
- ✅ Manage stock/inventory
- ✅ Oversee distributions in ward
- ✅ Generate ward reports

**Special Fields:**
- `ward_no` - Assigned ward
- `office_address` - Physical office location
- `license_number` - Government license
- `approved_by` - Which central admin approved them

---

### 3️⃣ FIELD_DISTRIBUTORS Table
```sql
field_distributors
├── id (PRIMARY KEY)
├── name
├── email (UNIQUE)
├── password_hash
├── phone
├── ward_no ⭐
├── distributor_id (FK → distributors) ⭐
├── nid_number
├── address
├── profile_image
├── status (active/inactive/suspended)
├── created_at
├── updated_at
├── last_login
├── assigned_by (FK → distributors) ⭐
└── assigned_at
```

**Powers:**
- ✅ Register consumers
- ✅ Distribute ration items
- ✅ Scan QR codes/cards
- ✅ Record field activities
- ✅ View assigned ward data

**Special Fields:**
- `distributor_id` - Parent distributor (mandatory)
- `assigned_by` - Which distributor assigned them
- `ward_no` - Must match parent distributor's ward

---

## 🔗 How They Connect

```
CENTRAL ADMIN
    │
    ├─ approves → DISTRIBUTOR (ward-01)
    │                 │
    │                 ├─ assigns → FIELD DISTRIBUTOR 1
    │                 ├─ assigns → FIELD DISTRIBUTOR 2
    │                 │                 │
    │                 │                 ├─ registers → Consumer A
    │                 │                 ├─ registers → Consumer B
    │                 │                 └─ distributes → Ration Items
    │                 │
    │                 └─ manages → Stock Inventory (ward-01)
    │
    └─ approves → DISTRIBUTOR (ward-02)
                      │
                      ├─ assigns → FIELD DISTRIBUTOR 3
                      └─ manages → Stock Inventory (ward-02)
```

---

## 🔍 Key Differences

| Feature | Central Admin | Distributor | Field Distributor |
|---------|--------------|-------------|-------------------|
| **Scope** | System-wide | Ward-level | Field-level |
| **Boss** | Top authority | Approved by Admin | Assigned by Distributor |
| **Ward** | All wards | Single ward | Single ward (inherited) |
| **Office** | Central HQ | Ward office | No office |
| **License** | N/A | Required | Not required |
| **Can approve others** | ✅ Distributors | ✅ Field Distributors | ❌ |
| **Manages stock** | ❌ | ✅ | ❌ |
| **Direct distribution** | ❌ | ❌ | ✅ |
| **Register consumers** | ❌ | ✅ | ✅ |

---

## 🔐 Authentication Flow

### Login Process:
1. User enters email + password
2. System checks **which table** contains the email:
   - Found in `central_admins` → Role = "central-admin"
   - Found in `distributors` → Role = "distributor"
   - Found in `field_distributors` → Role = "field-distributor"
3. Verify password hash
4. Check status = 'active'
5. Return user data + role
6. Create JWT token with role embedded

### Authorization:
- Store role in session/JWT
- Frontend routes check role
- Backend APIs validate role before allowing actions

---

## 📝 Sample Data

### Central Admin:
```sql
INSERT INTO central_admins VALUES (
    'ca-001',
    'Md. Kamal Hossain',
    'admin@amarration.gov.bd',
    '$2b$10$hashed...',
    '01711111111',
    NULL,
    'active',
    NOW(),
    NOW(),
    NULL
);
```

### Distributor:
```sql
INSERT INTO distributors VALUES (
    'dist-001',
    'Rahim Uddin',
    'rahim@ward01.amarration.gov.bd',
    '$2b$10$hashed...',
    '01722222222',
    '01', -- ward_no
    'Shop No. 12, Main Road, Dhaka',
    'DL-2024-001',
    'Dhaka',
    'Dhaka Sadar',
    NULL,
    'active',
    NOW(),
    NOW(),
    NULL,
    'ca-001', -- approved_by
    NOW()
);
```

### Field Distributor:
```sql
INSERT INTO field_distributors VALUES (
    'fd-001',
    'Abdul Jabbar',
    'jabbar@field.amarration.gov.bd',
    '$2b$10$hashed...',
    '01733333333',
    '01', -- ward_no (same as distributor)
    'dist-001', -- distributor_id
    '123456789012',
    'House 45, Road 7, Ward 01',
    NULL,
    'active',
    NOW(),
    NOW(),
    NULL,
    'dist-001', -- assigned_by
    NOW()
);
```

---

## ⚡ Common Queries

### Check user login:
```sql
-- Try central admin
SELECT id, name, email, 'central-admin' as role, status 
FROM central_admins 
WHERE email = 'user@example.com' AND status = 'active';

-- If not found, try distributor
SELECT id, name, email, 'distributor' as role, status, ward_no
FROM distributors 
WHERE email = 'user@example.com' AND status = 'active';

-- If not found, try field distributor
SELECT id, name, email, 'field-distributor' as role, status, ward_no
FROM field_distributors 
WHERE email = 'user@example.com' AND status = 'active';
```

### Get user hierarchy:
```sql
-- Get distributor with their field team
SELECT 
    d.name as distributor,
    d.ward_no,
    fd.name as field_distributor,
    fd.email
FROM distributors d
LEFT JOIN field_distributors fd ON d.id = fd.distributor_id
WHERE d.id = 'dist-001';
```

### Get admin approvals:
```sql
SELECT 
    ca.name as admin_name,
    d.name as distributor_name,
    d.ward_no,
    d.approved_at
FROM distributors d
JOIN central_admins ca ON d.approved_by = ca.id
ORDER BY d.approved_at DESC;
```

---

## 🎯 Database Files Location

```
backend/
└── database/
    ├── schema.sql (Complete schema)
    ├── README.md (Full documentation)
    ├── ER_DIAGRAM.md (Visual relationships)
    └── migrations/
        ├── 001_create_users_tables.sql
        └── 002_create_consumers_table.sql
```

---

## ✅ Next Steps

1. **Import schema**: `mysql -u root -p amar_ration < schema.sql`
2. **Create sample users** in all 3 tables
3. **Test authentication** flow
4. **Build backend APIs** for each user type
5. **Implement role-based access control**
