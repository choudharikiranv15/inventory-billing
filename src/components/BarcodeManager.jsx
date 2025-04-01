// src/components/BarcodeManager.jsx
import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  CircularProgress,
  Paper,
  Grid,
  Snackbar,
  Alert,
  IconButton
} from '@mui/material';
import { 
  CameraAlt as CameraIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import axios from 'axios';
import BarcodeScanner from './BarcodeScanner';

const BarcodeManager = ({ productId, initialBarcode }) => {
  const [barcode, setBarcode] = useState(initialBarcode || '');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const fetchBarcodeImage = async () => {
    if (!barcode) return;
    try {
      const response = await axios.get(`/api/barcode/${productId}/image`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setImageUrl(url);
    } catch (err) {
      setError('Failed to load barcode image');
    }
  };

  // In your BarcodeManager.jsx
const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `/api/products/${productId}/barcode`,
        {}, // Empty body if not needed
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Generation failed');
      }
      
      setBarcode(response.data.barcode);
      fetchBarcodeImage();
      
    } catch (err) {
      setError(err.message);
      console.error('API Error:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (scannedBarcode) => {
    setBarcode(scannedBarcode);
    setSnackbar({
      open: true,
      message: 'Barcode scanned successfully',
      severity: 'success'
    });
  };

  const downloadBarcode = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `barcode_${productId}.png`;
    link.click();
  };

  React.useEffect(() => {
    if (barcode) {
      fetchBarcodeImage();
    }
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [barcode]);

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Barcode Management
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="Barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <IconButton onClick={() => setScanOpen(true)}>
                    <CameraIcon />
                  </IconButton>
                )
              }}
            />
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={loading}
              sx={{ minWidth: 120 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate'}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          {imageUrl ? (
            <Box sx={{ 
              border: '1px solid #ddd', 
              p: 2, 
              borderRadius: 1,
              textAlign: 'center'
            }}>
              <img
                src={imageUrl}
                alt="Product barcode"
                style={{ maxWidth: '100%', maxHeight: 150 }}
              />
              <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchBarcodeImage}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadBarcode}
                >
                  Download
                </Button>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No barcode available
            </Typography>
          )}
        </Grid>
      </Grid>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default BarcodeManager;