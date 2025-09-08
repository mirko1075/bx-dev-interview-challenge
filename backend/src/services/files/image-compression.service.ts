import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

@Injectable()
export class ImageCompressionService {
  private readonly logger = new Logger(ImageCompressionService.name);

  async compressImage(
    buffer: Buffer,
    mimetype: string,
    options: CompressionOptions = {},
  ): Promise<{ buffer: Buffer; mimetype: string; sizeReduction: number }> {
    const originalSize = buffer.length;

    // Default compression options
    const {
      quality = 85,
      maxWidth = 1920,
      maxHeight = 1080,
      format = 'jpeg',
    } = options;

    try {
      let sharpInstance = sharp(buffer);

      // Get image metadata
      const metadata = await sharpInstance.metadata();
      this.logger.log(
        `Compressing image: ${metadata.width}x${metadata.height}, format: ${metadata.format}, size: ${originalSize} bytes`,
      );

      // Resize if necessary
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Apply compression based on format
      let compressedBuffer: Buffer;
      let outputMimetype: string;

      if (mimetype.includes('png') && format === 'png') {
        compressedBuffer = await sharpInstance
          .png({ quality, compressionLevel: 9 })
          .toBuffer();
        outputMimetype = 'image/png';
      } else if (mimetype.includes('webp') && format === 'webp') {
        compressedBuffer = await sharpInstance.webp({ quality }).toBuffer();
        outputMimetype = 'image/webp';
      } else {
        // Default to JPEG for best compression
        compressedBuffer = await sharpInstance
          .jpeg({ quality, progressive: true })
          .toBuffer();
        outputMimetype = 'image/jpeg';
      }

      const compressedSize = compressedBuffer.length;
      const sizeReduction =
        ((originalSize - compressedSize) / originalSize) * 100;

      this.logger.log(
        `Image compressed: ${originalSize} → ${compressedSize} bytes (${sizeReduction.toFixed(1)}% reduction)`,
      );

      return {
        buffer: compressedBuffer,
        mimetype: outputMimetype,
        sizeReduction,
      };
    } catch (error) {
      this.logger.error(
        `Image compression failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return original if compression fails
      return {
        buffer,
        mimetype,
        sizeReduction: 0,
      };
    }
  }

  shouldCompress(mimetype: string, size: number): boolean {
    const isImage = mimetype.startsWith('image/');
    const isSizeWorthCompressing = size > 100 * 1024; // 100KB threshold
    const isCompressibleFormat = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ].includes(mimetype);

    return isImage && isSizeWorthCompressing && isCompressibleFormat;
  }

  async createThumbnail(buffer: Buffer, size: number = 200): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      this.logger.error(
        `Thumbnail creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
