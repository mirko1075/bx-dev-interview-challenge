import { api } from './api.service';

interface ChunkedUploadInit {
  filename: string;
  fileSize: number;
  chunkSize: number;
}

interface ChunkedUploadResponse {
  uploadId: string;
  totalChunks: number;
}

interface ChunkUploadResponse {
  isComplete: boolean;
  progress: number;
}

interface UploadProgress {
  progress: number;
  chunksUploaded: number;
  totalChunks: number;
}

export class ChunkedUploadService {
  private static readonly DEFAULT_CHUNK_SIZE = 1024 * 1024;
  private static readonly LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;

  static shouldUseChunkedUpload(fileSize: number): boolean {
    return fileSize > this.LARGE_FILE_THRESHOLD;
  }

  static async initializeUpload(
    filename: string,
    fileSize: number,
    chunkSize: number = this.DEFAULT_CHUNK_SIZE,
  ): Promise<ChunkedUploadResponse> {
    const payload: ChunkedUploadInit = {
      filename,
      fileSize,
      chunkSize,
    };

    return api.post<ChunkedUploadResponse>('/files/chunked/init', payload);
  }

  static async uploadChunk(
    uploadId: string,
    chunkNumber: number,
    chunkData: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<ChunkUploadResponse> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('chunk', chunkData);

      const xhr = new XMLHttpRequest();
      const token = localStorage.getItem('token');

      xhr.open('POST', `/api/files/chunked/${uploadId}/chunk/${chunkNumber}`);
      
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded * 100) / event.total);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during chunk upload'));
      };

      xhr.send(formData);
    });
  }

  static async completeUpload(
    uploadId: string,
    filename: string,
    mimetype: string,
  ): Promise<{ success: boolean; file: unknown; message: string }> {
    const payload = { filename, mimetype };
    return api.post(`/files/chunked/${uploadId}/complete`, payload);
  }

  static async getUploadProgress(uploadId: string): Promise<UploadProgress> {
    return api.get<UploadProgress>(`/files/chunked/${uploadId}/progress`);
  }

  static async cancelUpload(uploadId: string): Promise<void> {
    await api.post(`/files/chunked/${uploadId}/cancel`, {});
  }

  static async uploadFileChunked(
    file: File,
    onProgress?: (progress: number) => void,
    onChunkProgress?: (chunkIndex: number, chunkProgress: number) => void,
  ): Promise<{ success: boolean; file: unknown; message: string }> {
    console.log(`🚀 Starting chunked upload for: ${file.name} (${file.size} bytes)`);

    // Initialize upload
    const { uploadId, totalChunks } = await this.initializeUpload(
      file.name,
      file.size,
    );

    console.log(`📊 Upload initialized: ${uploadId}, ${totalChunks} chunks`);

    const chunkSize = this.DEFAULT_CHUNK_SIZE;
    let uploadedChunks = 0;

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunkBlob = file.slice(start, end);

        console.log(`📦 Uploading chunk ${chunkIndex + 1}/${totalChunks}`);

        await this.uploadChunk(
          uploadId,
          chunkIndex,
          chunkBlob,
          (chunkProgress) => {
            if (onChunkProgress) {
              onChunkProgress(chunkIndex, chunkProgress);
            }
          },
        );

        uploadedChunks++;
        const overallProgress = Math.round((uploadedChunks / totalChunks) * 100);
        
        console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${overallProgress}%)`);
        
        if (onProgress) {
          onProgress(overallProgress);
        }
      }

      console.log('🔄 Assembling chunks...');
      const result = await this.completeUpload(uploadId, file.name, file.type);
      
      console.log('✅ Chunked upload completed successfully');
      return result;

    } catch (error) {
      console.error('❌ Chunked upload failed:', error);
      
      try {
        await this.cancelUpload(uploadId);
      } catch (cancelError) {
        console.warn('Failed to cancel upload:', cancelError);
      }
      
      throw error;
    }
  }
}
