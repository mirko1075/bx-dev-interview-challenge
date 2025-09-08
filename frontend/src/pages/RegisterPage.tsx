import React, { useState } from 'react';
import { Button, TextField, Container, Typography, Box, Alert, Grid, Link } from '@mui/material';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';

const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormInputs = z.infer<typeof registerSchema>;

interface RegisterPageProps {
  onToggle: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onToggle }) => {
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit: SubmitHandler<RegisterFormInputs> = async (data) => {
    setServerError('');
    setIsSuccess(false);
    try {
      await registerUser({ email: data.email, password: data.password });
      setIsSuccess(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        if (err.response && err.response.data && err.response.data.message) {
            setServerError(err.response.data.message);
        } else {
            setServerError('An unexpected error occurred. Please try again.');
        }
    }
  };

  if (isSuccess) {
    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5">Registration Successful!</Typography>
                <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
                    You can now log in with your credentials.
                </Alert>
                <Button onClick={onToggle} fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
                    Go to Login
                </Button>
            </Box>
        </Container>
    );
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Sign up
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            autoComplete="email"
            {...register("email")}
            error={!!errors.email}
            helperText={errors.email?.message}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Password"
            type="password"
            id="password"
            autoComplete="new-password"
            {...register("password")}
            error={!!errors.password}
            helperText={errors.password?.message}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            autoComplete="new-password"
            {...register("confirmPassword")}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
          />
          {serverError && <Alert severity="error" sx={{ mt: 2 }}>{serverError}</Alert>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign Up
          </Button>
           <Grid container justifyContent="flex-end">
              <Link component="button" variant="body2" onClick={onToggle}>
                Already have an account? Sign in
              </Link>
            </Grid>
        </Box>
      </Box>
    </Container>
  );
};

