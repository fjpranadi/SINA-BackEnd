const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateRaporPdf = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      });

      // Buat nama file unik
      const filename = `rapor_${data.siswa.nis}_${data.kelas.tahun_akademik_id}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../../express-siswa/public/reports', filename);
      
      // Setup stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ===== HEADER DOKUMEN =====
      doc.fontSize(16).text('LAPORAN HASIL BELAJAR', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10)
         .text('SEKOLAH MENENGAH ATAS NEGERI 1 CONTOH', { align: 'center' })
         .text('Jl. Pendidikan No. 123, Kota Contoh - Telp (021) 123456', { align: 'center' });
      doc.moveDown(1);

      // Garis pembatas
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .lineWidth(1)
         .stroke();
      doc.moveDown(2);

      // ===== BIODATA SISWA =====
      doc.fontSize(12).text('BIODATA SISWA', { underline: true });
      doc.moveDown(0.5);

      const bioStartY = doc.y;
      doc.fontSize(10);

      // Kolom kiri
      doc.text(`NIS: ${data.siswa.nis}`, 50, bioStartY);
      doc.text(`Nama: ${data.siswa.nama_siswa}`, 50, bioStartY + 20);
      doc.text(`Tempat/Tgl Lahir: ${data.siswa.tempat_lahir}, ${new Date(data.siswa.tanggal_lahir).toLocaleDateString('id-ID')}`, 50, bioStartY + 40);

      // Kolom kanan
      doc.text(`Kelas: ${data.kelas.nama_kelas}`, 300, bioStartY);
      doc.text(`Tahun Ajaran: ${new Date(data.kelas.tahun_mulai).getFullYear()}/${new Date(data.kelas.tahun_berakhir).getFullYear()}`, 300, bioStartY + 20);
      doc.text(`Wali Kelas: ${data.kelas.wali_kelas}`, 300, bioStartY + 40);
      
      doc.moveDown(4);

      // ===== TABEL NILAI =====
      doc.fontSize(12).text('NILAI PELAJARAN', { underline: true });
      doc.moveDown(0.5);

      // Header tabel
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [30, 180, 70, 70, 70]; // [No, Mapel, Pengetahuan, Keterampilan, Rata-rata]
      const rowHeight = 20;

      // Fungsi untuk menggambar sel tabel
      const drawCell = (text, x, y, width, align = 'left') => {
        doc.text(text, x + 2, y + 5, { 
          width: width - 4,
          align: align,
          lineBreak: false
        });
      };

      // Header columns
      doc.font('Helvetica-Bold');
      drawCell('No', tableLeft, tableTop, colWidths[0], 'center');
      drawCell('Mata Pelajaran', tableLeft + colWidths[0], tableTop, colWidths[1]);
      drawCell('Pengetahuan', tableLeft + colWidths[0] + colWidths[1], tableTop, colWidths[2], 'center');
      drawCell('Keterampilan', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop, colWidths[3], 'center');
      drawCell('Rata-rata', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop, colWidths[4], 'center');

      // Garis header
      doc.moveTo(tableLeft, tableTop + rowHeight)
         .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + rowHeight)
         .lineWidth(0.5)
         .stroke();

      // Isi Tabel
      doc.font('Helvetica');
      let y = tableTop + rowHeight;

      data.nilai.forEach((nilai, index) => {
        // Alternating row color
        if (index % 2 === 0) {
          doc.fillColor('#f5f5f5')
             .rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
             .fill();
          doc.fillColor('#000000');
        }

        // Isi sel
        drawCell(`${index + 1}.`, tableLeft, y, colWidths[0], 'center');
        drawCell(nilai.nama_mapel, tableLeft + colWidths[0], y, colWidths[1]);
        drawCell(nilai.pengetahuan?.toString() || '-', tableLeft + colWidths[0] + colWidths[1], y, colWidths[2], 'center');
        drawCell(nilai.keterampilan?.toString() || '-', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], 'center');
        
        // Hitung rata-rata jika kedua nilai ada
        const rataNilai = (nilai.pengetahuan && nilai.keterampilan) 
          ? ((nilai.pengetahuan + nilai.keterampilan) / 2).toFixed(2)
          : '-';
        
        drawCell(rataNilai, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, colWidths[4], 'center');

        y += rowHeight;

        // Halaman baru jika mencapai batas bawah
        if (y > 700 && index < data.nilai.length - 1) {
          doc.addPage();
          y = 50;
          
          // Tambahkan header lagi di halaman baru
          doc.font('Helvetica-Bold');
          drawCell('No', tableLeft, y, colWidths[0], 'center');
          drawCell('Mata Pelajaran', tableLeft + colWidths[0], y, colWidths[1]);
          drawCell('Pengetahuan', tableLeft + colWidths[0] + colWidths[1], y, colWidths[2], 'center');
          drawCell('Keterampilan', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], 'center');
          drawCell('Rata-rata', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, colWidths[4], 'center');

          y += rowHeight;
          doc.font('Helvetica');
        }
      });

      // ===== CATATAN DAN TTD =====
      doc.moveDown(3);
      doc.fontSize(10)
         .text('Catatan:', { underline: true });
      doc.text('Rapor ini dicetak secara elektronik dan sah tanpa tanda tangan basah');
      doc.moveDown(1);
      doc.text(`Tanggal cetak: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })}`);

      // Kolom tanda tangan
      const ttdY = doc.y + 50;
      doc.text('Mengetahui,', 100, ttdY);
      doc.text('Orang Tua/Wali', 100, ttdY + 40);
      doc.text('_________________________', 100, ttdY + 60);
      
      doc.text('Wali Kelas', 400, ttdY);
      doc.text(data.kelas.wali_kelas, 400, ttdY + 40);
      doc.text('_________________________', 400, ttdY + 60);

      // Footer
      doc.fontSize(8)
         .text('Generated by SekolahKu App - www.sekolahku.example.com', { 
           align: 'center',
           width: 500,
           y: 800
         });

      // Finalize
      doc.end();

      stream.on('finish', () => {
        resolve({
          filename,
          filePath: `/reports/${filename}`
        });
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateRaporPdf
};