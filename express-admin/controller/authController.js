const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project

// Helper buat cek kata-kata berbahaya
const containsSQLInjection = (input) => {
    const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
    const lowerInput = input.toLowerCase();
    return forbiddenWords.some(word => lowerInput.includes(word));
  };

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan Password wajib diisi!' });
    }

    if (containsSQLInjection(email) || containsSQLInjection(password)) {
        return res.status(400).json({ message: 'Input mengandung karakter berbahaya!' });
    }

    try {
        const [rows] = await db.query('CALL admin_login_user(?)', [email]);
        const user = rows[0][0];

        if (!user) {
            return res.status(400).json({ message: 'Email atau Password tidak sama!' });
        }

        // Check both plaintext and hashed password
        let passwordValid = false;
        
        // Case 1: Password matches plaintext (direct comparison)
        if (password === user.password) {
            passwordValid = true;
        } 
        // Case 2: Password is hashed (bcrypt comparison)
        else if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
            passwordValid = await bcrypt.compare(password, user.password);
        }

        if (!passwordValid) {
            return res.status(400).json({ message: 'Email atau Password tidak sama!' });
        }

        // Role validation - only admin and superadmin allowed
        if (user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Hanya admin dan superadmin yang boleh login.' });
        }

        const token = jwt.sign(
            { 
                userId: user.user_id, 
                email: user.email, 
                role: user.role, 
                username: user.username, 
                foto_profil: user.foto_profil 
            },
            JWT_SECRET,
            { expiresIn: '5h' }
        );

        res.status(200).json({
            message: 'Login berhasil!',
            token: token,
            data: {
                userId: user.user_id,
                email: user.email,
                username: user.username,
                role: user.role,
                foto_profil: user.foto_profil
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifySuperAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan!' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ message: 'Hanya superadmin yang diizinkan mengakses fitur ini.' });
        }
        req.user = decoded; // simpan info user jika dibutuhkan di controller
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token tidak valid!' });
    }
};

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // ambil tokennya

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ditemukan!' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // simpan data user di req.user
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token tidak valid!' });
    }
};

const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan!' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
            return res.status(403).json({ message: 'Hanya admin atau superadmin yang diizinkan.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token tidak valid!' });
    }
};

const editProfile = async (req, res) => {
  const userId = req.user.userId;
  const { username, email, password, oldpassword } = req.body; // <-- tambahkan oldPassword di sini
  const file = req.file;
  console.log(req.file); 


  try {
    const [existing] = await db.query('SELECT * FROM user WHERE user_id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const user = existing[0]; // <-- tambahkan ini untuk mendefinisikan user

    const updateFields = [];
    const updateValues = [];

    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }

    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (password) {
      if (!oldpassword) {
        return res.status(400).json({ message: 'Password lama wajib diisi untuk mengganti password!' });
      }

      if (oldpassword !== user.password) {
        return res.status(400).json({ message: 'Password lama tidak cocok!' });
      }

      updateFields.push('password = ?');
      updateValues.push(password);
    }

    updateValues.push(userId);

    if (updateFields.length > 0) {
      await db.query(`UPDATE user SET ${updateFields.join(', ')} WHERE user_id = ?`, updateValues);
    }

    if (file) {
  // Gunakan file.filename (nama file yang sudah diubah) bukan file.originalname
  await db.query('UPDATE admin SET foto_profil = ? WHERE user_id = ?', [file.filename, userId]);
}
    

    res.status(200).json({ message: 'Profil berhasil diperbarui!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};


const getProfile = async (req, res) => {
    const userId = req.user.userId;  // Ambil userId dari decoded token
    console.log('Request body:', req.body);  // Tambahkan log ini
    console.log('Request file:', req.file);  // Log file upload

    try {
        // Ambil data user dan foto profil admin dari tabel user dan admin
        const [rows] = await db.query(`
            SELECT 
                u.username, 
                u.email, 
                a.foto_profil AS foto_profil
            FROM user u
            JOIN admin a ON u.user_id = a.user_id
            WHERE u.user_id = ?`, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Pengguna tidak ditemukan!' });
        }

        const user = rows[0];

        // Kembalikan data profil
        res.status(200).json({
            message: 'Data profil berhasil diambil!',
            data: {
                username: user.username,
                email: user.email, 
                foto_profil: user.foto_profil
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

module.exports = { login, verifyToken, editProfile, getProfile, verifySuperAdmin, verifyAdmin };
