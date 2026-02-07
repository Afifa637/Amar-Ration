# আমার রেশন Database Structure

## Overview
This database schema is designed for the Amar Ration (আমার রেশন) Public Distribution System (PDS). It supports three separate user roles with dedicated tables and comprehensive tracking of inventory, distribution, and audit activities.

## Database Architecture

### 🔐 User Authentication (Separate Tables for Each Role)

#### 1. **central_admins**
Central administrators who oversee the entire system.

**Key Fields:**
- `id` - Unique identifier
- `name`, `email`, `password_hash`
- `status` - active/inactive/suspended
- `last_login` - Last login timestamp

**Responsibilities:**
- Approve distributors
- System-wide monitoring
- Generate comprehensive reports
- Manage products and settings

---

#### 2. **distributors**
Regional/ward-level distributors who manage inventory and distribution.

**Key Fields:**
- `id` - Unique identifier
- `name`, `email`, `password_hash`, `phone`
- `ward_no` - Assigned ward number
- `office_address` - Physical office location
- `license_number` - Government license
- `approved_by` - Reference to central_admin who approved
- `status` - active/inactive/suspended

**Responsibilities:**
- Register consumers
- Manage stock inventory
- Oversee field distributors
- Track distributions in their ward

---

#### 3. **field_distributors**
On-ground workers who handle direct consumer interactions.

**Key Fields:**
- `id` - Unique identifier
- `name`, `email`, `password_hash`, `phone`
- `ward_no` - Assigned ward
- `distributor_id` - Parent distributor (foreign key)
- `assigned_by` - Who assigned them
- `status` - active/inactive/suspended

**Responsibilities:**
- Register consumers
- Distribute ration items
- Scan QR codes
- Record field activities

---

### 👥 Consumer Management

#### 4. **consumers**
Beneficiaries who receive ration.

**Key Fields:**
- Consumer personal info (name, father/mother names, NIDs)
- Contact details (mobile, address, ward)
- Economic data (monthly_income, family_members)
- Registration metadata (registered_by, registered_by_type)
- Status (active/inactive/pending/rejected)

---

### 🎫 Card & Token System

#### 5. **ration_cards**
Smart cards issued to consumers.

**Features:**
- Unique card numbers
- QR code support
- Card types (smart/oms/tct)
- Expiry tracking
- Status management

#### 6. **tokens**
OTP and verification tokens.

**Use Cases:**
- Distribution verification
- SMS OTP
- Security codes

---

### 📦 Inventory Management

#### 7. **products**
Available commodities (rice, wheat, oil, etc.)

**Details:**
- Bilingual names (English/Bengali)
- Category classification
- Unit of measurement

#### 8. **stock_inventory**
Real-time stock levels per distributor/ward.

**Features:**
- Current quantity tracking
- Reorder level alerts
- Status indicators (available/low/out-of-stock)

#### 9. **stock_transactions**
All stock movements.

**Transaction Types:**
- Incoming (receiving stock)
- Outgoing (distribution)
- Adjustment (corrections)
- Damage (waste)
- Return (returns)

---

### 🚚 Distribution System

#### 10. **distributions**
Master distribution records.

**Details:**
- Consumer, distributor, field distributor links
- Date and ward tracking
- Payment status
- Total amount

#### 11. **distribution_items**
Individual items in each distribution.

**Details:**
- Product, quantity, unit
- Pricing information
- Links to parent distribution

---

### 📊 Audit & Monitoring

#### 12. **audit_logs**
Detailed system audit trail.

**Captures:**
- All CRUD operations
- Login/logout events
- Before/after values (JSON)
- IP address and user agent
- Success/failure status

#### 13. **activity_logs**
User activity tracking.

**Records:**
- User actions
- Timestamps
- Metadata (JSON)
- IP tracking

---

### 📈 Reports & Analytics

#### 14. **reports**
Generated reports storage.

**Features:**
- Report metadata
- Date range filters
- File path storage
- Processing status

---

### ⚙️ System Management

#### 15. **system_settings**
Application configuration.

**Settings:**
- Key-value pairs
- Type definitions
- Public/private flags

#### 16. **notifications**
User notifications.

**Features:**
- Multi-user-type support
- Priority levels
- Read/unread tracking
- Action URLs

---

## Key Relationships

```
central_admins
    ├─ approves → distributors
    └─ performs → audit_logs

distributors
    ├─ has many → field_distributors
    ├─ registers → consumers
    ├─ manages → stock_inventory
    ├─ performs → distributions
    └─ performs → audit_logs

field_distributors
    ├─ belongs to → distributors
    ├─ registers → consumers
    ├─ performs → distributions
    └─ performs → audit_logs

consumers
    ├─ has → ration_cards
    ├─ receives → distributions
    └─ generates → tokens

products
    ├─ stored in → stock_inventory
    ├─ tracked in → stock_transactions
    └─ distributed via → distribution_items

distributions
    ├─ links → consumers
    ├─ links → distributors
    ├─ links → field_distributors
    └─ contains → distribution_items
```

---

## Security Features

1. **Password Hashing**: All passwords stored as bcrypt hashes
2. **Separate User Tables**: Role-based table isolation
3. **Audit Trail**: Complete tracking of all actions
4. **Status Management**: Active/inactive/suspended controls
5. **Approval Workflow**: Central admin approval for distributors
6. **Foreign Key Constraints**: Data integrity enforcement

---

## Database Setup

### Prerequisites
- MySQL 8.0+ or MariaDB 10.5+
- PHP 8.0+ (for backend)
- Node.js 18+ (for frontend)

### Installation

```bash
# 1. Create database
mysql -u root -p
CREATE DATABASE amar_ration CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE amar_ration;

# 2. Import schema
mysql -u root -p amar_ration < schema.sql

# 3. Verify tables
SHOW TABLES;
```

### Environment Variables (.env)

```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=amar_ration
DB_USERNAME=root
DB_PASSWORD=your_password
```

---

## Indexes

All tables include strategic indexes for:
- Primary keys
- Foreign keys
- Frequently queried fields (email, status, dates)
- Ward numbers
- User identifiers

---

## Sample Queries

### Get distributor with their field distributors
```sql
SELECT 
    d.name AS distributor_name,
    d.ward_no,
    COUNT(fd.id) AS field_distributor_count
FROM distributors d
LEFT JOIN field_distributors fd ON d.id = fd.distributor_id
WHERE d.status = 'active'
GROUP BY d.id;
```

### Get consumer distribution history
```sql
SELECT 
    c.consumer_name,
    c.consumer_nid,
    d.distribution_date,
    SUM(di.total_price) AS total_amount
FROM consumers c
JOIN distributions d ON c.id = d.consumer_id
JOIN distribution_items di ON d.id = di.distribution_id
WHERE c.id = 'consumer-id-here'
GROUP BY d.id
ORDER BY d.distribution_date DESC;
```

### Get current stock levels by ward
```sql
SELECT 
    p.product_name_bn,
    si.ward_no,
    si.quantity,
    si.unit,
    si.status
FROM stock_inventory si
JOIN products p ON si.product_id = p.id
WHERE si.ward_no = '01'
AND si.status = 'available'
ORDER BY p.product_name;
```

---

## Maintenance

### Regular Tasks
1. **Backup**: Daily automated backups
2. **Cleanup**: Archive old audit logs (>1 year)
3. **Optimization**: Monthly index optimization
4. **Monitoring**: Stock level alerts

### Performance Tips
1. Use appropriate indexes
2. Partition large tables by date
3. Archive completed distributions quarterly
4. Monitor slow query log

---

## Future Enhancements

- [ ] Multi-language support (expand)
- [ ] Biometric authentication integration
- [ ] Mobile app sync tables
- [ ] SMS gateway logs
- [ ] Payment gateway integration
- [ ] Geographic region expansion beyond wards

---

## Version History

- **v1.0.0** (2026-02-05) - Initial schema design
  - Separate tables for 3 user roles
  - Complete distribution tracking
  - Audit and activity logging
  - Stock management system

---

## Support

For database-related issues or schema modifications, contact the development team.
