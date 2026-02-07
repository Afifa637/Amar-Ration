-- Migration: Create Users Tables
-- Version: 001
-- Date: 2026-02-05

-- Central Admins Table
CREATE TABLE IF NOT EXISTS central_admins (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_central_admins_email ON central_admins(email);
CREATE INDEX idx_central_admins_status ON central_admins(status);

-- Distributors Table
CREATE TABLE IF NOT EXISTS distributors (
    id VARCHAR(36) PRIMARY KEY,
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
    approved_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_distributors_email ON distributors(email);
CREATE INDEX idx_distributors_ward ON distributors(ward_no);
CREATE INDEX idx_distributors_status ON distributors(status);
ALTER TABLE distributors ADD CONSTRAINT fk_distributors_approved_by 
    FOREIGN KEY (approved_by) REFERENCES central_admins(id) ON DELETE SET NULL;

-- Field Distributors Table
CREATE TABLE IF NOT EXISTS field_distributors (
    id VARCHAR(36) PRIMARY KEY,
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
    assigned_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_field_distributors_email ON field_distributors(email);
CREATE INDEX idx_field_distributors_ward ON field_distributors(ward_no);
CREATE INDEX idx_field_distributors_distributor ON field_distributors(distributor_id);
CREATE INDEX idx_field_distributors_status ON field_distributors(status);
ALTER TABLE field_distributors ADD CONSTRAINT fk_field_distributors_distributor 
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE;
ALTER TABLE field_distributors ADD CONSTRAINT fk_field_distributors_assigned_by 
    FOREIGN KEY (assigned_by) REFERENCES distributors(id) ON DELETE SET NULL;
