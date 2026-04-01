const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// KONEKSI DB
const db = mysql.createConnection({
    host: 'localhost', // Alamat server database, 'localhost' = di komputer yang sama
    user: 'root',      // Username MySQL (default XAMPP = root)
    password: '',      // Password MySQL (default XAMPP = kosong)
    database: 'db_ukk' // Nama database yang digunakan
});

// Menyambungkan aplikasi ke database
// Jika gagal konek, program akan otomatis berhenti (throw err)
db.connect(err => {
    if (err) throw err; // Jika ada error koneksi, lempar error dan hentikan server
    console.log('✅ Database Connected!'); // Jika berhasil, tampilkan pesan sukses di terminal
});

// ============================================================
// FUNGSI HELPER: simpanLog
// Tujuan: Mencatat setiap aktivitas penting (login, masuk, keluar)
//         ke tabel tb_log_aktivitas di database
// Parameter:
//   - id_user  : ID pengguna yang melakukan aktivitas
//   - aktivitas: Teks keterangan aktivitas (contoh: "User Login")
// Ini adalah syarat UKK (Ujian Kompetensi Keahlian) agar
// setiap aksi tercatat untuk audit trail
// ============================================================
const simpanLog = (id_user, aktivitas) => {
    // INSERT INTO: simpan data baru ke tabel log
    // NOW(): fungsi MySQL untuk mengisi waktu saat ini secara otomatis
    // Tanda ? adalah placeholder aman untuk mencegah SQL Injection
    // FIX: Tambahkan callback error agar kegagalan simpan log terlihat di terminal (bukan silent fail)
    db.query(
        "INSERT INTO tb_log_aktivitas (id_user, aktivitas, waktu_aktivitas) VALUES (?, ?, NOW())",
        [id_user, aktivitas],
        (err) => {
            if (err) console.error('❌ Gagal simpan log aktivitas:', err.message);
        }
    );
};



// ============================================================
// --- API AUTH (AUTENTIKASI) ---
// ============================================================

// POST /api/login
// Tujuan: Memeriksa username dan password dari form login
// Cara kerja:
//   1. Ambil username & password dari body request
//   2. Cari di database, apakah ada user yang cocok
//   3. Jika cocok → kirim data user + success: true
//   4. Jika tidak cocok → kirim pesan "Username/Password Salah"
app.post('/api/login', (req, res) => {
    const { username, password } = req.body; // Ambil nilai username dan password dari body request (dikirim oleh form login)
    // Query SELECT untuk mencari user yang username DAN password-nya cocok di tabel tb_user
    db.query("SELECT * FROM tb_user WHERE username = ? AND password = ?", [username, password], (err, result) => {
        if (err) return res.status(500).json(err); // Jika ada error database, kirim response error 500
        if (result.length > 0) {
            // result.length > 0 berarti user ditemukan di database
            simpanLog(result[0].id_user, "User Login"); // Catat aktivitas login ke tabel log
            res.json({ success: true, user: result[0] }); // Kirim data user pertama yang ditemukan ke frontend
        } else {
            // Jika tidak ada user yang cocok
            res.json({ success: false, message: "Username/Password Salah" }); // Kirim pesan gagal login
        }
    });
});

// ============================================================
// --- API CRUD TARIF ---
// Mengelola tabel tb_tarif untuk data harga parkir per jam
// berdasarkan jenis kendaraan (motor, mobil, truk, dll)
// ============================================================

// GET /api/tarif
// Tujuan: Mengambil semua data tarif parkir dari database
// Digunakan oleh: halaman admin (untuk kelola tarif) dan
//                 halaman petugas (untuk dropdown pilihan tarif saat check-in)
app.get('/api/tarif', (req, res) => {
    db.query('SELECT * FROM tb_tarif', (err, results) => { // Ambil semua baris dari tabel tb_tarif
        if (err) return res.status(500).json(err); // Jika error, balas dengan status 500
        res.json(results); // Kirim semua data tarif dalam format JSON ke frontend
    });
});

// CATATAN PENTING — ROUTE ORDERING:
// Route DELETE /api/users/:id dipindah ke bawah (lihat bagian CRUD USER)
// agar tidak menimpa route DELETE /api/users/delete/:id
// Express mencocokkan route dari atas ke bawah secara berurutan;
// jika /api/users/:id ada lebih dulu, maka URL seperti /api/users/delete/5
// akan cocok dengan :id='delete' bukan route yang benar.

// POST /api/tarif/add
// Tujuan: Menambahkan tarif baru ke database
// Body request harus berisi: { jenis_kendaraan, tarif_per_jam }
app.post('/api/tarif/add', (req, res) => {
    const { jenis_kendaraan, tarif_per_jam } = req.body; // Ambil data tarif baru dari body request
    const sql = "INSERT INTO tb_tarif (jenis_kendaraan, tarif_per_jam) VALUES (?, ?)"; // Query insert tarif baru
    db.query(sql, [jenis_kendaraan, tarif_per_jam], (err, result) => {
        if (err) return res.status(500).json(err); // Gagal insert → kirim error
        res.json({ success: true }); // Berhasil insert → kirim konfirmasi
    });
});

// PUT /api/tarif/update/:id
// Tujuan: Mengubah harga tarif yang sudah ada berdasarkan ID tarif
// Digunakan oleh: admin ketika mengubah nominal tarif di tabel
app.put('/api/tarif/update/:id', (req, res) => {
    const { id } = req.params;          // Ambil ID tarif dari URL parameter
    const { tarif_per_jam } = req.body; // Ambil nilai harga baru dari body request
    const sql = "UPDATE tb_tarif SET tarif_per_jam = ? WHERE id_tarif = ?"; // Query UPDATE harga tarif
    db.query(sql, [tarif_per_jam, id], (err, result) => {
        if (err) return res.status(500).json({ message: "Gagal update database" }); // Gagal update → error
        res.json({ success: true, message: "Harga diperbarui" }); // Berhasil → kirim pesan sukses
    });
});

// DELETE /api/tarif/delete/:id
// Tujuan: Menghapus data tarif berdasarkan ID-nya
app.delete('/api/tarif/delete/:id', (req, res) => {
    // req.params.id = ID yang ada di URL, misal: /api/tarif/delete/3 → hapus id_tarif = 3
    db.query("DELETE FROM tb_tarif WHERE id_tarif = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err); // Jika error saat hapus, balas error
        res.json({ success: true }); // Berhasil hapus
    });
});

// ============================================================
// --- API CRUD AREA PARKIR ---
// Mengelola tabel tb_area_parkir untuk data lantai/zona parkir
// Contoh: Lantai 1 (kapasitas 50 slot), Lantai 2 (kapasitas 30 slot)
// ============================================================

// GET /api/area
// Tujuan: Mengambil semua data area/lantai parkir
// Digunakan oleh: admin (kelola area) dan petugas (dropdown area saat check-in)
app.get('/api/area', (req, res) => {
    // Menggunakan nama kolom sesuai gambar: id_area, nama_area, kapasitas, terisi
    db.query("SELECT * FROM tb_area_parkir", (err, results) => { // Ambil semua area dari tabel
        if (err) return res.status(500).json(err);
        res.json(results); // Kirim data semua area ke frontend
    });
});

// POST /api/area/add
// Tujuan: Menambahkan area/lantai parkir baru
// Body request: { nama_area: "Lantai 1", kapasitas: 50 }
// Kolom "terisi" langsung diisi 0 karena area baru pasti kosong
app.post('/api/area/add', (req, res) => {
    const { nama_area, kapasitas } = req.body; // Ambil nama dan kapasitas dari body request
    const sql = "INSERT INTO tb_area_parkir (nama_area, kapasitas, terisi) VALUES (?, ?, 0)"; // Nilai terisi = 0 (area baru kosong)
    db.query(sql, [nama_area, kapasitas], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Lantai berhasil ditambahkan!" }); // Kirim pesan sukses
    });
});

// DELETE /api/area/delete/:id
// Tujuan: Menghapus area parkir berdasarkan ID-nya
app.delete('/api/area/delete/:id', (req, res) => {
    db.query("DELETE FROM tb_area_parkir WHERE id_area = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true }); // Konfirmasi berhasil hapus
    });
});

// ============================================================
// --- CRUD KENDARAAN ---
// Mengelola tabel tb_kendaraan untuk data kendaraan yang pernah parkir
// ============================================================

// GET /api/kendaraan
// Tujuan: Mengambil semua data kendaraan, diurutkan dari yang terbaru
app.get('/api/kendaraan', (req, res) => {
    const sql = "SELECT * FROM tb_kendaraan ORDER BY id_kendaraan DESC"; // DESC = dari ID terbesar (terbaru) ke terkecil
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results); // Kirim daftar semua kendaraan
    });
});

// ============================================================
// --- API PENCARIAN KENDARAAN (Untuk Transaksi Keluar) ---
// Digunakan saat petugas ingin mencari kendaraan berdasarkan plat
// untuk proses check-out dan menghitung biaya parkir
// ============================================================

// GET /api/cari-kendaraan?plat=B1234ABC
// Cara kerja:
//   1. Terima plat nomor dari query parameter (?plat=...)
//   2. Cari di database: transaksi dengan status 'masuk' dan plat tersebut
//   3. Hitung estimasi biaya berdasarkan waktu masuk vs sekarang
//   4. Kirim data ke frontend untuk ditampilkan ke petugas
app.get('/api/cari-kendaraan', (req, res) => {
    const plat = req.query.plat; // Ambil nilai plat nomor dari query URL (?plat=...)

    // JOIN 3 tabel: tb_transaksi + tb_kendaraan + tb_tarif
    // untuk mendapatkan info lengkap kendaraan yang sedang parkir
    // Kondisi: status = 'masuk' (belum keluar) dan plat nomor cocok
    // LIMIT 1: ambil satu data saja (transaksi aktif terakhir)
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
            const data = results[0]; // Ambil data transaksi yang ditemukan
            // Hitung durasi parkir dalam jam
            // Math.ceil: bulatkan ke atas (misal 1.2 jam → 2 jam) agar tidak rugi
            // Minimal 1 jam walau baru beberapa menit (|| 1)
            const durasi = Math.ceil((new Date() - new Date(data.waktu_masuk)) / (1000 * 60 * 60)) || 1;
            const total_biaya = durasi * data.tarif_per_jam; // Biaya = durasi (jam) × tarif per jam

            // Kirim data kendaraan + estimasi biaya ke frontend
            res.json({
                success: true,
                id_parkir: data.id_parkir,       // ID transaksi parkir (dibutuhkan saat konfirmasi keluar)
                plat_nomor: data.plat_nomor,      // Plat nomor kendaraan
                waktu_masuk: data.waktu_masuk,    // Waktu kendaraan masuk parkir
                durasi: durasi,                   // Estimasi durasi parkir dalam jam
                biaya_estimasi: total_biaya        // Estimasi total biaya yang harus dibayar
            });
        } else {
            // Kendaraan tidak ditemukan atau sudah keluar (status bukan 'masuk')
            res.status(404).json({ message: "Kendaraan tidak ditemukan atau sudah keluar!" });
        }
    });
});

// ============================================================
// --- API LOG AKTIVITAS ---
// Mengambil riwayat aktivitas (login, kendaraan masuk/keluar)
// Digunakan oleh admin untuk memantau semua kegiatan sistem
// ============================================================

// GET /api/logs
// Menampilkan 50 log terbaru, diurutkan dari yang terbaru
// LEFT JOIN digunakan agar log dari sistem (tanpa user) tetap muncul
// IFNULL: jika id_user kosong (null), tampilkan 'Sistem' sebagai username
app.get('/api/logs', (req, res) => {
    const query = `
        SELECT l.*, IFNULL(u.username, 'Sistem') as username 
        FROM tb_log_aktivitas l 
        LEFT JOIN tb_user u ON l.id_user = u.id_user 
        ORDER BY l.waktu_aktivitas DESC 
        LIMIT 50
    `;
    // LIMIT 50: tampilkan maksimal 50 log terbaru agar tidak membebani halaman

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Database Error:", err.message); // Tampilkan error di terminal server
            return res.status(500).json({ error: err.message }); // Kirim pesan error ke frontend
        }
        res.json(results);
    });
});
 


app.post('/api/kendaraan/add', (req, res) => {
    const { plat_nomor, jenis_kendaraan, id_user } = req.body; // Destructuring: ambil 3 nilai sekaligus dari body
    const sql = "INSERT INTO tb_kendaraan (plat_nomor, jenis_kendaraan, id_user) VALUES (?, ?, ?)";
    db.query(sql, [plat_nomor, jenis_kendaraan, id_user], (err, result) => {
        if (err) return res.status(500).json({ message: err.message }); // Tampilkan pesan error spesifik
        res.json({ success: true });
    });
});

// PUT /api/kendaraan/update/:id
// Tujuan: Mengubah data kendaraan (plat nomor / jenis) berdasarkan ID
app.put('/api/kendaraan/update/:id', (req, res) => {
    const { id } = req.params; // ID kendaraan dari URL
    const { plat_nomor, jenis_kendaraan } = req.body; // Data baru dari body request
    const sql = "UPDATE tb_kendaraan SET plat_nomor = ?, jenis_kendaraan = ? WHERE id_kendaraan = ?";
    db.query(sql, [plat_nomor, jenis_kendaraan, id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

// DELETE /api/kendaraan/delete/:id
// Tujuan: Menghapus data kendaraan dari database berdasarkan ID
app.delete('/api/kendaraan/delete/:id', (req, res) => {
    db.query("DELETE FROM tb_kendaraan WHERE id_kendaraan = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// DELETE /api/users/delete/:id
// Tujuan: Menghapus user (petugas/owner/admin) dari database
// Digunakan oleh: halaman admin frontend (tombol Hapus di tabel user)
// PENTING: Route ini harus didefinisikan SEBELUM /api/users/:id
//          agar Express tidak salah menangkap 'delete' sebagai nilai :id
app.delete('/api/users/delete/:id', (req, res) => {
    const id = req.params.id; // Ambil ID user dari URL parameter
    db.query("DELETE FROM tb_user WHERE id_user = ?", [id], (err, result) => {
        if (err) return res.status(500).json({ message: "Gagal menghapus data", error: err });
        if (result.affectedRows === 0) return res.status(404).json({ message: "User tidak ditemukan" });
        res.json({ success: true, message: "User berhasil dihapus" }); // Konfirmasi berhasil
    });
});

// DELETE /api/users/:id
// Tujuan: Alternatif route hapus user berdasarkan ID
// PENTING: Route ini HARUS di bawah /api/users/delete/:id
//          Kalau dibalik, Express akan menangkap kata 'delete' sebagai nilai :id
//          dan route /api/users/delete/:id tidak akan pernah tercapai
app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM tb_user WHERE id_user = ?";
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

// ============================================================
// --- API TRANSAKSI (PETUGAS) ---
// Dua endpoint utama: /transaksi/masuk (check-in) dan /transaksi/keluar (check-out)
// ============================================================

// POST /api/transaksi/masuk
// Tujuan: Mencatat kendaraan yang baru masuk ke area parkir
// Alur kerja (berurutan):
//   1. Simpan data kendaraan baru ke tb_kendaraan
//   2. Simpan data transaksi baru ke tb_transaksi (status = 'masuk', waktu_masuk = sekarang)
//   3. Tambah jumlah 'terisi' di area yang dipilih +1
//   4. Catat aktivitas di log
app.post('/api/transaksi/masuk', (req, res) => {
    const { plat_nomor, jenis_kendaraan, id_tarif, id_area, id_user } = req.body; // Ambil semua data yang dikirim petugas
    // Langkah 1: Simpan kendaraan baru ke tabel tb_kendaraan
    db.query("INSERT INTO tb_kendaraan (plat_nomor, jenis_kendaraan, id_user) VALUES (?, ?, ?)", [plat_nomor, jenis_kendaraan, id_user], (err, resK) => {
        if (err) return res.status(500).json(err);
        const id_k = resK.insertId; // insertId = ID auto-increment yang baru saja dibuat database
        // Langkah 2: Simpan transaksi ke tabel tb_transaksi
        // status = 'masuk' menandakan kendaraan masih ada di dalam parkir
        // waktu_masuk = NOW() diisi otomatis oleh MySQL dengan waktu saat ini
        db.query("INSERT INTO tb_transaksi (id_kendaraan, id_tarif, id_area, id_user, status, waktu_masuk) VALUES (?, ?, ?, ?, 'masuk', NOW())", [id_k, id_tarif, id_area, id_user], (err) => {
            if (err) return res.status(500).json(err);
            // Langkah 3: Tambah jumlah slot terisi di area yang dipilih
            // terisi = terisi + 1 → cara aman menambah nilai tanpa race condition
            db.query("UPDATE tb_area_parkir SET terisi = terisi + 1 WHERE id_area = ?", [id_area]);
            // Langkah 4: Catat aktivitas ke log dengan info plat nomor
            simpanLog(id_user, `Kendaraan Masuk: ${plat_nomor}`);
            res.json({ success: true }); // Semua berhasil → konfirmasi ke frontend
        });
    });
});

// POST /api/transaksi/keluar
// Tujuan: Memproses kendaraan yang keluar: hitung biaya dan update database
// Alur kerja:
//   1. Cari data transaksi berdasarkan id_parkir
//   2. Hitung durasi parkir (waktu sekarang - waktu masuk)
//   3. Hitung total biaya (durasi × tarif)
//   4. Update transaksi: isi waktu_keluar, durasi_jam, biaya_total, status = 'keluar'
//   5. Kurangi jumlah terisi di area -1
//   6. Catat aktivitas ke log
app.post('/api/transaksi/keluar', (req, res) => {
    const { id_parkir } = req.body; // ID transaksi parkir yang mau diproses keluar
    // JOIN tb_transaksi dengan tb_tarif untuk mendapatkan harga tarif sekaligus
    db.query("SELECT t.*, tr.tarif_per_jam FROM tb_transaksi t JOIN tb_tarif tr ON t.id_tarif = tr.id_tarif WHERE t.id_parkir = ?", [id_parkir], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ message: "Data tidak ditemukan" });
        const data = results[0]; // Data transaksi yang ditemukan
        // Hitung durasi dalam jam, dibulatkan ke atas, minimal 1 jam
        const durasi = Math.ceil((new Date() - new Date(data.waktu_masuk)) / (1000 * 60 * 60)) || 1;
        const total = durasi * data.tarif_per_jam; // Total biaya = durasi × tarif per jam

        // Update transaksi: tandai sebagai 'keluar' dan isi semua field
        db.query("UPDATE tb_transaksi SET waktu_keluar = NOW(), durasi_jam = ?, biaya_total = ?, status = 'keluar' WHERE id_parkir = ?", [durasi, total, id_parkir], () => {
            // Kurangi jumlah slot terisi di area -1 karena kendaraan sudah keluar
            db.query("UPDATE tb_area_parkir SET terisi = terisi - 1 WHERE id_area = ?", [data.id_area]);
            simpanLog(data.id_user, `Kendaraan Keluar ID: ${id_parkir}`); // Catat ke log
            res.json({ success: true, biaya: total }); // Kirim total biaya ke frontend untuk ditampilkan di struk
        });
    });
});

// GET /api/kendaraan-aktif
// Tujuan: Mengambil daftar kendaraan yang saat ini masih berada di dalam parkir
// Digunakan oleh: halaman petugas untuk menampilkan tabel "Kendaraan di Dalam"
// Kondisi: hanya transaksi dengan status = 'masuk' yang ditampilkan
app.get('/api/kendaraan-aktif', (req, res) => {
    const sql = `
        SELECT t.id_parkir, t.waktu_masuk, k.plat_nomor 
        FROM tb_transaksi t
        JOIN tb_kendaraan k ON t.id_kendaraan = k.id_kendaraan
        WHERE t.status = 'masuk'
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results); // Kirim daftar kendaraan yang masih di dalam
    });
});


// ============================================================
// --- API OWNER: LAPORAN PENDAPATAN ---
// Endpoint khusus untuk fitur Owner: melihat laporan pemasukan
// ============================================================

// GET /api/owner/pendapatan?start=YYYY-MM-DD&end=YYYY-MM-DD
// Tujuan: Menghitung pendapatan parkir dalam berbagai periode
// Menghitung 3 kategori sekaligus dalam 1 query SQL:
//   1. hari_ini      : total pendapatan untuk tanggal hari ini
//   2. bulan_ini     : total pendapatan untuk bulan dan tahun berjalan
//   3. total_range   : total pendapatan untuk rentang tanggal yang dipilih owner
//   4. total_transaksi: jumlah transaksi yang sudah selesai
app.get('/api/owner/pendapatan', (req, res) => {
    const { start, end } = req.query; // Ambil tanggal mulai dan selesai dari query URL

    // SUM + CASE WHEN: cara SQL untuk menjumlahkan nilai dengan kondisi tertentu
    // CURDATE(): fungsi MySQL yang mengembalikan tanggal hari ini
    // MONTH() dan YEAR(): mengambil bulan dan tahun dari sebuah tanggal
    // BETWEEN: kondisi tanggal berada dalam rentang start-end
    const sql = `
        SELECT 
            SUM(CASE WHEN DATE(waktu_keluar) = CURDATE() THEN biaya_total ELSE 0 END) as hari_ini,
            SUM(CASE WHEN MONTH(waktu_keluar) = MONTH(CURDATE()) AND YEAR(waktu_keluar) = YEAR(CURDATE()) THEN biaya_total ELSE 0 END) as bulan_ini,
            SUM(CASE WHEN waktu_keluar BETWEEN ? AND ? THEN biaya_total ELSE 0 END) as total_range,
            COUNT(id_parkir) as total_transaksi
        FROM tb_transaksi 
        WHERE status = 'keluar'
    `;
    // Tambahkan jam 00:00:00 dan 23:59:59 agar pencarian mencakup seluruh hari
    db.query(sql, [start + " 00:00:00", end + " 23:59:59"], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results[0]); // Kirim object hasil (bukan array) karena hanya 1 baris hasil query
    });
});

// GET /api/owner/history
// Tujuan: Menampilkan riwayat pendapatan per-hari sesuai rentang tanggal yang dipilih
// Digunakan untuk tabel riwayat transaksi dan grafik di halaman owner
// GROUP BY tanggal: total pendapatan digabung per hari
app.get('/api/owner/history', (req, res) => {
    const { start, end } = req.query;
    
    // Default: 7 hari terakhir jika tidak ada parameter
    let sql, params;
    
    if (start && end) {
        // Filter berdasarkan tanggal yang dipilih user
        sql = `
            SELECT DATE(waktu_keluar) as tanggal, SUM(biaya_total) as pendapatan, COUNT(*) as jumlah_kendaraan
            FROM tb_transaksi 
            WHERE status = 'keluar' 
            AND DATE(waktu_keluar) BETWEEN ? AND ?
            GROUP BY DATE(waktu_keluar)
            ORDER BY tanggal DESC
        `;
        params = [start, end];
    } else {
        // Default 7 hari terakhir jika tidak ada filter
        sql = `
            SELECT DATE(waktu_keluar) as tanggal, SUM(biaya_total) as pendapatan, COUNT(*) as jumlah_kendaraan
            FROM tb_transaksi 
            WHERE status = 'keluar' 
            AND waktu_keluar >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(waktu_keluar)
            ORDER BY tanggal DESC
        `;
        params = [];
    }
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});


// ============================================================
// --- CRUD USER ---
// Mengelola data akun pengguna (admin, petugas, owner)
// Hanya bisa diakses dan dikelola oleh Admin
// ============================================================

// GET /api/users
// Tujuan: Mengambil semua data user (tapi tidak mengambil password, demi keamanan)
// Hanya mengembalikan: id_user, username, role, status_aktif
app.get('/api/users', (req, res) => {
    // Pastikan query ini mengambil data dari tabel yang benar
    // Sengaja TIDAK mengambil kolom password untuk alasan keamanan
    db.query("SELECT id_user, username, role, status_aktif FROM tb_user", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results); // Kirim daftar semua user
    });
});

// POST /api/users/add
// Tujuan: Membuat akun user baru (petugas, owner, atau admin)
// status_aktif diisi langsung dengan nilai 1 (aktif) untuk user baru
app.post('/api/users/add', (req, res) => {
    const { username, password, role } = req.body; // Ambil data user baru dari body request
    const sql = "INSERT INTO tb_user (username, password, role, status_aktif) VALUES (?, ?, ?, 1)";
    // nilai 1 di akhir = status_aktif = 1 (aktif) → user baru langsung aktif
    db.query(sql, [username, password, role], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true }); // User berhasil dibuat
    });
});

// PUT /api/users/status/:id
// Tujuan: Mengaktifkan atau menonaktifkan akun user (toggle status)
// Digunakan admin untuk suspend/aktifkan akun petugas atau owner
// status: 1 = aktif, 0 = nonaktif
app.put('/api/users/status/:id', (req, res) => {
    const { id } = req.params;    // ID user yang akan diubah statusnya
    const { status } = req.body; // Nilai status baru: 1 (aktif) atau 0 (nonaktif)
    const sql = "UPDATE tb_user SET status_aktif = ? WHERE id_user = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true }); // Konfirmasi perubahan status berhasil
    });
});

// PUT /api/users/:id
// Tujuan: Mengubah data user: username, role, dan opsional password
// Jika password dikirim kosong → jangan ubah password (tetap pakai yang lama)
// Jika password diisi → update password juga
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, role, password } = req.body; // Ambil semua field dari body
    // Default query: hanya update username dan role (password tidak diubah)
    let sql = "UPDATE tb_user SET username = ?, role = ? WHERE id_user = ?";
    let params = [username, role, id];

    if (password) {
        // Kalau password juga dikirim (tidak kosong), update password juga
        sql = "UPDATE tb_user SET username = ?, role = ?, password = ? WHERE id_user = ?";
        params = [username, role, password, id]; // Susun ulang parameter sesuai urutan di query
    }

    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true }); // Data user berhasil diperbarui
    });
});

// ============================================================
// START SERVER
// Menjalankan server Express di port 3000
// Setelah ini dijalankan, semua API di atas bisa diakses melalui:
// http://localhost:3000/api/...
// ============================================================
app.listen(3000, () => console.log('🚀 Server running on port 3000'));