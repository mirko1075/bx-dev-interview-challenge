    import React, { useState } from 'react';
    import { Button, Box, Typography, LinearProgress, Alert } from '@mui/material';
    import CloudUploadIcon from '@mui/icons-material/CloudUpload';
    import { uploadFileToBackend } from '@/services/files.service';

    export const UploadForm = () => {
      const [selectedFile, setSelectedFile] = useState<File | null>(null);
      const [isUploading, setIsUploading] = useState(false);
      const [uploadProgress, setUploadProgress] = useState(0);
      const [error, setError] = useState('');
      const [success, setSuccess] = useState('');

      const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
          setSelectedFile(event.target.files[0]);
          setError('');
          setSuccess('');
        }
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

          const response = await uploadFileToBackend(formData, (progress) => {
            setUploadProgress(progress);
          });

          setSuccess(`File "${selectedFile.name}" uploaded successfully!`);
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
          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            disabled={isUploading}
          >
            Select File
            <input type="file" hidden onChange={handleFileChange} />
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
    
