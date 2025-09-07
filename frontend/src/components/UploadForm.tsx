    import React, { useState, useEffect } from 'react';
    import { Button, Box, Typography, LinearProgress, Alert, Chip } from '@mui/material';
    import CloudUploadIcon from '@mui/icons-material/CloudUpload';
    import InfoIcon from '@mui/icons-material/Info';
    import { uploadFileToBackend, getValidationConfig, FileValidationConfig } from '@/services/files.service';

    interface UploadFormProps {
      onUploadSuccess?: () => void;
    }

    export const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess }) => {
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
        setUploadProgress(0); // Reset progress

        try {
          // Nuovo approccio: upload diretto al backend
          const formData = new FormData();
          formData.append('file', selectedFile);

          await uploadFileToBackend(formData, (progress) => {
            setUploadProgress(progress);
          });

          setSuccess(`File "${selectedFile.name}" uploaded successfully!`);
          
          // Trigger refresh of file list
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } catch (err) {
          setError('Upload failed. Please try again.');
          console.error(err);
        } finally {
          setIsUploading(false);
          setSelectedFile(null);
        }
      };

        return (
          <Box sx={{ mt: 4, p: 2, border: '1px dashed grey', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Upload a File
            </Typography>
            
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
            
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              disabled={isUploading}
            >
              Select File
              <input type="file" accept={validationConfig?.allowedExtensions.join(',') || ''} hidden onChange={handleFileChange} />
            </Button>
            {selectedFile && (
              <Typography sx={{ mt: 2 }}>
                Selected: {selectedFile.name}
              </Typography>
            )}

          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            sx={{ mt: 2, ml: 2 }}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>

          {isUploading && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
        </Box>
      );
    };
    
