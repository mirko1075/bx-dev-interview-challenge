import React from 'react';
import { Button, Container, Typography, Box, Divider, AppBar, Toolbar } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { UploadForm } from '@/components/UploadForm';

export const DashboardPage = () => {
  const { logout } = useAuth();

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            BonusX File Uploader
          </Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Typography component="h1" variant="h4" gutterBottom>
          File Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome! Use the form below to upload new files to your secure storage.
        </Typography>

        <Divider sx={{ my: 4 }} />

        <UploadForm />

      </Container>
    </Box>
  );
};

