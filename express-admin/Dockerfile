# Gunakan Node.js base image
FROM node:18

# Buat working directory
WORKDIR /app

# Copy dan install dependencies
COPY package*.json ./
RUN npm install

# Salin semua file project ke container
COPY . .

# Set environment variable untuk PORT (optional)
ENV PORT=3000

# Expose port dalam container
EXPOSE 3000

# Jalankan aplikasinya
CMD ["node", "server.js"]
