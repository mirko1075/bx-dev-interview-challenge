import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Box, 
  Typography, 
  LinearProgress, 
  Alert, 
  Chip,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoIcon from '@mui/icons-material/Info';
import { 
  getValidationConfig, 
  FileValidationConfig,
  getPresignedUploadUrl,
  uploadFileWithPresignedUrl
} from '@/services/files.service';

interface PresignedUploadComponentProps {
  onUploadSuccess?: () => void;
}

export const PresignedUploadComponent: React.FC<PresignedUploadComponentProps> = ({ 
  onUploadSuccess 
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationConfig, setValidationConfig] = useState<FileValidationConfig | null>(null);

  useEffect(() => {
    const loadValidationConfig = async () => {
      try {
        const config = await getValidationConfig();
        setValidationConfig(config);
      } catch (err) {
        console.error('Failed to load validation config:', err);
      }
    };
    loadValidationConfig();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Client-side validation
      if (validationConfig && !validateFile(file, validationConfig)) {
        return; // Error is set in validateFile
      }
      
      setSelectedFile(file);
      setError('');
      setSuccess('');
    }
  };

  const validateFile = (file: File, config: FileValidationConfig): boolean => {
    // Check file size
    if (file.size > config.maxSizeBytes) {
      setError(`File size exceeds maximum allowed size of ${formatBytes(config.maxSizeBytes)}`);
      return false;
    }

    // Check file type
    if (!config.allowedMimeTypes.includes(file.type)) {
      setError(`File type '${file.type}' is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`);
      return false;
    }

    // Check filename length
    if (file.name.length > config.maxFilenameLength) {
      setError(`Filename exceeds maximum length of ${config.maxFilenameLength} characters`);
      return false;
    }

    // Check file extension
    const extension = getFileExtension(file.name).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
      setError(`File extension '${extension}' is not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}`);
      return false;
    }

    return true;
  };

  const getFileExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      // Step 1: Get presigned upload URL
      setUploadProgress(10);
      const presignedData = await getPresignedUploadUrl({
        fileName: selectedFile.name,
        fileType: selectedFile.type
      });

      // Step 2: Upload file directly to S3 using presigned URL
      setUploadProgress(20);
      await uploadFileWithPresignedUrl(
        presignedData.uploadUrl,
        selectedFile,
        (progress: number) => {
          // Map progress from 20% to 90%
          setUploadProgress(20 + (progress * 0.7));
        }
      );

      // Step 3: Optionally save metadata to backend (if needed)
      setUploadProgress(100);

      setSuccess(`File "${selectedFile.name}" uploaded successfully using presigned URL!`);
      
      // Trigger refresh of file list
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error('Presigned upload failed:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  return (
    <Card sx={{ mt: 4 }}>
      <CardHeader 
        title="Presigned URL Upload" 
        subheader="Upload files directly to S3 using presigned URLs"
        avatar={<CloudUploadIcon color="primary" />}
      />
      <CardContent>
        {validationConfig && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" color="primary" />
              File Requirements
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Maximum size: {formatBytes(validationConfig.maxSizeBytes)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Allowed types: {validationConfig.allowedExtensions.join(', ')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {validationConfig.allowedExtensions.map((ext) => (
                <Chip key={ext} label={ext} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            disabled={isUploading}
          >
            Select File
            <input 
              type="file" 
              accept={validationConfig?.allowedExtensions.join(',') || ''} 
              hidden 
              onChange={handleFileChange} 
            />
          </Button>

          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload with Presigned URL'}
          </Button>
        </Box>

        {selectedFile && (
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
          </Typography>
        )}

        {isUploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {uploadProgress < 20 ? 'Getting presigned URL...' :
               uploadProgress < 90 ? 'Uploading to S3...' :
               'Finalizing upload...'}
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      </CardContent>
    </Card>
  );
};
