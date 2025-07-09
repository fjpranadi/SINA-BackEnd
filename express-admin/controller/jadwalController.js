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

    // VALIDATION: Check if there are any students in the class (via KRS entries)
    const [studentsInClass] = await db.query('SELECT krs_id FROM krs WHERE kelas_id = ?', [kelas_id]);
    if (!studentsInClass || studentsInClass.length === 0) {
      return res.status(400).json({
        message: 'Tidak dapat menambah jadwal karena tidak ada siswa di kelas ini.'
      });
    }

    // Mulai transaksi
    await db.query('START TRANSACTION');

    try {
      const jadwalIds = [];

      // Validasi semua jadwal sebelum insert
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

        // Validasi format waktu
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(start) || !timeRegex.test(finish)) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            message: 'Format waktu harus HH:MM (24 jam)'
          });
        }

        // Validasi waktu finish harus setelah start
        const startTime = new Date(`1970-01-01T${start}:00`);
        const finishTime = new Date(`1970-01-01T${finish}:00`);
        if (finishTime <= startTime) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            message: 'Waktu selesai harus setelah waktu mulai'
          });
        }

        // 1. Validasi bentrok dengan jadwal guru yang sama di hari dan jam yang sama
        const [guruBentrok] = await db.query(`
          SELECT j.jadwal_id, m.nama_mapel, k.nama_kelas, mj.start, mj.finish
          FROM jadwal j
          JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
          JOIN mapel m ON j.mapel_id = m.mapel_id
          JOIN kelas k ON j.kelas_id = k.kelas_id
          JOIN krs_detail kd ON j.mapel_id = kd.mapel_id AND j.kelas_id = (
              SELECT kelas_id FROM krs WHERE krs_id = kd.krs_id LIMIT 1
            )
          WHERE kd.guru_nip = ?
          AND j.hari = ?
          AND (
            (mj.start < ? AND mj.finish > ?) OR
            (mj.start < ? AND mj.finish > ?) OR
            (mj.start >= ? AND mj.finish <= ?)
            OR (mj.start <= ? AND mj.finish >= ?)
          )
        `, [nip_guru, hari,
            start, start,
            finish, finish,
            start, finish,
            start, finish]);

        if (guruBentrok.length > 0) {
          await db.query('ROLLBACK');
          return res.status(409).json({
            message: `Guru sudah mengajar ${guruBentrok[0].nama_mapel} di kelas ${guruBentrok[0].nama_kelas} pada hari ${hari} jam ${guruBentrok[0].start}-${guruBentrok[0].finish}`,
            conflicting_schedule: guruBentrok[0]
          });
        }

        // 2. Validasi bentrok dengan ruangan yang sama di hari dan jam yang sama
        const [ruanganBentrok] = await db.query(`
          SELECT j.jadwal_id, m.nama_mapel, k.nama_kelas, mj.start, mj.finish
          FROM jadwal j
          JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
          JOIN mapel m ON j.mapel_id = m.mapel_id
          JOIN kelas k ON j.kelas_id = k.kelas_id
          WHERE j.ruangan = ?
          AND j.hari = ?
          AND (
            (mj.start < ? AND mj.finish > ?) OR
            (mj.start < ? AND mj.finish > ?) OR
            (mj.start >= ? AND mj.finish <= ?)
            OR (mj.start <= ? AND mj.finish >= ?)
          )
        `, [ruangan, hari,
            start, start,
            finish, finish,
            start, finish,
            start, finish]);

        if (ruanganBentrok.length > 0) {
          await db.query('ROLLBACK');
          return res.status(409).json({
            message: `Ruangan ${ruangan} sudah digunakan untuk ${ruanganBentrok[0].nama_mapel} di kelas ${ruanganBentrok[0].nama_kelas} pada hari ${hari} jam ${ruanganBentrok[0].start}-${ruanganBentrok[0].finish}`,
            conflicting_schedule: ruanganBentrok[0]
          });
        }

        // 3. Validasi bentrok dengan kelas yang sama di hari dan jam yang sama
        const [kelasBentrok] = await db.query(`
          SELECT j.jadwal_id, m.nama_mapel, k.nama_kelas, mj.start, mj.finish
          FROM jadwal j
          JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
          JOIN mapel m ON j.mapel_id = m.mapel_id
          JOIN kelas k ON j.kelas_id = k.kelas_id
          WHERE j.kelas_id = ?
          AND j.hari = ?
          AND (
            (mj.start < ? AND mj.finish > ?) OR
            (mj.start < ? AND mj.finish > ?) OR
            (mj.start >= ? AND mj.finish <= ?)
            OR (mj.start <= ? AND mj.finish >= ?)
          )
        `, [kelas_id, hari,
            start, start,
            finish, finish,
            start, finish,
            start, finish]);

        if (kelasBentrok.length > 0) {
          await db.query('ROLLBACK');
          return res.status(409).json({
            message: `Kelas ${kelasBentrok[0].nama_kelas} sudah memiliki jadwal ${kelasBentrok[0].nama_mapel} pada hari ${hari} jam ${kelasBentrok[0].start}-${kelasBentrok[0].finish}`,
            conflicting_schedule: kelasBentrok[0]
          });
        }
      }

      // Jika semua validasi berhasil, lanjutkan dengan insert menggunakan SPs
      for (const hariJadwal of jadwal_hari) {
        const { hari, jam_ke, start, finish, ruangan } = hariJadwal;

        // Generate IDs
        const master_jadwal_id = randomBytes(8).readBigUInt64BE().toString();
        const jadwal_id = randomBytes(8).readBigUInt64BE().toString();

        // 1. Insert to master_jadwal using Stored Procedure
        await db.query(
          'CALL admin_create_master_jadwal(?, ?, ?, ?)',
          [master_jadwal_id, jam_ke, start, finish]
        );

        // 2. Insert to jadwal using Stored Procedure
        await db.query(
          'CALL admin_create_jadwal(?, ?, ?, ?, ?, ?)',
          [jadwal_id, master_jadwal_id, mapel_id, kelas_id, hari, ruangan]
        );

        jadwalIds.push({
          jadwal_id,
          master_jadwal_id,
          hari,
          jam_ke,
          ruangan,
          start,
          finish
        });
      }

      // 3. Insert ke krs_detail untuk semua siswa di kelas tersebut (no SP provided for this)
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
        status: 201,
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

// READ - Ambil Semua Jadwal (No specific SP for global read, keeping original query)
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

// READ - Ambil Jadwal Berdasarkan kelas_id (using sp_read_jadwal_by_kelas_id)
const getJadwalById = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    // Using the stored procedure sp_read_jadwal_by_kelas_id
    // Pass NULL for 'hari' to get all schedules for the class regardless of day
    const [spResult] = await db.query('CALL sp_read_jadwal_by_kelas_id(?, NULL)', [kelas_id]);

    // The SP returns an array of results. The actual data is usually in the first element.
    const jadwalRows = spResult[0];

    if (!jadwalRows || jadwalRows.length === 0) {
        // If no jadwal found, check if the class exists independently
        const [kelasCheck] = await db.query('SELECT kelas_id FROM kelas WHERE kelas_id = ?', [kelas_id]);
        if (kelasCheck.length === 0) {
            return res.status(404).json({
                message: 'Kelas tidak ditemukan.'
            });
        }
        // If class exists but no schedules, return empty jadwal
        return res.status(200).json({
            kelas_id: kelas_id, // We know kelas_id exists
            nama_kelas: kelasCheck[0].nama_kelas, // assuming you might want to fetch this if only class exists
            // ... other class details if needed, fetched separately or inferred
            jadwal: []
        });
    }

    // Extract class-level data from the first row (assuming it's consistent for all schedules in the same class)
    const kelasData = {
      kelas_id: jadwalRows[0].kelas_id,
      nama_kelas: jadwalRows[0].nama_kelas,
      tingkat: jadwalRows[0].tingkat,
      guru_nip: jadwalRows[0].guru_nip, // This is wali kelas nip from SP (k.guru_nip)
      nama_guru: jadwalRows[0].nama_guru, // This is wali kelas nama from SP (g.nama_guru)
      // The SP doesn't directly return jenjang, tahun_akademik_id, tahun_mulai, tahun_berakhir, created_at for the class.
      // If these are strictly required, you'd need another query or modify the SP.
      // For now, mapping available fields.
    };

    // Map the SP results to the desired jadwal array structure
    const formattedJadwal = jadwalRows.map(row => ({
      jadwal_id: row.jadwal_id,
      master_jadwal_id: row.master_jadwal_id,
      mapel_id: row.mapel_id,
      hari: row.hari,
      ruangan: row.ruangan, // SP doesn't return ruangan. Need to adjust or add to SP.
                            // Assuming 'ruangan' needs to be added to the SP's SELECT statement.
                            // For now, it will be undefined unless the SP is updated.
      jam_ke: row.jam_ke,
      start_time: row.start, // SP returns TIME type, re-format if needed, but 'start' is fine
      finish_time: row.finish, // SP returns TIME type, re-format if needed, but 'finish' is fine
      nama_mapel: row.nama_mapel,
      kkm: row.kkm, // SP doesn't return kkm. Need to adjust or add to SP.
      guru_nip: row.guru_nip, // This is guru pengampu nip from SP (kd.guru_nip)
      guru_pengampu: row.nama_guru // This is guru pengampu name from SP (g.nama_guru) - conflicts with wali kelas name if not careful
                                   // The SP uses g.nama_guru for the guru from krs_detail.
                                   // The original getJadwalById used k.guru_nip for wali kelas, and kd.guru_nip + g.nama_guru for pengampu.
                                   // The SP needs modification to distinguish these or you need to make another query.
    }));

    // To properly differentiate wali kelas and guru pengampu and get all class details,
    // the sp_read_jadwal_by_kelas_id would ideally be modified, or you would perform
    // a separate query for class details as in the original implementation.
    // For now, I'm providing a structure that *can* be built from the SP.
    // NOTE: The `ruangan` and `kkm` fields are NOT returned by `sp_read_jadwal_by_kelas_id`.
    // You would need to modify the SP to include them if they are essential.
    res.status(200).json({
      ...kelasData,
      jadwal: formattedJadwal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Gagal mengambil data jadwal.',
      error: error.message
    });
  }
};

// UPDATE - Edit Jadwal (using admin_update_jadwal SP)
const updateJadwal = async (req, res) => {
  const { jadwal_id } = req.params;
  const { mapel_id, kelas_id, nip_guru, jadwal_hari } = req.body;

  try {
    // Mulai transaksi
    await db.query('START TRANSACTION');

    try {
      // 1. Validasi data yang akan diupdate
      // Cek apakah jadwal ada
      const [existingJadwal] = await db.query(`
        SELECT j.*, mj.start, mj.finish, mj.jam_ke
        FROM jadwal j
        JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
        WHERE j.jadwal_id = ?
      `, [jadwal_id]);

      if (!existingJadwal || existingJadwal.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Jadwal tidak ditemukan.'
        });
      }

      const currentData = existingJadwal[0];

      // 2. Validasi guru jika nip_guru diubah
      if (nip_guru) {
        const [guru] = await db.query('SELECT nip FROM guru WHERE nip = ?', [nip_guru]);
        if (!guru || guru.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).json({
            status: 404,
            success: false,
            message: 'Guru dengan NIP tersebut tidak ditemukan'
          });
        }
      }

      // 3. Validasi mata pelajaran jika mapel_id diubah
      let nama_mapel = null;
      let kkm = null; // Also fetch KKM for krs_detail update
      if (mapel_id) {
        const [mapel] = await db.query('SELECT nama_mapel, kkm FROM mapel WHERE mapel_id = ?', [mapel_id]);
        if (!mapel || mapel.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).json({
            status: 404,
            success: false,
            message: 'Mata pelajaran tidak ditemukan'
          });
        }
        nama_mapel = mapel[0].nama_mapel;
        kkm = mapel[0].kkm;
      }

      // 4. Validasi kelas jika kelas_id diubah
      if (kelas_id) {
        const [kelas] = await db.query('SELECT * FROM kelas WHERE kelas_id = ?', [kelas_id]);
        if (!kelas || kelas.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).json({
            status: 404,
            success: false,
            message: 'Kelas tidak ditemukan'
          });
        }
      }

      // 5. Validasi jadwal_hari untuk mencegah bentrok
      if (jadwal_hari && Array.isArray(jadwal_hari)) {
        for (const hariJadwal of jadwal_hari) {
          const { hari, jam_ke, start, finish, ruangan, master_jadwal_id } = hariJadwal;

          // Validasi minimal master_jadwal_id harus ada
          if (!master_jadwal_id) {
            await db.query('ROLLBACK');
            return res.status(400).json({
              status: 400,
              success: false,
              message: 'master_jadwal_id harus disertakan untuk update jadwal per hari'
            });
          }

          // Validasi format waktu jika ada perubahan
          if (start !== undefined || finish !== undefined) {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            const checkStart = start !== undefined ? start : currentData.start;
            const checkFinish = finish !== undefined ? finish : currentData.finish;

            if (!timeRegex.test(checkStart) || !timeRegex.test(checkFinish)) {
              await db.query('ROLLBACK');
              return res.status(400).json({
                status: 400,
                success: false,
                message: 'Format waktu harus HH:MM (24 jam)'
              });
            }

            // Validasi waktu finish harus setelah start
            const startTime = new Date(`1970-01-01T${checkStart}:00`);
            const finishTime = new Date(`1970-01-01T${checkFinish}:00`);
            if (finishTime <= startTime) {
              await db.query('ROLLBACK');
              return res.status(400).json({
                status: 400,
                success: false,
                message: 'Waktu selesai harus setelah waktu mulai'
              });
            }
          }

          // Validasi bentrok dengan jadwal guru yang sama di hari dan jam yang sama
          const checkHari = hari !== undefined ? hari : currentData.hari;
          const checkStart = start !== undefined ? start : currentData.start;
          const checkFinish = finish !== undefined ? finish : currentData.finish;
          const checkNipGuru = nip_guru !== undefined ? nip_guru : currentData.guru_nip; // Use existing guru_nip if not provided

          // Only perform conflict check if relevant fields are being updated or if this schedule is being considered
          if (hari !== undefined || start !== undefined || finish !== undefined || nip_guru !== undefined) {
            const [guruBentrok] = await db.query(`
              SELECT j.jadwal_id, m.nama_mapel, k.nama_kelas, mj.start, mj.finish
              FROM jadwal j
              JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
              JOIN mapel m ON j.mapel_id = m.mapel_id
              JOIN kelas k ON j.kelas_id = k.kelas_id
              JOIN krs_detail kd ON (j.kelas_id = (
                  SELECT kelas_id FROM krs WHERE krs_id = kd.krs_id LIMIT 1
                ) AND j.mapel_id = kd.mapel_id)
              WHERE kd.guru_nip = ?
              AND j.hari = ?
              AND j.jadwal_id != ? -- Exclude the current jadwal being updated
              AND (
                (mj.start < ? AND mj.finish > ?) OR
                (mj.start < ? AND mj.finish > ?) OR
                (mj.start >= ? AND mj.finish <= ?)
                OR (mj.start <= ? AND mj.finish >= ?)
              )
            `, [
              checkNipGuru,
              checkHari,
              jadwal_id,
              checkStart, checkStart,
              checkFinish, checkFinish,
              checkStart, checkFinish,
              checkStart, checkFinish
            ]);

            if (guruBentrok.length > 0) {
              await db.query('ROLLBACK');
              return res.status(409).json({
                status: 409,
                success: false,
                message: `Guru sudah mengajar ${guruBentrok[0].nama_mapel} di kelas ${guruBentrok[0].nama_kelas} pada hari ${checkHari} jam ${guruBentrok[0].start}-${guruBentrok[0].finish}`,
                conflicting_schedule: guruBentrok[0]
              });
            }
          }

          // Validasi bentrok dengan ruangan yang sama di hari dan jam yang sama
          const checkRuangan = ruangan !== undefined ? ruangan : currentData.ruangan;
          const checkKelasId = kelas_id !== undefined ? kelas_id : currentData.kelas_id;

          if (ruangan !== undefined || hari !== undefined || start !== undefined || finish !== undefined) {
            const [ruanganBentrok] = await db.query(`
              SELECT j.jadwal_id, m.nama_mapel, k.nama_kelas, mj.start, mj.finish
              FROM jadwal j
              JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
              JOIN mapel m ON j.mapel_id = m.mapel_id
              JOIN kelas k ON j.kelas_id = k.kelas_id
              WHERE j.ruangan = ?
              AND j.hari = ?
              AND j.jadwal_id != ? -- Exclude the current jadwal being updated
              AND (
                (mj.start < ? AND mj.finish > ?) OR
                (mj.start < ? AND mj.finish > ?) OR
                (mj.start >= ? AND mj.finish <= ?)
                OR (mj.start <= ? AND mj.finish >= ?)
              )
            `, [
              checkRuangan,
              checkHari,
              jadwal_id,
              checkStart, checkStart,
              checkFinish, checkFinish,
              checkStart, checkFinish,
              checkStart, checkFinish
            ]);

            if (ruanganBentrok.length > 0) {
              await db.query('ROLLBACK');
              return res.status(409).json({
                status: 409,
                success: false,
                message: `Ruangan ${checkRuangan} sudah digunakan untuk ${ruanganBentrok[0].nama_mapel} di kelas ${ruanganBentrok[0].nama_kelas} pada hari ${checkHari} jam ${ruanganBentrok[0].start}-${ruanganBentrok[0].finish}`,
                conflicting_schedule: ruanganBentrok[0]
              });
            }
          }

          // Validasi bentrok dengan kelas yang sama di hari dan jam yang sama
          if (kelas_id !== undefined || hari !== undefined || start !== undefined || finish !== undefined) {
            const [kelasBentrok] = await db.query(`
              SELECT j.jadwal_id, m.nama_mapel, k.nama_kelas, mj.start, mj.finish
              FROM jadwal j
              JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
              JOIN mapel m ON j.mapel_id = m.mapel_id
              JOIN kelas k ON j.kelas_id = k.kelas_id
              WHERE j.kelas_id = ?
              AND j.hari = ?
              AND j.jadwal_id != ? -- Exclude the current jadwal being updated
              AND (
                (mj.start < ? AND mj.finish > ?) OR
                (mj.start < ? AND mj.finish > ?) OR
                (mj.start >= ? AND mj.finish <= ?)
                OR (mj.start <= ? AND mj.finish >= ?)
              )
            `, [checkKelasId, hari,
                jadwal_id,
                start, start,
                finish, finish,
                start, finish,
                start, finish]);

            if (kelasBentrok.length > 0) {
              await db.query('ROLLBACK');
              return res.status(409).json({
                status: 409,
                success: false,
                message: `Kelas ${kelasBentrok[0].nama_kelas} sudah memiliki jadwal ${kelasBentrok[0].nama_mapel} pada hari ${hari} jam ${kelasBentrok[0].start}-${kelasBentrok[0].finish}`,
                conflicting_schedule: kelasBentrok[0]
              });
            }
          }
        }
      }

      // 6. Update data jadwal utama using Stored Procedure
      // admin_update_jadwal uses COALESCE, so passing null/undefined for unchanged fields is fine
      await db.query(
        'CALL admin_update_jadwal(?, ?, ?, ?, ?, ?)',
        [
          jadwal_id,
          currentData.master_jadwal_id, // master_jadwal_id is not directly updatable via this endpoint's body
          mapel_id || null, // Pass null if not provided, SP's COALESCE will use existing
          kelas_id || null,
          (jadwal_hari && jadwal_hari.length > 0 && jadwal_hari[0].hari !== undefined) ? jadwal_hari[0].hari : null,
          (jadwal_hari && jadwal_hari.length > 0 && jadwal_hari[0].ruangan !== undefined) ? jadwal_hari[0].ruangan : null
        ]
      );

      // 7. Update guru_nip, nama_mapel, kkm in krs_detail if there's a change in mapel_id or nip_guru
      // No SP for krs_detail update, keeping original query
      if (nip_guru || mapel_id) {
        await db.query(`
          UPDATE krs_detail
          SET guru_nip = ?, nama_mapel = ?, kkm = ?
          WHERE mapel_id = ?
          AND krs_id IN (SELECT krs_id FROM krs WHERE kelas_id = ?)
        `, [
          nip_guru || currentData.guru_nip,
          nama_mapel || currentData.nama_mapel,
          kkm || currentData.kkm, // Use new KKM if mapel_id changed, else current
          mapel_id || currentData.mapel_id,
          kelas_id || currentData.kelas_id
        ]);
      }


      // 8. Update data master_jadwal if provided in jadwal_hari (no SP provided for this specific update)
      if (jadwal_hari && Array.isArray(jadwal_hari)) {
        for (const hariJadwal of jadwal_hari) {
          const { hari, jam_ke, start, finish, ruangan, master_jadwal_id } = hariJadwal;

          // Update master_jadwal (only fields that changed)
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
          // The admin_update_jadwal SP handles hari and ruangan, no need for separate update here
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
    // Note: No specific SP for getJadwalByJadwalId was provided, keeping direct query
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


// DELETE - Hapus Jadwal (using admin_delete_jadwal and admin_delete_master_jadwal SPs)
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

      // 2. Cek apakah masih ada jadwal lain dengan mapel_id yang sama
      const [jadwalLain] = await db.query(`
        SELECT jadwal_id
        FROM jadwal
        WHERE mapel_id = ?
        AND jadwal_id != ?
      `, [mapel_id, jadwal_id]);

      // 3. Hapus dari tabel jadwal using Stored Procedure
      await db.query('CALL admin_delete_jadwal(?)', [jadwal_id]);

      // 4. Hapus dari tabel master_jadwal yang terkait using Stored Procedure
      // Hanya jika master_jadwal tidak digunakan oleh jadwal lain
      const [remainingJadwal] = await db.query(
        'SELECT * FROM jadwal WHERE master_jadwal_id = ?',
        [master_jadwal_id]
      );

      if (!remainingJadwal || remainingJadwal.length === 0) {
        await db.query('CALL admin_delete_master_jadwal(?)', [master_jadwal_id]);
      }

      // 5. Hapus dari krs_detail JIKA tidak ada jadwal lain dengan mapel_id yang sama (no SP)
      if (!jadwalLain || jadwalLain.length === 0) {
        await db.query(`
          DELETE FROM krs_detail
          WHERE mapel_id = ?
          AND krs_id IN (SELECT krs_id FROM krs WHERE kelas_id = ?)
        `, [mapel_id, kelas_id]);
      }

      // Commit transaksi jika semua berhasil
      await db.query('COMMIT');

      res.status(200).json({
        status: 200,
        success: true,
        message: jadwalLain && jadwalLain.length > 0
          ? 'Jadwal berhasil dihapus. Data krs_detail tetap ada karena masih ada jadwal lain dengan mapel yang sama.'
          : 'Jadwal berhasil dihapus beserta data terkait di krs_detail.'
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
    // Note: No specific SP for getKelasJadwal was provided, keeping direct query
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

// DELETE - Hapus Semua Jadwal Berdasarkan Kelas ID (using admin_delete_jadwal_by_kelas and admin_delete_master_jadwal SPs)
const hapusJadwalByKelasId = async (req, res) => {
  const { kelas_id } = req.params;

  if (!kelas_id) {
    return res.status(400).json({ message: 'kelas_id wajib diisi.' });
  }

  try {
    // 1. Ambil semua master_jadwal_id yang terkait dengan kelas_id
    const [jadwalRows] = await db.query(
      `SELECT master_jadwal_id FROM jadwal WHERE kelas_id = ?`,
      [kelas_id]
    );

    if (jadwalRows.length === 0) {
      return res.status(404).json({ message: 'Tidak ada jadwal yang ditemukan untuk kelas ini.' });
    }

    const masterJadwalIds = jadwalRows.map(j => j.master_jadwal_id);

    // 2. Gunakan transaksi untuk memastikan kedua operasi (delete) berhasil atau tidak sama sekali.
    await db.query('START TRANSACTION');

    try {
      // 3. Hapus semua entri dari tabel 'jadwal' yang cocok dengan kelas_id using Stored Procedure.
      await db.query(
        'CALL admin_delete_jadwal_by_kelas(?)',
        [kelas_id]
      );

      // 4. Hapus semua entri dari tabel 'master_jadwal' yang terkait using Stored Procedure (looping for each ID).
      for (const mjId of masterJadwalIds) {
        // Check if master_jadwal_id is still used by any other jadwal (not of this kelas_id)
        const [remainingJadwal] = await db.query(
            'SELECT jadwal_id FROM jadwal WHERE master_jadwal_id = ?',
            [mjId]
        );
        if (remainingJadwal.length === 0) { // Only delete if no other schedules use this master_jadwal_id
            await db.query('CALL admin_delete_master_jadwal(?)', [mjId]);
        }
      }

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

const getGuruTersediaByKelas = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    // Validasi input
    if (!kelas_id) {
      return res.status(400).json({
        success: false,
        message: 'Parameter kelas_id wajib diisi'
      });
    }

    // 1. Cek apakah kelas ada
    const [kelas] = await db.query('SELECT kelas_id FROM kelas WHERE kelas_id = ?', [kelas_id]);
    if (!kelas || kelas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan'
      });
    }

    // 2. Ambil semua guru yang sudah mengajar di kelas ini (dari krs_detail)
    const [guruSudahMengajar] = await db.query(`
      SELECT DISTINCT kd.guru_nip
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      WHERE k.kelas_id = ?
    `, [kelas_id]);

    // 3. Ambil semua guru yang TIDAK ada di daftar guru yang sudah mengajar
    let query = `
      SELECT
        g.nip,
        g.nama_guru
      FROM guru g
    `;

    // Jika ada guru yang sudah mengajar, filter mereka
    if (guruSudahMengajar.length > 0) {
      const nipGuruSudahMengajar = guruSudahMengajar.map(g => g.guru_nip);
      query += ` WHERE g.nip NOT IN (?)`;
      var queryParams = [nipGuruSudahMengajar];
    }

    // Eksekusi query
    const [guruTersedia] = await db.query(query, queryParams || []);

    res.status(200).json({
      success: true,
      data: guruTersedia,
      total: guruTersedia.length,
      message: guruTersedia.length > 0
        ? 'Berhasil mendapatkan daftar guru tersedia'
        : 'Semua guru sudah mengajar di kelas ini'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
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
  hapusJadwalByKelasId,
  getGuruTersediaByKelas
};
