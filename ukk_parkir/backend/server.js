const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// KONEKSI DB
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_ukk'
});

db.connect(err => {
    if (err) throw err;
    console.log('✅ Database Connected!');
});

// FUNGSI LOG AKTIVITAS (Syarat UKK)
const simpanLog = (id_user, aktivitas) => {
    db.query("INSERT INTO tb_log_aktivitas (id_user, aktivitas, waktu_aktivitas) VALUES (?, ?, NOW())", [id_user, aktivitas]);
};

function catatLog(id_user, aktivitas, detail) {
    const query = "INSERT INTO log_aktivitas (id_user, aktivitas, detail) VALUES (?, ?, ?)";
    db.query(query, [id_user, aktivitas, detail], (err) => {
        if (err) console.error("Gagal catat log:", err);
    });
}

// --- API AUTH ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM tb_user WHERE username = ? AND password = ?", [username, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            simpanLog(result[0].id_user, "User Login");
            res.json({ success: true, user: result[0] });
        } else {
            res.json({ success: false, message: "Username/Password Salah" });
        }
    });
});

// --- API CRUD TARIF ---
// Route untuk mengambil data tarif (tb_tarif)
app.get('/api/tarif', (req, res) => {
    db.query('SELECT * FROM tb_tarif', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// Route untuk menghapus user (Sesuai ID di database)
app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM tb_user WHERE id_user = ?"; // Pastikan nama kolom sesuai: id_user
    
    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ message: "Gagal menghapus data di database", error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }
        res.json({ message: "User berhasil dihapus" });
    });
});

app.post('/api/tarif/add', (req, res) => {
    const { jenis_kendaraan, tarif_per_jam } = req.body;
    const sql = "INSERT INTO tb_tarif (jenis_kendaraan, tarif_per_jam) VALUES (?, ?)";
    db.query(sql, [jenis_kendaraan, tarif_per_jam], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.put('/api/tarif/update/:id', (req, res) => {
    const { id } = req.params;
    const { tarif_per_jam } = req.body;
    const sql = "UPDATE tb_tarif SET tarif_per_jam = ? WHERE id_tarif = ?";
    db.query(sql, [tarif_per_jam, id], (err, result) => {
        if (err) return res.status(500).json({ message: "Gagal update database" });
        res.json({ success: true, message: "Harga diperbarui" });
    });
});

app.delete('/api/tarif/delete/:id', (req, res) => {
    db.query("DELETE FROM tb_tarif WHERE id_tarif = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// --- API CRUD AREA (Sesuai Struktur tb_area_parkir) ---
app.get('/api/area', (req, res) => {
    // Menggunakan nama kolom sesuai gambar: id_area, nama_area, kapasitas, terisi
    db.query("SELECT * FROM tb_area_parkir", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/area/add', (req, res) => {
    const { nama_area, kapasitas } = req.body;
    const sql = "INSERT INTO tb_area_parkir (nama_area, kapasitas, terisi) VALUES (?, ?, 0)";
    db.query(sql, [nama_area, kapasitas], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Lantai berhasil ditambahkan!" });
    });
});

app.delete('/api/area/delete/:id', (req, res) => {
    db.query("DELETE FROM tb_area_parkir WHERE id_area = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// --- CRUD KENDARAAN ---
app.get('/api/kendaraan', (req, res) => {
    const sql = "SELECT * FROM tb_kendaraan ORDER BY id_kendaraan DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// --- API PENCARIAN KENDARAAN (Untuk Transaksi Keluar) ---
app.get('/api/cari-kendaraan', (req, res) => {
    const plat = req.query.plat;
    
    // Mencari data kendaraan yang statusnya masih 'masuk' di tabel transaksi
    const sql = `
        SELECT t.id_parkir, t.waktu_masuk, k.plat_nomor, tr.tarif_per_jam 
        FROM tb_transaksi t
        JOIN tb_kendaraan k ON t.id_kendaraan = k.id_kendaraan
        JOIN tb_tarif tr ON t.id_tarif = tr.id_tarif
        WHERE k.plat_nomor = ? AND t.status = 'masuk'
        LIMIT 1
    `;

    db.query(sql, [plat], (err, results) => {
        if (err) return res.status(500).json({ message: "Error Database", error: err });
        
        if (results.length > 0) {
            // Hitung estimasi biaya sementara untuk ditampilkan ke petugas
            const data = results[0];
            const durasi = Math.ceil((new Date() - new Date(data.waktu_masuk)) / (1000 * 60 * 60)) || 1;
            const total_biaya = durasi * data.tarif_per_jam;
            
            res.json({ 
                success: true, 
                id_parkir: data.id_parkir,
                plat_nomor: data.plat_nomor,
                waktu_masuk: data.waktu_masuk,
                durasi: durasi,
                biaya_estimasi: total_biaya 
            });
        } else {
            res.status(404).json({ message: "Kendaraan tidak ditemukan atau sudah keluar!" });
        }
    });
});

// Di server.js
// Tambahkan ini di server.js
app.get('/api/logs', (req, res) => {
    // Sesuaikan nama tabel: tb_log_aktivitas
    // Sesuaikan nama kolom waktu: waktu_aktivitas
    const query = `
        SELECT l.*, IFNULL(u.username, 'Sistem') as username 
        FROM tb_log_aktivitas l 
        LEFT JOIN users u ON l.id_user = u.id_user 
        ORDER BY l.waktu_aktivitas DESC 
        LIMIT 50
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Database Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});
    db.query(query, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Gagal mengambil log" });
        }
        res.json(results); // Mengirim data dalam format JSON yang benar
    });


app.post('/api/kendaraan/add', (req, res) => {
    const { plat_nomor, jenis_kendaraan, id_user } = req.body;
    const sql = "INSERT INTO tb_kendaraan (plat_nomor, jenis_kendaraan, id_user) VALUES (?, ?, ?)";
    db.query(sql, [plat_nomor, jenis_kendaraan, id_user], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

app.put('/api/kendaraan/update/:id', (req, res) => {
    const { id } = req.params;
    const { plat_nomor, jenis_kendaraan } = req.body;
    const sql = "UPDATE tb_kendaraan SET plat_nomor = ?, jenis_kendaraan = ? WHERE id_kendaraan = ?";
    db.query(sql, [plat_nomor, jenis_kendaraan, id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/kendaraan/delete/:id', (req, res) => {
    db.query("DELETE FROM tb_kendaraan WHERE id_kendaraan = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// --- API TRANSAKSI (PETUGAS) ---
app.post('/api/transaksi/masuk', (req, res) => {
    const { plat_nomor, jenis_kendaraan, id_tarif, id_area, id_user } = req.body;
    db.query("INSERT INTO tb_kendaraan (plat_nomor, jenis_kendaraan, id_user) VALUES (?, ?, ?)", [plat_nomor, jenis_kendaraan, id_user], (err, resK) => {
        if (err) return res.status(500).json(err);
        const id_k = resK.insertId;
        db.query("INSERT INTO tb_transaksi (id_kendaraan, id_tarif, id_area, id_user, status, waktu_masuk) VALUES (?, ?, ?, ?, 'masuk', NOW())", [id_k, id_tarif, id_area, id_user], (err) => {
            if (err) return res.status(500).json(err);
            db.query("UPDATE tb_area_parkir SET terisi = terisi + 1 WHERE id_area = ?", [id_area]);
            simpanLog(id_user, `Kendaraan Masuk: ${plat_nomor}`);
            res.json({ success: true });
        });
    });
});

app.post('/api/transaksi/keluar', (req, res) => {
    const { id_parkir } = req.body;
    db.query("SELECT t.*, tr.tarif_per_jam FROM tb_transaksi t JOIN tb_tarif tr ON t.id_tarif = tr.id_tarif WHERE t.id_parkir = ?", [id_parkir], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ message: "Data tidak ditemukan" });
        const data = results[0];
        const durasi = Math.ceil((new Date() - new Date(data.waktu_masuk)) / (1000 * 60 * 60)) || 1;
        const total = durasi * data.tarif_per_jam;

        db.query("UPDATE tb_transaksi SET waktu_keluar = NOW(), durasi_jam = ?, biaya_total = ?, status = 'keluar' WHERE id_parkir = ?", [durasi, total, id_parkir], () => {
            db.query("UPDATE tb_area_parkir SET terisi = terisi - 1 WHERE id_area = ?", [data.id_area]);
            simpanLog(data.id_user, `Kendaraan Keluar ID: ${id_parkir}`);
            res.json({ success: true, biaya: total });
        });
    });
});

app.get('/api/kendaraan-aktif', (req, res) => {
    const sql = `
        SELECT t.id_parkir, t.waktu_masuk, k.plat_nomor 
        FROM tb_transaksi t
        JOIN tb_kendaraan k ON t.id_kendaraan = k.id_kendaraan
        WHERE t.status = 'masuk'
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});


// --- API OWNER: LAPORAN PENDAPATAN ---
app.get('/api/owner/pendapatan', (req, res) => {
    const { start, end } = req.query;
    
    // Query untuk pendapatan Hari Ini, Bulan Ini, dan Range Tanggal
    const sql = `
        SELECT 
            SUM(CASE WHEN DATE(waktu_keluar) = CURDATE() THEN biaya_total ELSE 0 END) as hari_ini,
            SUM(CASE WHEN MONTH(waktu_keluar) = MONTH(CURDATE()) AND YEAR(waktu_keluar) = YEAR(CURDATE()) THEN biaya_total ELSE 0 END) as bulan_ini,
            SUM(CASE WHEN waktu_keluar BETWEEN ? AND ? THEN biaya_total ELSE 0 END) as total_range,
            COUNT(id_parkir) as total_transaksi
        FROM tb_transaksi 
        WHERE status = 'keluar'
    `;

    db.query(sql, [start + " 00:00:00", end + " 23:59:59"], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results[0]);
    });
});

// Get data 7 hari terakhir untuk tabel
app.get('/api/owner/history', (req, res) => {
    const sql = `
        SELECT DATE(waktu_keluar) as tanggal, SUM(biaya_total) as pendapatan, COUNT(*) as jumlah_kendaraan
        FROM tb_transaksi 
        WHERE status = 'keluar' 
        AND waktu_keluar >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(waktu_keluar)
        ORDER BY tanggal DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});


// --- CRUD USER ---
app.get('/api/users', (req, res) => {
    // Pastikan query ini mengambil data dari tabel yang benar
    db.query("SELECT id_user, username, role, status_aktif FROM tb_user", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.post('/api/users/add', (req, res) => {
    const { username, password, role } = req.body;
    const sql = "INSERT INTO tb_user (username, password, role, status_aktif) VALUES (?, ?, ?, 1)";
    db.query(sql, [username, password, role], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

app.put('/api/users/status/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Ini akan menerima angka 1 atau 0
    const sql = "UPDATE tb_user SET status_aktif = ? WHERE id_user = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, role, password } = req.body;
    let sql = "UPDATE tb_user SET username = ?, role = ? WHERE id_user = ?";
    let params = [username, role, id];

    if (password) {
        sql = "UPDATE tb_user SET username = ?, role = ?, password = ? WHERE id_user = ?";
        params = [username, role, password, id];
    }

    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

app.listen(3000, () => console.log('🚀 Server running on port 3000'));