const db = require('../database/db');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // <-- Import uuid

// Helper hash nama file agar unik
const hashFileName = (originalname) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1e6);
  const ext = path.extname(originalname);
  return `${timestamp}_${random}${ext}`;
};

const tambahSiswa = async (req, res) => {
  const {
    email, nama_siswa, nis, nisn, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin,
    agama, no_telepon,
    ayah_nik, ayah_nama, ayah_email, ayah_no_telepon, ayah_tanggal_lahir, ayah_tempat_lahir, ayah_alamat, ayah_pekerjaan,
    ibu_nik, ibu_nama, ibu_email, ibu_no_telepon, ibu_tanggal_lahir, ibu_tempat_lahir, ibu_alamat, ibu_pekerjaan,
    wali_nik, wali_nama, wali_email, wali_no_telepon, wali_tanggal_lahir, wali_tempat_lahir, wali_alamat, wali_pekerjaan
  } = req.body;

  const fotoProfil = req.file;
  const userPassword = bcrypt.hashSync('siswa123', 10);
  const ortuPassword = bcrypt.hashSync('ortu123', 10);

  const usernameFromEmail = email.split('@')[0];

  let filename = null;
  if (fotoProfil) {
    filename = hashFileName(fotoProfil.originalname);
    try {
      const newPath = path.join(fotoProfil.destination, filename);
      fs.renameSync(fotoProfil.path, newPath);
    } catch (fsError) {
      console.error("Error memindahkan file (tambahSiswa):", fsError);
      // Pertimbangkan untuk mengembalikan error di sini jika pemindahan file gagal
    }
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Generate user_id untuk siswa & Insert user siswa
    const userIdSiswa = uuidv4(); // <--- Generate UUID untuk user siswa
    // Pastikan tabel 'user' Anda memiliki kolom 'user_id' untuk menyimpan UUID ini
    await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at) 
        VALUES (?, ?, ?, ?, 'siswa', NOW())`, // <--- Tambahkan user_id di sini
        [userIdSiswa, usernameFromEmail, email, userPassword]);

    // 2. Insert siswa dengan user_id yang sudah digenerate
    await conn.query(`INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir,
        alamat, jenis_kelamin, agama, no_telepon, foto_profil, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [nis, userIdSiswa, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, // <--- Gunakan userIdSiswa
        jenis_kelamin, agama, no_telepon, filename]);

    // === AYAH ===
    if (ayah_nik && ayah_nama && ayah_email) {
      const userIdAyah = uuidv4(); // <--- Generate UUID untuk user ayah
      await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
          VALUES (?, ?, ?, ?, 'ortu', NOW())`, // <--- Tambahkan user_id
          [userIdAyah, ayah_no_telepon || `${ayah_nama.replace(/\s+/g, '').toLowerCase()}_ayah`, ayah_email, ortuPassword]);

      await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
          pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
          VALUES (?, ?, ?, ?, 'ayah', ?, ?, ?, ?, NOW())`,
          [ayah_nik, userIdAyah, ayah_nama, ayah_alamat, // <--- Gunakan userIdAyah
          ayah_pekerjaan, ayah_tempat_lahir, ayah_tanggal_lahir, ayah_no_telepon]);

      await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ayah_nik]);
    }

    // === IBU ===
    if (ibu_nik && ibu_nama && ibu_email) {
      const userIdIbu = uuidv4(); // <--- Generate UUID untuk user ibu
      await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
          VALUES (?, ?, ?, ?, 'ortu', NOW())`, // <--- Tambahkan user_id
          [userIdIbu, ibu_no_telepon || `${ibu_nama.replace(/\s+/g, '').toLowerCase()}_ibu`, ibu_email, ortuPassword]);

      await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
          pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
          VALUES (?, ?, ?, ?, 'ibu', ?, ?, ?, ?, NOW())`,
          [ibu_nik, userIdIbu, ibu_nama, ibu_alamat, // <--- Gunakan userIdIbu
          ibu_pekerjaan, ibu_tempat_lahir, ibu_tanggal_lahir, ibu_no_telepon]);

      await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ibu_nik]);
    }
    
    // === WALI (jika ada) ===
    if (wali_nik && wali_nama && wali_email) {
      const userIdWali = uuidv4(); // <--- Generate UUID untuk user wali
      await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
          VALUES (?, ?, ?, ?, 'ortu', NOW())`, // <--- Tambahkan user_id
          [userIdWali, wali_no_telepon || `${wali_nama.replace(/\s+/g, '').toLowerCase()}_wali`, wali_email, ortuPassword]);

      await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
          pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
          VALUES (?, ?, ?, ?, 'wali', ?, ?, ?, ?, NOW())`,
          [wali_nik, userIdWali, wali_nama, wali_alamat, // <--- Gunakan userIdWali
          wali_pekerjaan, wali_tempat_lahir, wali_tanggal_lahir, wali_no_telepon]);

      await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, wali_nik]);
    }

    await conn.commit();
    res.status(201).json({ message: 'Data siswa beserta orang tua (dan wali jika ada) berhasil ditambahkan.' });
  } catch (error) {
    await conn.rollback();
    console.error("Error saat tambahSiswa:", error);
    if (filename && fotoProfil) {
        try {
            fs.unlinkSync(path.join(fotoProfil.destination, filename));
        } catch (unlinkErr) {
            console.error("Error menghapus file setelah rollback:", unlinkErr);
        }
    }
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) {
        conn.release();
    }
  }
};

// UPDATE - Update data siswa dan ortu/wali menggunakan Stored Procedure
const  updateSiswa = async (req, res) => {
  const old_nis_param = req.params.nis; // NIS lama siswa dari URL parameter

  // Ambil data dari body request
  const {
    // Field untuk Siswa
    new_nis, // NIS baru siswa, jika ada perubahan NIS
    nisn,
    nama_siswa,
    tanggal_lahir_siswa,
    tempat_lahir_siswa,
    alamat_siswa,
    jenis_kelamin_siswa,
    agama_siswa,
    no_telepon_siswa,
    // foto_profil_siswa tidak diambil dari body, tapi dari req.file

    // Field untuk Ayah
    ayah_nik, // NIK lama ayah (sebagai identifier)
    ayah_new_nik, // NIK baru ayah, jika ada perubahan NIK
    ayah_nama,
    ayah_imei, // Sesuai SP sp_update_ortu
    ayah_alamat,
    ayah_pekerjaan,
    ayah_tempat_lahir,
    ayah_tanggal_lahir,
    ayah_no_telepon,
    ayah_foto_profil, // Diasumsikan path string ke foto, bukan file upload baru untuk ortu di endpoint ini

    // Field untuk Ibu
    ibu_nik, // NIK lama ibu
    ibu_new_nik, // NIK baru ibu, jika ada perubahan NIK
    ibu_nama,
    ibu_imei,
    ibu_alamat,
    ibu_pekerjaan,
    ibu_tempat_lahir,
    ibu_tanggal_lahir,
    ibu_no_telepon,
    ibu_foto_profil,

    // Field untuk Wali
    wali_nik, // NIK lama wali
    wali_new_nik, // NIK baru wali, jika ada perubahan NIK
    wali_nama,
    wali_imei,
    wali_alamat,
    wali_pekerjaan,
    wali_tempat_lahir,
    wali_tanggal_lahir,
    wali_no_telepon,
    wali_foto_profil
  } = req.body;

  const siswaFotoProfilFile = req.file; // File foto profil siswa dari upload (misal: multer)
  let newSiswaFotoProfilFilename = null;
  let oldSiswaFotoProfilPath = null; // Untuk menghapus foto lama jika diganti

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // 0. Jika ada file foto siswa baru, proses dulu
    if (siswaFotoProfilFile) {
      // Ambil path foto lama untuk dihapus nanti jika update berhasil
      const [siswaDataOld] = await conn.query('SELECT foto_profil FROM siswa WHERE nis = ?', [old_nis_param]);
      if (siswaDataOld.length > 0 && siswaDataOld[0].foto_profil) {
        // Asumsikan foto disimpan di 'uploads/' relatif terhadap direktori aplikasi
        // atau `siswaFotoProfilFile.destination` jika konsisten.
        // Perlu path absolut atau relatif yang benar ke file lama.
        // Untuk amannya, Anda mungkin perlu menyimpan path lengkap di DB atau memiliki base path yang dikonfigurasi.
        // Contoh: oldSiswaFotoProfilPath = path.join(__dirname, '..', 'uploads', siswaDataOld[0].foto_profil);
        // Untuk contoh ini, kita asumsikan destination dari multer adalah tempat foto disimpan.
         if (siswaFotoProfilFile.destination) {
            oldSiswaFotoProfilPath = path.join(siswaFotoProfilFile.destination, siswaDataOld[0].foto_profil);
        } else {
            // Fallback jika destination tidak tersedia di file object (kurang ideal)
            console.warn("Destination path for old photo is unknown. Cannot ensure deletion.");
        }
      }

      newSiswaFotoProfilFilename = hashFileName(siswaFotoProfilFile.originalname);
      const newPath = path.join(siswaFotoProfilFile.destination, newSiswaFotoProfilFilename);
      fs.renameSync(siswaFotoProfilFile.path, newPath); // Pindahkan file yang diupload
    }

    // 1. Panggil Stored Procedure untuk update data siswa
    // Parameter ke SP: in_old_nis, in_new_nis, in_nisn, ..., in_foto_profil
    await conn.query('CALL sp_update_siswa(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      old_nis_param,
      new_nis || null, // Jika new_nis tidak ada, kirim null (SP akan COALESCE ke NIS lama)
      nisn || null,
      nama_siswa || null,
      tanggal_lahir_siswa || null,
      tempat_lahir_siswa || null,
      alamat_siswa || null,
      jenis_kelamin_siswa || null,
      agama_siswa || null,
      no_telepon_siswa || null,
      newSiswaFotoProfilFilename // Nama file foto baru, atau null jika tidak ada perubahan foto
                                 // Jika null, SP akan COALESCE ke foto_profil lama
    ]);

    // Tentukan NIS final siswa (baru atau lama) untuk digunakan di update siswa_ortu
    const final_nis_siswa = new_nis || old_nis_param;

    // Jika NIS siswa berubah, update juga di tabel siswa_ortu
    if (new_nis && new_nis !== old_nis_param) {
      await conn.query('UPDATE siswa_ortu SET nis = ? WHERE nis = ?', [new_nis, old_nis_param]);
    }

    // 2. Update data Ayah (jika ayah_nik disediakan di body)
    if (ayah_nik) {
      await conn.query('CALL sp_update_ortu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        ayah_nik,         // in_old_nik (NIK Ayah yang sekarang)
        ayah_new_nik || null, // in_new_nik (NIK baru Ayah jika berubah)
        ayah_nama || null,
        ayah_imei || null,
        ayah_alamat || null,
        'ayah',           // in_status_ortu
        ayah_pekerjaan || null,
        ayah_tempat_lahir || null,
        ayah_tanggal_lahir || null,
        ayah_no_telepon || null,
        ayah_foto_profil || null // in_foto_profil (path string, bukan file upload baru)
      ]);

      // Jika NIK Ayah berubah, update juga di tabel siswa_ortu
      if (ayah_new_nik && ayah_new_nik !== ayah_nik) {
        await conn.query('UPDATE siswa_ortu SET nik = ? WHERE nis = ? AND nik = ?', [
          ayah_new_nik,
          final_nis_siswa, // Gunakan NIS siswa yang final (mungkin sudah baru)
          ayah_nik         // NIK Ayah yang lama
        ]);
      }
    }

    // 3. Update data Ibu (jika ibu_nik disediakan di body)
    if (ibu_nik) {
      await conn.query('CALL sp_update_ortu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        ibu_nik,
        ibu_new_nik || null,
        ibu_nama || null,
        ibu_imei || null,
        ibu_alamat || null,
        'ibu',
        ibu_pekerjaan || null,
        ibu_tempat_lahir || null,
        ibu_tanggal_lahir || null,
        ibu_no_telepon || null,
        ibu_foto_profil || null
      ]);

      if (ibu_new_nik && ibu_new_nik !== ibu_nik) {
        await conn.query('UPDATE siswa_ortu SET nik = ? WHERE nis = ? AND nik = ?', [
          ibu_new_nik,
          final_nis_siswa,
          ibu_nik
        ]);
      }
    }

    // 4. Update data Wali (jika wali_nik disediakan di body)
    if (wali_nik) {
      await conn.query('CALL sp_update_ortu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        wali_nik,
        wali_new_nik || null,
        wali_nama || null,
        wali_imei || null,
        wali_alamat || null,
        'wali',
        wali_pekerjaan || null,
        wali_tempat_lahir || null,
        wali_tanggal_lahir || null,
        wali_no_telepon || null,
        wali_foto_profil || null
      ]);

      if (wali_new_nik && wali_new_nik !== wali_nik) {
        await conn.query('UPDATE siswa_ortu SET nik = ? WHERE nis = ? AND nik = ?', [
          wali_new_nik,
          final_nis_siswa,
          wali_nik
        ]);
      }
    }

    await conn.commit(); // Commit transaksi jika semua berhasil

    // Jika ada foto siswa lama dan berhasil diupdate dengan foto baru, hapus foto lama
    if (oldSiswaFotoProfilPath && newSiswaFotoProfilFilename) {
        try {
            if (fs.existsSync(oldSiswaFotoProfilPath)) {
                 // Pastikan file lama tidak sama dengan file baru (jika namanya kebetulan sama)
                if (path.basename(oldSiswaFotoProfilPath) !== newSiswaFotoProfilFilename) {
                    fs.unlinkSync(oldSiswaFotoProfilPath);
                    console.log("Foto profil siswa lama berhasil dihapus:", oldSiswaFotoProfilPath);
                }
            }
        } catch (unlinkError) {
            console.error("Gagal menghapus foto profil siswa lama:", unlinkError);
            // Tidak perlu rollback transaksi DB karena data sudah berhasil diupdate
        }
    }

    res.json({ message: 'Data siswa dan orang tua/wali berhasil diperbarui.' });

  } catch (error) {
    await conn.rollback(); // Rollback transaksi jika ada error
    console.error("Error saat  updateSiswa:", error);

    // Jika ada file baru yang sudah dipindahkan tapi transaksi gagal, hapus file baru tersebut
    if (newSiswaFotoProfilFilename && siswaFotoProfilFile) {
        try {
            const uploadedFilePath = path.join(siswaFotoProfilFile.destination, newSiswaFotoProfilFilename);
            if (fs.existsSync(uploadedFilePath)) {
                fs.unlinkSync(uploadedFilePath);
                console.log("File foto siswa baru yang gagal diupload berhasil dihapus:", uploadedFilePath);
            }
        } catch (cleanupError) {
            console.error("Gagal menghapus file foto siswa baru setelah rollback:", cleanupError);
        }
    }
    
    res.status(500).json({ error: `Terjadi kesalahan pada server: ${error.message}` });
  } finally {
    if (conn) {
      conn.release(); // Selalu lepaskan koneksi
    }
  }
};

// READ - Get semua siswa (dari kode asli)
const getAllSiswa = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, u.email 
      FROM siswa s 
      JOIN user u ON s.user_id = u.user_id
    `); // Komentar JavaScript dihapus dari sini
    res.json(rows);
  } catch (error) {
    console.error("Error saat getAllSiswa:", error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE - Hapus siswa (dari kode asli, mungkin perlu penyesuaian untuk menghapus relasi ortu & user)
const deleteSiswa = async (req, res) => {
  const { nis } = req.params;
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Dapatkan user_id siswa dan nama file foto profilnya
    const [siswaData] = await conn.query('SELECT user_id, foto_profil FROM siswa WHERE nis = ?', [nis]);
    if (siswaData.length === 0) {
      await conn.rollback(); // Tidak perlu rollback jika data tidak ada, cukup rilis koneksi
      conn.release();
      return res.status(404).json({ message: 'Siswa tidak ditemukan.' });
    }
    const userIdSiswa = siswaData[0].user_id;
    const fotoProfilSiswa = siswaData[0].foto_profil;

    // 2. Dapatkan NIK semua ortu/wali yang terhubung dengan siswa ini
    const [ortuNiksData] = await conn.query('SELECT nik FROM siswa_ortu WHERE nis = ?', [nis]);

    // 3. Hapus relasi siswa dengan ortu/wali dari tabel siswa_ortu
    await conn.query('DELETE FROM siswa_ortu WHERE nis = ?', [nis]);

    // 4. Hapus data siswa dari tabel siswa
    await conn.query('DELETE FROM siswa WHERE nis = ?', [nis]);

    // 5. Hapus user siswa dari tabel user (jika ada user_id terkait)
    if (userIdSiswa) {
      // Menggunakan user_id sesuai nama kolom di tabel user Anda
      await conn.query('DELETE FROM user WHERE user_id = ?', [userIdSiswa]);
    }
    
    // 6. Hapus file foto profil siswa dari server (jika ada)
    if (fotoProfilSiswa) {
      // Path yang benar ke direktori upload Anda dari root proyek
      const fotoPath = path.join(process.cwd(), 'Upload', 'profile_image', fotoProfilSiswa); 
                                  // ^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  // Root proyek     Lokasi folder Anda

      if (fs.existsSync(fotoPath)) {
        try {
          fs.unlinkSync(fotoPath);
          console.log(`Foto profil siswa ${fotoProfilSiswa} berhasil dihapus dari ${fotoPath}.`);
        } catch (unlinkErr) {
          console.error(`Gagal menghapus foto ${fotoProfilSiswa} dari ${fotoPath}:`, unlinkErr);
        }
      } else {
        console.warn(`Foto profil siswa ${fotoProfilSiswa} tidak ditemukan di path: ${fotoPath}.`); // Pesan diperjelas
      }
    }

    // 7. Untuk setiap NIK ortu/wali yang sebelumnya terhubung:
    //    Cek apakah ortu/wali tersebut masih terhubung dengan siswa lain.
    //    Jika tidak, hapus data ortu/wali dan user ortu/wali terkait.
    for (const nikData of ortuNiksData) {
      const nikOrtu = nikData.nik;
      const [otherSiswaConnections] = await conn.query('SELECT COUNT(*) as count FROM siswa_ortu WHERE nik = ?', [nikOrtu]);
      
      if (otherSiswaConnections[0].count === 0) {
        // Ortu/wali ini tidak lagi terhubung ke siswa manapun, kita bisa pertimbangkan untuk menghapusnya.
        const [ortuData] = await conn.query('SELECT user_id, foto_profil FROM ortu WHERE nik = ?', [nikOrtu]); // Ambil juga foto_profil ortu jika ada
        
        if (ortuData.length > 0) {
          const userIdOrtu = ortuData[0].user_id;
          const fotoProfilOrtu = ortuData[0].foto_profil; // Nama file foto profil ortu

          // Hapus dari tabel ortu
          await conn.query('DELETE FROM ortu WHERE nik = ?', [nikOrtu]);
          console.log(`Data ortu dengan NIK ${nikOrtu} berhasil dihapus.`);

          // Hapus user ortu/wali dari tabel user (jika ada user_id terkait)
          if (userIdOrtu) {
            // Menggunakan user_id sesuai nama kolom di tabel user Anda
            await conn.query('DELETE FROM user WHERE user_id = ?', [userIdOrtu]);
            console.log(`User ortu dengan user_id ${userIdOrtu} berhasil dihapus.`);
          }

          // Hapus file foto profil ortu dari server (jika ada dan jika Anda menyimpannya)
          if (fotoProfilOrtu) {
            // Sesuaikan path ini dengan lokasi penyimpanan foto ortu Anda
            const fotoOrtuPath = path.join(process.cwd(), 'public', 'uploads', 'ortu', fotoProfilOrtu); // Contoh path
            if (fs.existsSync(fotoOrtuPath)) {
              try {
                fs.unlinkSync(fotoOrtuPath);
                console.log(`Foto profil ortu ${fotoProfilOrtu} berhasil dihapus.`);
              } catch (unlinkErr) {
                console.error(`Gagal menghapus foto ortu ${fotoProfilOrtu}:`, unlinkErr);
              }
            } else {
                console.log(`Foto profil ortu ${fotoProfilOrtu} tidak ditemukan untuk dihapus.`);
            }
          }
        }
      }
    }

    await conn.commit();
    res.json({ message: 'Data siswa dan data terkait (user, relasi ortu, foto) berhasil dihapus.' });
  } catch (error) {
    await conn.rollback();
    console.error("Error saat deleteSiswa:", error);
    res.status(500).json({ error: `Terjadi kesalahan pada server: ${error.message}` });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const getSiswaBynis = async (req, res) => {
  const { nis } = req.params;
  try {
    // Query untuk mendapatkan data siswa
    const [siswaRows] = await db.query(`
      SELECT s.*, u.email 
      FROM siswa s 
      JOIN user u ON s.user_id = u.user_id 
      WHERE s.nis = ?
    `, [nis]); // Komentar JavaScript dihapus dari sini

    if (siswaRows.length === 0) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan.' });
    }
    const siswaData = siswaRows[0];

    // Query untuk mendapatkan data orang tua/wali yang terhubung
    const [ortuRows] = await db.query(`
      SELECT o.*, u.email as ortu_email, o.status_ortu
      FROM ortu o
      JOIN user u ON o.user_id = u.user_id 
      JOIN siswa_ortu so ON o.nik = so.nik
      WHERE so.nis = ?
    `, [nis]); // Komentar JavaScript dihapus dari sini
    
    siswaData.orang_tua_wali = ortuRows.map(ortu => {
        return {
            nik: ortu.nik,
            nama: ortu.nama_ortu,
            status: ortu.status_ortu,
            email: ortu.ortu_email,
            no_telepon: ortu.no_telepon,
            pekerjaan: ortu.pekerjaan,
            alamat: ortu.alamat,
        };
    });

    res.json(siswaData);
  } catch (error) {
    console.error("Error getSiswaBynis:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  tambahSiswa,
  getAllSiswa,
  updateSiswa,
  deleteSiswa,
  getSiswaBynis
};
