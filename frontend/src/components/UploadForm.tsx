    import React, { useState } from 'react';
    import { Button, Box, Typography, LinearProgress, Alert } from '@mui/material';
    import CloudUploadIcon from '@mui/icons-material/CloudUpload';
    import { getPresignedUploadUrl, uploadFileToS3 } from '@/services/files.service';

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
          let { uploadUrl } = await getPresignedUploadUrl({
            filename: selectedFile.name,
            fileType: selectedFile.type,
          });

          // 2. Carica il file direttamente su S3 usando l'URL ottenuto
          // Nota: Axios non supporta nativamente il progresso dell'upload per le richieste PUT.
          // Per una barra di progresso reale, sarebbe necessario usare XMLHttpRequest o una libreria diversa.
          // Qui simuliamo il progresso.
          uploadUrl = uploadUrl.replace('storage.local', 'localhost');
          await uploadFileToS3(uploadUrl, selectedFile);
          setUploadProgress(100); // Simula il completamento

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
    
