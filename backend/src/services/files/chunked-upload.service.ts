import { User } from '@/entities/user.entity';
import { CacheService } from '@/services/files/cache.service';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';

interface UploadSession {
  chunks: Map<number, Buffer>;
  totalChunks: number;
  filename: string;
  fileSize: number;
  userId: string;
  createdAt: number;
}

@Injectable()
export class ChunkedUploadService {
  private readonly logger = new Logger(ChunkedUploadService.name);
  private readonly uploadSessions = new Map<string, UploadSession>();
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly cacheService: CacheService) {
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  initializeUpload(
    filename: string,
    fileSize: number,
    chunkSize: number,
    user: User,
  ): { uploadId: string; totalChunks: number } {
    const uploadId = this.generateUploadId();
    const totalChunks = Math.ceil(fileSize / chunkSize);

    const session: UploadSession = {
      chunks: new Map(),
      totalChunks,
      filename,
      fileSize,
      userId: user.id,
      createdAt: Date.now(),
    };

    this.uploadSessions.set(uploadId, session);

    this.logger.log(
      `Initialized chunked upload: ${uploadId} for file ${filename} (${totalChunks} chunks)`,
    );

    return { uploadId, totalChunks };
  }

  uploadChunk(
    uploadId: string,
    chunkNumber: number,
    chunkData: Buffer,
    user: User,
  ): { isComplete: boolean; progress: number } {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new BadRequestException('Upload session not found or expired');
    }

    if (session.userId !== user.id) {
      throw new BadRequestException('Unauthorized access to upload session');
    }

    if (chunkNumber < 0 || chunkNumber >= session.totalChunks) {
      throw new BadRequestException('Invalid chunk number');
    }

    session.chunks.set(chunkNumber, chunkData);

    const progress = (session.chunks.size / session.totalChunks) * 100;
    const isComplete = session.chunks.size === session.totalChunks;

    this.logger.log(
      `Chunk ${chunkNumber + 1}/${session.totalChunks} uploaded for ${uploadId} (${progress.toFixed(1)}%)`,
    );

    return { isComplete, progress };
  }

  assembleFile(uploadId: string, user: User): Buffer {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new BadRequestException('Upload session not found');
    }

    if (session.userId !== user.id) {
      throw new BadRequestException('Unauthorized access to upload session');
    }

    if (session.chunks.size !== session.totalChunks) {
      throw new BadRequestException('Upload incomplete - missing chunks');
    }

    // Assemble chunks in correct order
    const assembledChunks: Buffer[] = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunk = session.chunks.get(i);
      if (!chunk) {
        throw new BadRequestException(`Missing chunk ${i}`);
      }
      assembledChunks.push(chunk);
    }

    const assembledFile = Buffer.concat(assembledChunks);

    // Verify file size
    if (assembledFile.length !== session.fileSize) {
      throw new BadRequestException(
        `File size mismatch: expected ${session.fileSize}, got ${assembledFile.length}`,
      );
    }

    // Clean up session
    this.uploadSessions.delete(uploadId);

    this.logger.log(
      `File assembled successfully: ${session.filename} (${assembledFile.length} bytes)`,
    );

    return assembledFile;
  }

  getUploadProgress(
    uploadId: string,
    user: User,
  ): {
    progress: number;
    chunksUploaded: number;
    totalChunks: number;
  } {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new BadRequestException('Upload session not found');
    }

    if (session.userId !== user.id) {
      throw new BadRequestException('Unauthorized access to upload session');
    }

    const chunksUploaded = session.chunks.size;
    const progress = (chunksUploaded / session.totalChunks) * 100;

    return {
      progress,
      chunksUploaded,
      totalChunks: session.totalChunks,
    };
  }

  cancelUpload(uploadId: string, user: User): void {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new BadRequestException('Upload session not found');
    }

    if (session.userId !== user.id) {
      throw new BadRequestException('Unauthorized access to upload session');
    }

    this.uploadSessions.delete(uploadId);
    this.logger.log(`Upload cancelled: ${uploadId}`);
  }

  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [uploadId, session] of this.uploadSessions.entries()) {
      if (now - session.createdAt > this.sessionTimeout) {
        this.uploadSessions.delete(uploadId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired upload sessions`);
    }
  }

  getStats(): {
    activeSessions: number;
    totalMemoryUsage: string;
  } {
    const activeSessions = this.uploadSessions.size;
    let totalBytes = 0;

    for (const session of this.uploadSessions.values()) {
      for (const chunk of session.chunks.values()) {
        totalBytes += chunk.length;
      }
    }

    const totalMemoryUsage = `${(totalBytes / 1024 / 1024).toFixed(2)} MB`;

    return { activeSessions, totalMemoryUsage };
  }
}
