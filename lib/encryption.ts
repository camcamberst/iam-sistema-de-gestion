// =====================================================
// 🔐 UTILIDAD DE ENCRIPTACIÓN/DESENCRIPTACIÓN
// =====================================================
// Encriptación AES-256-GCM para contraseñas de plataformas
// Permite cambiar fácilmente la política de encriptación
// =====================================================

import crypto from 'crypto';

// Clave de encriptación desde variable de entorno
// Usa ENCRYPTION_KEY (variable existente en el proyecto)
// Si no existe, usar una clave por defecto (solo para desarrollo - NO usar en producción)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  'default-encryption-key-change-in-production-32-chars!!';

// Asegurar que la clave tenga 32 bytes (256 bits) para AES-256
const getEncryptionKey = (): Buffer => {
  const key = ENCRYPTION_KEY.length >= 32 
    ? ENCRYPTION_KEY.substring(0, 32)
    : crypto.createHash('sha256').update(ENCRYPTION_KEY).digest().substring(0, 32);
  return Buffer.from(key, 'utf8');
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes para AES
const SALT_LENGTH = 64; // 64 bytes para el salt
const TAG_LENGTH = 16; // 16 bytes para el tag de autenticación

/**
 * 🔒 Encriptar texto usando AES-256-GCM
 * @param text - Texto a encriptar
 * @returns String encriptado en formato: salt:iv:tag:encryptedData (base64)
 */
export function encrypt(text: string): string {
  try {
    if (!text) {
      throw new Error('Texto vacío para encriptar');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derivar clave usando PBKDF2 con el salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();

    // Formato: salt:iv:tag:encryptedData (todos en base64)
    const result = [
      salt.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted
    ].join(':');

    return result;
  } catch (error) {
    console.error('❌ [ENCRYPTION] Error encriptando:', error);
    throw new Error('Error al encriptar datos');
  }
}

/**
 * 🔓 Desencriptar texto usando AES-256-GCM
 * @param encryptedText - Texto encriptado en formato: salt:iv:tag:encryptedData
 * @returns Texto desencriptado
 */
export function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText) {
      throw new Error('Texto encriptado vacío');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Formato de texto encriptado inválido');
    }

    const [saltBase64, ivBase64, tagBase64, encrypted] = parts;

    const key = getEncryptionKey();
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');

    // Derivar clave usando PBKDF2 con el salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ [ENCRYPTION] Error desencriptando:', error);
    throw new Error('Error al desencriptar datos');
  }
}

/**
 * 🔍 Verificar si un texto está encriptado
 * @param text - Texto a verificar
 * @returns true si parece estar encriptado
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 4 && parts.every(part => {
    try {
      Buffer.from(part, 'base64');
      return true;
    } catch {
      return false;
    }
  });
}

