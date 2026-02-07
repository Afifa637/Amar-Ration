-- আমার রেশন Database Schema
-- Database for Amar Ration PDS Management System

-- =====================================================
-- USER AUTHENTICATION TABLES (Separate for each role)
-- =====================================================

-- Central Admin Users Table
CREATE TABLE central_admins (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_status (status)
);

-- Distributors Table
CREATE TABLE distributors (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    ward_no VARCHAR(10) NOT NULL,
    office_address TEXT NOT NULL,
    license_number VARCHAR(50),
    district VARCHAR(50),
    upazila VARCHAR(50),
    profile_image VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    approved_by VARCHAR(36),
    approved_at TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_ward (ward_no),
    INDEX idx_status (status),
    FOREIGN KEY (approved_by) REFERENCES central_admins(id) ON DELETE SET NULL
);

-- Field Distributors Table
CREATE TABLE field_distributors (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    ward_no VARCHAR(10) NOT NULL,
    distributor_id VARCHAR(36) NOT NULL,
    nid_number VARCHAR(20),
    address TEXT,
    profile_image VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    assigned_by VARCHAR(36),
    assigned_at TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_ward (ward_no),
    INDEX idx_distributor (distributor_id),
    INDEX idx_status (status),
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES distributors(id) ON DELETE SET NULL
);

-- =====================================================
-- BENEFICIARY/CONSUMER TABLES
-- =====================================================

-- Consumers/Beneficiaries Table
CREATE TABLE consumers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    consumer_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100) NOT NULL,
    mother_name VARCHAR(100) NOT NULL,
    consumer_nid VARCHAR(20) NOT NULL UNIQUE,
    father_nid VARCHAR(20),
    mother_nid VARCHAR(20),
    date_of_birth DATE NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    monthly_income DECIMAL(10, 2),
    family_members INT DEFAULT 1,
    ward_no VARCHAR(10) NOT NULL,
    address TEXT NOT NULL,
    district VARCHAR(50),
    upazila VARCHAR(50),
    photo VARCHAR(255),
    comments TEXT,
    status ENUM('active', 'inactive', 'pending', 'rejected') DEFAULT 'pending',
    registered_by VARCHAR(36),
    registered_by_type ENUM('distributor', 'field-distributor') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_by VARCHAR(36),
    approved_at TIMESTAMP NULL,
    
    INDEX idx_consumer_nid (consumer_nid),
    INDEX idx_mobile (mobile_number),
    INDEX idx_ward (ward_no),
    INDEX idx_status (status),
    INDEX idx_registered_by (registered_by, registered_by_type)
);

-- =====================================================
-- CARD AND TOKEN MANAGEMENT
-- =====================================================

-- Ration Cards Table
CREATE TABLE ration_cards (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    card_number VARCHAR(50) UNIQUE NOT NULL,
    consumer_id VARCHAR(36) NOT NULL,
    card_type ENUM('smart', 'oms', 'tct') DEFAULT 'smart',
    issue_date DATE NOT NULL,
    expiry_date DATE,
    status ENUM('active', 'expired', 'suspended', 'lost') DEFAULT 'active',
    qr_code TEXT,
    issued_by VARCHAR(36),
    issued_by_type ENUM('central-admin', 'distributor') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_card_number (card_number),
    INDEX idx_consumer (consumer_id),
    INDEX idx_status (status),
    FOREIGN KEY (consumer_id) REFERENCES consumers(id) ON DELETE CASCADE
);

-- Tokens Table (for OTP/verification)
CREATE TABLE tokens (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    consumer_id VARCHAR(36) NOT NULL,
    token_code VARCHAR(10) NOT NULL,
    token_type ENUM('distribution', 'verification', 'otp') NOT NULL,
    purpose VARCHAR(100),
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    used_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_consumer (consumer_id),
    INDEX idx_token_code (token_code),
    INDEX idx_valid_until (valid_until),
    INDEX idx_is_used (is_used),
    FOREIGN KEY (consumer_id) REFERENCES consumers(id) ON DELETE CASCADE
);

-- =====================================================
-- STOCK AND INVENTORY MANAGEMENT
-- =====================================================

-- Products/Commodities Table
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_name VARCHAR(100) NOT NULL,
    product_name_bn VARCHAR(100),
    category VARCHAR(50),
    unit VARCHAR(20) NOT NULL, -- kg, liter, piece, etc.
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product_name (product_name),
    INDEX idx_category (category)
);

-- Stock/Inventory Table
CREATE TABLE stock_inventory (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id VARCHAR(36) NOT NULL,
    distributor_id VARCHAR(36),
    ward_no VARCHAR(10),
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    reorder_level DECIMAL(10, 2) DEFAULT 0,
    last_restocked TIMESTAMP NULL,
    status ENUM('available', 'low', 'out-of-stock') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_distributor (distributor_id),
    INDEX idx_ward (ward_no),
    INDEX idx_status (status),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
);

-- Stock Transactions (Incoming/Outgoing)
CREATE TABLE stock_transactions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id VARCHAR(36) NOT NULL,
    distributor_id VARCHAR(36),
    transaction_type ENUM('incoming', 'outgoing', 'adjustment', 'damage', 'return') NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    from_location VARCHAR(100),
    to_location VARCHAR(100),
    reference_number VARCHAR(50),
    notes TEXT,
    performed_by VARCHAR(36) NOT NULL,
    performed_by_type ENUM('central-admin', 'distributor', 'field-distributor') NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_distributor (distributor_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_transaction_date (transaction_date),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE SET NULL
);

-- =====================================================
-- DISTRIBUTION MANAGEMENT
-- =====================================================

-- Distribution Records
CREATE TABLE distributions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    consumer_id VARCHAR(36) NOT NULL,
    card_id VARCHAR(36),
    distributor_id VARCHAR(36) NOT NULL,
    field_distributor_id VARCHAR(36),
    distribution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ward_no VARCHAR(10) NOT NULL,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    payment_status ENUM('paid', 'pending', 'partial', 'free') DEFAULT 'pending',
    status ENUM('completed', 'pending', 'cancelled') DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_consumer (consumer_id),
    INDEX idx_distributor (distributor_id),
    INDEX idx_field_distributor (field_distributor_id),
    INDEX idx_distribution_date (distribution_date),
    INDEX idx_ward (ward_no),
    INDEX idx_status (status),
    FOREIGN KEY (consumer_id) REFERENCES consumers(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES ration_cards(id) ON DELETE SET NULL,
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
    FOREIGN KEY (field_distributor_id) REFERENCES field_distributors(id) ON DELETE SET NULL
);

-- Distribution Items (Individual products in a distribution)
CREATE TABLE distribution_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    distribution_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(10, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_distribution (distribution_id),
    INDEX idx_product (product_id),
    FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =====================================================
-- AUDIT AND MONITORING
-- =====================================================

-- Audit Logs Table
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    user_type ENUM('central-admin', 'distributor', 'field-distributor') NOT NULL,
    action VARCHAR(100) NOT NULL,
    action_type ENUM('create', 'read', 'update', 'delete', 'login', 'logout') NOT NULL,
    table_name VARCHAR(50),
    record_id VARCHAR(36),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status ENUM('success', 'failed') DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id, user_type),
    INDEX idx_action_type (action_type),
    INDEX idx_table_name (table_name),
    INDEX idx_created_at (created_at)
);

-- Activity Logs (User activities)
CREATE TABLE activity_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    user_type ENUM('central-admin', 'distributor', 'field-distributor') NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id, user_type),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- REPORTS AND ANALYTICS
-- =====================================================

-- Reports Table
CREATE TABLE reports (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    report_name VARCHAR(100) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    generated_by VARCHAR(36) NOT NULL,
    generated_by_type ENUM('central-admin', 'distributor', 'field-distributor') NOT NULL,
    date_from DATE,
    date_to DATE,
    filters JSON,
    file_path VARCHAR(255),
    status ENUM('completed', 'processing', 'failed') DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_report_type (report_type),
    INDEX idx_generated_by (generated_by, generated_by_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- SETTINGS AND CONFIGURATIONS
-- =====================================================

-- System Settings
CREATE TABLE system_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(36),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key),
    INDEX idx_is_public (is_public)
);

-- Notifications Table
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    user_type ENUM('central-admin', 'distributor', 'field-distributor', 'consumer') NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    action_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id, user_type),
    INDEX idx_is_read (is_read),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- SAMPLE DATA INSERT (Optional)
-- =====================================================

-- Insert default Central Admin
INSERT INTO central_admins (id, name, email, password_hash, phone, status) VALUES
('ca-001', 'System Administrator', 'admin@amarration.gov.bd', '$2b$10$YourHashedPasswordHere', '01700000000', 'active');

-- Insert sample products
INSERT INTO products (product_name, product_name_bn, category, unit, status) VALUES
('Rice', 'চাল', 'cereals', 'kg', 'active'),
('Wheat', 'গম', 'cereals', 'kg', 'active'),
('Sugar', 'চিনি', 'sweeteners', 'kg', 'active'),
('Lentils', 'ডাল', 'pulses', 'kg', 'active'),
('Edible Oil', 'ভোজ্য তেল', 'oil', 'liter', 'active'),
('Salt', 'লবণ', 'spices', 'kg', 'active');

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('app_name', 'আমার রেশন', 'string', 'Application Name', TRUE),
('app_version', '1.0.0', 'string', 'Application Version', TRUE),
('maintenance_mode', 'false', 'boolean', 'Maintenance Mode', FALSE),
('max_family_members', '10', 'integer', 'Maximum Family Members Allowed', FALSE),
('distribution_limit_per_month', '50', 'integer', 'Maximum Distribution Items per Month', FALSE);
