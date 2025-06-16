const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const { randomBytes } = require('crypto');

// Helper SQL Injection sederhana
const containsSQLInjection = (input) => {
  if (typeof input !== 'string') {
    return false;
  } 
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Jadwal

const tambahJadwal = async (req, res) => {
  const { kelas_id, mapel_id, nip_guru, jadwal_hari } = req.body;

  try {
    // Validasi guru
    const [guru] = await db.query('SELECT nip FROM guru WHERE nip = ?', [nip_guru]);
    if (!guru || guru.length === 0) {
      return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan' });
    }

    // Validasi mata pelajaran dan ambil nama_mapel
    const [mapel] = await db.query('SELECT nama_mapel, kkm FROM mapel WHERE mapel_id = ?', [mapel_id]);
    if (!mapel || mapel.length === 0) {
      return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan' });
    }
    const nama_mapel = mapel[0].nama_mapel;
    const kkm = mapel[0].kkm;

    // Validasi kelas
    const [kelas] = await db.query('SELECT * FROM kelas WHERE kelas_id = ?', [kelas_id]);
    if (!kelas || kelas.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    }

    // Mulai transaksi
    await db.query('START TRANSACTION');

    try {
      const jadwalIds = [];
      
      // Loop untuk setiap hari yang dimasukkan
      for (const hariJadwal of jadwal_hari) {
        const { hari, jam_ke, start, finish, ruangan } = hariJadwal;
        
        if (!hari || !jam_ke || !start || !finish || !ruangan) {
          await db.query('ROLLBACK');
          return res.status(400).json({ 
            message: 'Setiap jadwal hari harus memiliki hari, jam_ke, start, finish, dan ruangan' 
          });
        }

        // Validasi jam_ke harus angka
        if (isNaN(jam_ke)) {
          await db.query('ROLLBACK');
          return res.status(400).json({ 
            message: 'Jam ke harus berupa angka' 
          });
        }

        // Generate IDs
        const master_jadwal_id = randomBytes(8).readBigUInt64BE().toString();
        const jadwal_id = randomBytes(8).readBigUInt64BE().toString();
        
        // 1. Insert to master_jadwal dengan jam_ke
        await db.query(
          `INSERT INTO master_jadwal 
           (master_jadwal_id, jam_ke, start, finish, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [master_jadwal_id, jam_ke, start, finish]
        );

        // 2. Insert to jadwal - TANPA NIP GURU karena kolom tidak ada
        await db.query(
          `INSERT INTO jadwal 
           (jadwal_id, master_jadwal_id, mapel_id, kelas_id, hari, ruangan, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [jadwal_id, master_jadwal_id, mapel_id, kelas_id, hari, ruangan]
        );

        jadwalIds.push({
          jadwal_id,
          master_jadwal_id,
          hari,
          jam_ke,
          ruangan
        });
      }

      // 3. Insert ke krs_detail untuk semua siswa di kelas tersebut
      const [krsList] = await db.query('SELECT krs_id FROM krs WHERE kelas_id = ?', [kelas_id]);
      
      if (krsList && krsList.length > 0) {
        for (const krs of krsList) {
          const [existing] = await db.query(
            'SELECT * FROM krs_detail WHERE krs_id = ? AND mapel_id = ?',
            [krs.krs_id, mapel_id]
          );
          
          if (!existing || existing.length === 0) {
            await db.query(
              `INSERT INTO krs_detail 
               (krs_id, mapel_id, guru_nip, nama_mapel, kkm, created_at) 
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [krs.krs_id, mapel_id, nip_guru, nama_mapel, kkm]
            );
          }
        }
      }

      // Commit transaksi jika semua berhasil
      await db.query('COMMIT');

      res.status(201).json({ 
	status : 201,
        message: 'Jadwal berhasil ditambahkan dan data KRS diperbarui.',
        data: {
          jadwal: jadwalIds,
          krs_updated: krsList ? krsList.length : 0
        }
      });

    } catch (error) {
      // Rollback jika ada error
      await db.query('ROLLBACK');
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'ID sudah digunakan atau data duplikat ditemukan'
        });
      }
      
      console.error('Error dalam transaksi:', error);
      res.status(500).json({ 
        message: 'Gagal menambahkan jadwal.', 
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error utama:', error);
    res.status(500).json({ 
      message: 'Gagal menambahkan jadwal.', 
      error: error.message 
    });
  }
};

// READ - Ambil Semua Jadwal
const getAllJadwal = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.ruangan,
        j.hari,  -- Mengambil 'hari' dari tabel jadwal
        mj.master_jadwal_id,
        mj.jam_ke, 
        DATE_FORMAT(mj.start, '%H:%i') AS start_time, 
        DATE_FORMAT(mj.finish, '%H:%i') AS finish_time,
        m.nama_mapel, 
        g.nama_guru,  -- Nama wali kelas
        k.nama_kelas,
        k.jenjang,
        k.tingkat
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id -- Join ke master_jadwal
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip -- Join ke guru via kelas untuk wali kelas
      ORDER BY j.hari, mj.jam_ke 
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data jadwal.', error: error.message });
  }
};

// READ - Ambil Jadwal Berdasarkan jadwal_id
const getJadwalById = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    // 1. Ambil data kelas terlebih dahulu
    const [kelasRows] = await db.query(`
      SELECT 
        k.kelas_id,
        k.nama_kelas,
        k.tingkat,
        k.guru_nip,
        g.nama_guru,
        k.jenjang,
        k.tahun_akademik_id,
        ta.tahun_mulai,
        ta.tahun_berakhir,
        k.created_at
      FROM kelas k
      JOIN guru g ON k.guru_nip = g.nip
      JOIN tahun_akademik ta ON k.tahun_akademik_id = ta.tahun_akademik_id
      WHERE k.kelas_id = ?
    `, [kelas_id]);

    if (kelasRows.length === 0) {
      return res.status(404).json({ 
        message: 'Kelas tidak ditemukan.' 
      });
    }

    const kelasData = {
      kelas_id: kelasRows[0].kelas_id,
      nama_kelas: kelasRows[0].nama_kelas,
      tingkat: kelasRows[0].tingkat,
      guru_nip: kelasRows[0].guru_nip,
      nama_guru: kelasRows[0].nama_guru,
      jenjang: kelasRows[0].jenjang,
      tahun_akademik_id: kelasRows[0].tahun_akademik_id,
      tahun_mulai: kelasRows[0].tahun_mulai,
      tahun_berakhir: kelasRows[0].tahun_berakhir,
      created_at: kelasRows[0].created_at
    };

    // 2. Ambil data jadwal untuk kelas tersebut dengan data guru pengampu
    const [jadwalRows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.master_jadwal_id,
        j.mapel_id,
        j.hari,
        j.ruangan,
        mj.jam_ke, 
        DATE_FORMAT(mj.start, '%H:%i') AS start_time, 
        DATE_FORMAT(mj.finish, '%H:%i') AS finish_time,
        m.nama_mapel,
        m.kkm,
        kd.guru_nip,
        g.nama_guru AS guru_pengampu
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN krs_detail kd ON (j.kelas_id = (
          SELECT kelas_id FROM krs WHERE krs_id = kd.krs_id LIMIT 1
        ) AND j.mapel_id = kd.mapel_id)
      JOIN guru g ON kd.guru_nip = g.nip
      WHERE j.kelas_id = ?
      GROUP BY j.jadwal_id, j.master_jadwal_id, j.mapel_id, j.hari, j.ruangan, 
               mj.jam_ke, mj.start, mj.finish, m.nama_mapel, m.kkm, kd.guru_nip, g.nama_guru
      ORDER BY j.hari, mj.jam_ke
    `, [kelas_id]);

    res.status(200).json({
      ...kelasData,
      jadwal: jadwalRows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal mengambil data jadwal.', 
      error: error.message 
    });
  }
};

// UPDATE - Edit Jadwal
// UPDATE - Edit Jadwal (tanpa validasi wajib isi semua field)
const updateJadwal = async (req, res) => {
  const { jadwal_id } = req.params;
  const { mapel_id, kelas_id, nip_guru, jadwal_hari } = req.body;

  try {
    // Mulai transaksi
    await db.query('START TRANSACTION');

    try {
      // 1. Validasi data yang akan diupdate
      // Cek apakah jadwal ada
      const [existingJadwal] = await db.query('SELECT * FROM jadwal WHERE jadwal_id = ?', [jadwal_id]);
      if (!existingJadwal || existingJadwal.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
      }

      const currentData = existingJadwal[0];

      // 2. Validasi guru jika nip_guru diubah
      if (nip_guru) {
        const [guru] = await db.query('SELECT nip FROM guru WHERE nip = ?', [nip_guru]);
        if (!guru || guru.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan' });
        }
      }

      // 3. Validasi mata pelajaran jika mapel_id diubah
      if (mapel_id) {
        const [mapel] = await db.query('SELECT nama_mapel FROM mapel WHERE mapel_id = ?', [mapel_id]);
        if (!mapel || mapel.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan' });
        }
      }

      // 4. Validasi kelas jika kelas_id diubah
      if (kelas_id) {
        const [kelas] = await db.query('SELECT * FROM kelas WHERE kelas_id = ?', [kelas_id]);
        if (!kelas || kelas.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).json({ message: 'Kelas tidak ditemukan' });
        }
      }

      // 5. Update data jadwal utama (hanya field yang berubah)
      const jadwalUpdates = [];
      const jadwalParams = [];
      
      if (mapel_id) jadwalUpdates.push('mapel_id = ?'), jadwalParams.push(mapel_id);
      if (kelas_id) jadwalUpdates.push('kelas_id = ?'), jadwalParams.push(kelas_id);
      
      if (jadwalUpdates.length > 0) {
        jadwalParams.push(jadwal_id);
        await db.query(
          `UPDATE jadwal SET ${jadwalUpdates.join(', ')} WHERE jadwal_id = ?`,
          jadwalParams
        );
      }

      // 6. Update guru_nip di krs_detail jika ada perubahan nip_guru
      if (nip_guru) {
        await db.query(`
          UPDATE krs_detail 
          SET guru_nip = ? 
          WHERE mapel_id = ? 
          AND krs_id IN (SELECT krs_id FROM krs WHERE kelas_id = ?)
        `, [
          nip_guru, 
          mapel_id || currentData.mapel_id, 
          kelas_id || currentData.kelas_id
        ]);
      }

      // 7. Update data jadwal per hari jika ada
      if (jadwal_hari && Array.isArray(jadwal_hari)) {
        for (const hariJadwal of jadwal_hari) {
          const { hari, jam_ke, start, finish, ruangan, master_jadwal_id } = hariJadwal;
          
          // Validasi minimal master_jadwal_id harus ada
          if (!master_jadwal_id) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'master_jadwal_id harus disertakan untuk update jadwal per hari' });
          }

          // Update master_jadwal (hanya field yang berubah)
          const masterUpdates = [];
          const masterParams = [];
          
          if (jam_ke !== undefined) masterUpdates.push('jam_ke = ?'), masterParams.push(jam_ke);
          if (start !== undefined) masterUpdates.push('start = ?'), masterParams.push(start);
          if (finish !== undefined) masterUpdates.push('finish = ?'), masterParams.push(finish);
          
          if (masterUpdates.length > 0) {
            masterParams.push(master_jadwal_id);
            await db.query(
              `UPDATE master_jadwal SET ${masterUpdates.join(', ')} WHERE master_jadwal_id = ?`,
              masterParams
            );
          }

          // Update jadwal per hari (hanya field yang berubah)
          const hariUpdates = [];
          const hariParams = [];
          
          if (hari !== undefined) hariUpdates.push('hari = ?'), hariParams.push(hari);
          if (ruangan !== undefined) hariUpdates.push('ruangan = ?'), hariParams.push(ruangan);
          
          if (hariUpdates.length > 0) {
            hariParams.push(master_jadwal_id);
            await db.query(
              `UPDATE jadwal SET ${hariUpdates.join(', ')} WHERE master_jadwal_id = ?`,
              hariParams
            );
          }
        }
      }

      // Commit transaksi jika semua berhasil
      await db.query('COMMIT');

      res.status(200).json({ 
        status: 200,
        success: true,
        message: 'Jadwal berhasil diperbarui.'
      });

    } catch (error) {
      // Rollback jika ada error
      await db.query('ROLLBACK');
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          status: 409,
          success: false,
          message: 'Konflik data - ID sudah digunakan'
        });
      }
      
      console.error('Error dalam update jadwal:', error);
      res.status(500).json({ 
        status: 500,
        success: false,
        message: 'Gagal memperbarui jadwal', 
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error utama update jadwal:', error);
    res.status(500).json({ 
      status: 500,
      success: false,
      message: 'Gagal memperbarui jadwal', 
      error: error.message 
    });
  }
};

const getJadwalByJadwalId = async (req, res) => {
  const { jadwal_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.master_jadwal_id,
        j.mapel_id,
        j.kelas_id,
        j.hari,
        j.ruangan,
        mj.jam_ke, 
        DATE_FORMAT(mj.start, '%H:%i') AS start_time, 
        DATE_FORMAT(mj.finish, '%H:%i') AS finish_time,
        m.nama_mapel,
        kd.guru_nip AS nip,
        g.nama_guru,
        k.nama_kelas,
        k.jenjang,
        k.tingkat
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN krs_detail kd ON j.mapel_id = kd.mapel_id
      JOIN guru g ON kd.guru_nip = g.nip
      WHERE j.jadwal_id = ?
      LIMIT 1
    `, [jadwal_id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data jadwal.', error: error.message });
  }
};


// DELETE - Hapus Jadwal
const hapusJadwal = async (req, res) => {
  const { jadwal_id } = req.params;

  try {
    // Mulai transaksi
    await db.query('START TRANSACTION');

    try {
      // 1. Ambil data jadwal yang akan dihapus
      const [jadwalRows] = await db.query(`
        SELECT 
          j.master_jadwal_id,
          j.mapel_id,
          j.kelas_id
        FROM jadwal j
        WHERE j.jadwal_id = ?
      `, [jadwal_id]);

      if (jadwalRows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Jadwal tidak ditemukan.'
        });
      }

      const { master_jadwal_id, mapel_id, kelas_id } = jadwalRows[0];

      // 2. Hapus data terkait di krs_detail (jika diperlukan)
      // Hanya jika ingin menghapus mapel dari krs_detail saat jadwal dihapus
      await db.query(`
        DELETE FROM krs_detail 
        WHERE mapel_id = ? 
        AND krs_id IN (SELECT krs_id FROM krs WHERE kelas_id = ?)
      `, [mapel_id, kelas_id]);

      // 3. Hapus dari tabel jadwal
      await db.query('DELETE FROM jadwal WHERE jadwal_id = ?', [jadwal_id]);

      // 4. Hapus dari tabel master_jadwal
      await db.query('DELETE FROM master_jadwal WHERE master_jadwal_id = ?', [master_jadwal_id]);

      // Commit transaksi jika semua berhasil
      await db.query('COMMIT');

      res.status(200).json({
        status: 200,
        success: true,
        message: 'Jadwal berhasil dihapus beserta data terkait.'
      });

    } catch (error) {
      // Rollback jika ada error
      await db.query('ROLLBACK');
      
      console.error('Error dalam penghapusan jadwal:', error);
      res.status(500).json({
        status: 500,
        success: false,
        message: 'Gagal menghapus jadwal',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Error utama penghapusan jadwal:', error);
    res.status(500).json({
      status: 500,
      success: false,
      message: 'Gagal menghapus jadwal',
      error: error.message
    });
  }
};

const getKelasJadwal = async (req, res) => {
  try {
    // Query untuk mengambil data kelas
    const [kelas] = await db.query(`
      SELECT 
        nama_kelas,
        tingkat,
        kelas_id
      FROM 
        kelas
      ORDER BY 
        tingkat, 
        nama_kelas
    `);

    // Format data sesuai tampilan yang diinginkan
    const formattedData = kelas.map((item, index) => ({
      no: index + 1,
      nama_kelas: item.nama_kelas.toUpperCase(), // Format menjadi uppercase seperti contoh
      tingkat: item.tingkat,
      kelas_id: item.kelas_id // Disertakan untuk keperluan aksi
    }));

    res.status(200).json({
      status: 200,
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error('Error fetching kelas data:', error);
    res.status(500).json({
      status: 500,
      success: false,
      message: 'Gagal mengambil data kelas',
      error: error.message
    });
  }
};

// DELETE - Hapus Semua Jadwal Berdasarkan Kelas ID
const hapusJadwalByKelasId = async (req, res) => {
  const { kelas_id } = req.params;

  if (!kelas_id) {
    return res.status(400).json({ message: 'kelas_id wajib diisi.' });
  }

  try {
    // 1. Ambil semua master_jadwal_id yang terkait dengan kelas_id
    // Ini penting agar kita bisa menghapus entri di tabel master_jadwal juga.
    const [jadwalRows] = await db.query(
      `SELECT master_jadwal_id FROM jadwal WHERE kelas_id = ?`,
      [kelas_id]
    );

    // Jika tidak ada jadwal yang ditemukan untuk kelas tersebut, kirim respons 404.
    if (jadwalRows.length === 0) {
      return res.status(404).json({ message: 'Tidak ada jadwal yang ditemukan untuk kelas ini.' });
    }

    // Kumpulkan semua ID master_jadwal yang akan dihapus.
    const masterJadwalIds = jadwalRows.map(j => j.master_jadwal_id);

    // 2. Gunakan transaksi untuk memastikan kedua operasi (delete) berhasil atau tidak sama sekali.
    await db.query('START TRANSACTION');

    try {
      // 3. Hapus semua entri dari tabel 'jadwal' yang cocok dengan kelas_id.
      // Ini sama dengan logika pada Stored Procedure Anda.
      await db.query(
        `DELETE FROM jadwal WHERE kelas_id = ?`, 
        [kelas_id]
      );

      // 4. Hapus semua entri dari tabel 'master_jadwal' yang terkait.
      // Ini mencegah data 'master_jadwal' menjadi yatim piatu (orphaned).
      await db.query(
        `DELETE FROM master_jadwal WHERE master_jadwal_id IN (?)`,
        [masterJadwalIds]
      );

      // 5. Jika kedua operasi berhasil, commit transaksi.
      await db.query('COMMIT');

      res.status(200).json({ message: `Semua jadwal untuk kelas ID ${kelas_id} berhasil dihapus.` });

    } catch (error) {
      // Jika terjadi error di tengah transaksi, rollback semua perubahan.
      await db.query('ROLLBACK');
      throw error; // Lemparkan error agar ditangkap oleh blok catch luar.
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal menghapus jadwal berdasarkan kelas.', 
      error: error.message 
    });
  }
}; 
 
module.exports = {
  tambahJadwal,
  getAllJadwal,
  getJadwalById,
  updateJadwal,
  hapusJadwal,
  getJadwalByJadwalId,
  getKelasJadwal,
  hapusJadwalByKelasId
};