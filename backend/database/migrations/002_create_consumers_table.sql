-- Migration: Create Consumers Table
-- Version: 002
-- Date: 2026-02-05

CREATE TABLE IF NOT EXISTS consumers (
    id VARCHAR(36) PRIMARY KEY,
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
    approved_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_consumers_nid ON consumers(consumer_nid);
CREATE INDEX idx_consumers_mobile ON consumers(mobile_number);
CREATE INDEX idx_consumers_ward ON consumers(ward_no);
CREATE INDEX idx_consumers_status ON consumers(status);
CREATE INDEX idx_consumers_registered_by ON consumers(registered_by, registered_by_type);
