-- ========================================
-- DATABASE SCHEMA: db_ukk
-- Sistem Manajemen Parkir
-- ========================================

-- Buat database
CREATE DATABASE IF NOT EXISTS db_ukk;
USE db_ukk;

-- ========================================
-- 1. TABEL USER
-- Menyimpan data pengguna sistem
-- ========================================
CREATE TABLE tb_user (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    role ENUM('admin', 'petugas', 'owner') NOT NULL,
    status_aktif TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- 2. TABEL TARIF
-- Menyimpan tarif parkir per jenis kendaraan
-- ========================================
CREATE TABLE tb_tarif (
    id_tarif INT AUTO_INCREMENT PRIMARY KEY,
    jenis_kendaraan VARCHAR(50),
    tarif_per_jam INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- 3. TABEL AREA PARKIR
-- Menyimpan data area/lokasi parkir
-- ========================================
CREATE TABLE tb_area_parkir (
    id_area INT AUTO_INCREMENT PRIMARY KEY,
    nama_area VARCHAR(100),
    kapasitas INT,
    terisi INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- 4. TABEL KENDARAAN
-- Menyimpan data kendaraan yang terdaftar
-- ========================================
CREATE TABLE tb_kendaraan (
    id_kendaraan INT AUTO_INCREMENT PRIMARY KEY,
    plat_nomor VARCHAR(20),
    jenis_kendaraan VARCHAR(50),
    id_user INT,
    FOREIGN KEY (id_user) REFERENCES tb_user(id_user)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- 5. TABEL TRANSAKSI
-- Menyimpan data transaksi parkir
-- ========================================
CREATE TABLE tb_transaksi (
    id_parkir INT AUTO_INCREMENT PRIMARY KEY,
    id_kendaraan INT,
    id_tarif INT,
    id_area INT,
    id_user INT,
    waktu_masuk DATETIME,
    waktu_keluar DATETIME,
    durasi_jam INT,
    biaya_total INT,
    status ENUM('masuk', 'keluar') DEFAULT 'masuk',
    FOREIGN KEY (id_kendaraan) REFERENCES tb_kendaraan(id_kendaraan)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (id_tarif) REFERENCES tb_tarif(id_tarif)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (id_area) REFERENCES tb_area_parkir(id_area)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (id_user) REFERENCES tb_user(id_user)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- 6. TABEL LOG AKTIVITAS
-- Menyimpan log aktivitas pengguna
-- ========================================
CREATE TABLE tb_log_aktivitas (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    aktivitas VARCHAR(255),
    waktu_aktivitas DATETIME,
    FOREIGN KEY (id_user) REFERENCES tb_user(id_user)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- DATA AWAL (SEEDER)
-- ========================================

-- Akun admin default
INSERT INTO tb_user (username, password, role, status_aktif)
VALUES ('admin', 'admin123', 'admin', 1);

-- Tarif default
INSERT INTO tb_tarif (jenis_kendaraan, tarif_per_jam)
VALUES ('Motor', 2000), ('Mobil', 5000);

-- Area parkir default
INSERT INTO tb_area_parkir (nama_area, kapasitas, terisi)
VALUES ('Lantai 1', 50, 0), ('Lantai 2', 30, 0);
