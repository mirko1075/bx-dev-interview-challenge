import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  IconButton,
  Chip,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { getFiles, getPresignedDownloadUrl } from '@/services/files.service';
import { IFile } from '@/types';

interface FileListProps {
  onRefresh?: () => void;
  refreshTrigger?: number;
}

const FileList: React.FC<FileListProps> = ({ refreshTrigger }) => {
  const [files, setFiles] = useState<IFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadMethod, setDownloadMethod] = useState<'direct' | 'presigned'>('presigned');

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError('');
      const fileList = await getFiles();
      setFiles(fileList);
    } catch (err) {
      setError('Failed to load files. Please try again.');
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      setDownloadingIds(prev => new Set(prev).add(fileId));
      
      if (downloadMethod === 'presigned') {
        // Use presigned URL download
        console.log('🔗 Using presigned URL download for:', filename);
        
        const response = await getPresignedDownloadUrl(fileId);
        
        // Open the presigned URL in a new tab or download directly
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = response.filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
      } else {
        // Use direct backend download
        console.log('🚀 Using direct backend download for:', filename);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/files/${fileId}/download`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Download failed');
        }

        // Get filename from Content-Disposition header or use fallback
        const contentDisposition = response.headers.get('Content-Disposition');
        let downloadFilename = filename;
        if (contentDisposition) {
          const matches = contentDisposition.match(/filename="([^"]+)"/);
          if (matches) {
            downloadFilename = matches[1];
          }
        }

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to download ${filename}. Please try again.`;
      setError(errorMessage);
      console.error('Error downloading file:', err);
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMimeTypeColor = (mimetype: string): 'primary' | 'secondary' | 'success' | 'warning' => {
    if (mimetype.startsWith('image/')) return 'primary';
    if (mimetype.startsWith('video/')) return 'secondary';
    if (mimetype.includes('pdf')) return 'warning';
    return 'success';
  };

  useEffect(() => {
    loadFiles();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>Loading files...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Your Files
        </Typography>
        <IconButton onClick={loadFiles} color="primary">
          <RefreshIcon />
        </IconButton>
      </Box>

      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <FormLabel component="legend">Download Method</FormLabel>
        <RadioGroup
          row
          value={downloadMethod}
          onChange={(e) => setDownloadMethod(e.target.value as 'direct' | 'presigned')}
        >
          <FormControlLabel 
            value="presigned" 
            control={<Radio />} 
            label="Presigned URL (Direct from S3)" 
          />
          <FormControlLabel 
            value="direct" 
            control={<Radio />} 
            label="Direct Backend Download" 
          />
        </RadioGroup>
      </FormControl>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {files.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No files uploaded yet. Upload your first file above!
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {file.filename}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={file.mimetype}
                      color={getMimeTypeColor(file.mimetype)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatDate(file.createdAt)}</TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownload(file.id, file.filename)}
                      disabled={downloadingIds.has(file.id)}
                    >
                      {downloadingIds.has(file.id) ? 'Downloading...' : 'Download'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default FileList;
