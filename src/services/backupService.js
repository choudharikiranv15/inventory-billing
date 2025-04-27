import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const readFilePromise = promisify(fs.readFile);
const unlinkPromise = promisify(fs.unlink);

// Initialize S3 client with credentials from environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export const BackupService = {
  /**
   * Generate database backup
   * @returns {Promise<string>} Path to the generated backup file
   */
  async generateBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(process.cwd(), 'backups');
      const backupFileName = `backup-${timestamp}.sql`;
      const backupPath = path.join(backupDir, backupFileName);
      
      // Create backup directory if it doesn't exist
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Generate database backup using pg_dump
      const { DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT } = process.env;
      const cmd = `PGPASSWORD=${DB_PASSWORD} pg_dump -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -d ${DB_NAME} -f ${backupPath}`;
      
      await execPromise(cmd);
      console.log(`Backup created at ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      console.error('Backup generation error:', error);
      throw new Error(`Failed to generate backup: ${error.message}`);
    }
  },
  
  /**
   * Encrypt backup file
   * @param {string} filePath - Path to the file to encrypt
   * @returns {Promise<string>} Path to the encrypted file
   */
  async encryptBackup(filePath) {
    try {
      const encryptedFilePath = `${filePath}.enc`;
      const data = await readFilePromise(filePath);
      
      // Encryption key should be stored securely
      const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Store IV at the beginning of the file
      await writeFilePromise(encryptedFilePath, Buffer.concat([iv, encrypted]));
      
      return encryptedFilePath;
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error(`Failed to encrypt backup: ${error.message}`);
    }
  },
  
  /**
   * Upload backup to cloud storage
   * @param {string} filePath - Path to the file to upload
   * @returns {Promise<Object>} Upload result
   */
  async uploadToS3(filePath) {
    try {
      const fileName = path.basename(filePath);
      const fileContent = await readFilePromise(filePath);
      
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `backups/${fileName}`,
        Body: fileContent
      };
      
      const command = new PutObjectCommand(params);
      const result = await s3Client.send(command);
      
      console.log(`Backup uploaded to S3: ${fileName}`);
      return {
        success: true,
        fileName,
        location: `s3://${process.env.S3_BUCKET_NAME}/backups/${fileName}`,
        ...result
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload backup: ${error.message}`);
    }
  },
  
  /**
   * Perform full backup process
   * @returns {Promise<Object>} Backup result
   */
  async performBackup() {
    try {
      // 1. Generate database backup
      const backupPath = await this.generateBackup();
      
      // 2. Encrypt the backup
      const encryptedPath = await this.encryptBackup(backupPath);
      
      // 3. Upload to cloud storage
      const uploadResult = await this.uploadToS3(encryptedPath);
      
      // 4. Clean up local files
      await unlinkPromise(backupPath);
      await unlinkPromise(encryptedPath);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        fileName: path.basename(encryptedPath),
        ...uploadResult
      };
    } catch (error) {
      console.error('Backup process error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },
  
  /**
   * Schedule regular backups
   * @param {number} intervalHours - Backup interval in hours
   */
  scheduleBackups(intervalHours = 24) {
    // Initial backup
    this.performBackup();
    
    // Schedule regular backups
    setInterval(() => {
      this.performBackup();
    }, intervalHours * 60 * 60 * 1000);
    
    console.log(`Automated backups scheduled every ${intervalHours} hours`);
  }
};

export default BackupService; 