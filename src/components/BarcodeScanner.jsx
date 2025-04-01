// src/components/BarcodeScanner.jsx
import React, { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  CircularProgress,
  Typography,
  IconButton,
  Box
} from '@mui/material';
import { CameraAlt, Close } from '@mui/icons-material';

const BarcodeScanner = ({ open, onClose, onScan }) => {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codeReader, setCodeReader] = useState(null);

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserMultiFormatReader();
    setCodeReader(reader);

    const startScan = async () => {
      try {
        const devices = await reader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;
        
        await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
          if (result) {
            onScan(result.getText());
            onClose();
          }
          if (err && !(err.name === 'NotFoundException')) {
            setError(err.message);
          }
        });
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    startScan();

    return () => {
      if (reader) {
        reader.reset();
      }
    };
  }, [open, onClose, onScan]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          Scan Barcode
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box textAlign="center" p={4}>
            <CircularProgress />
            <Typography>Initializing scanner...</Typography>
          </Box>
        ) : error ? (
          <Box textAlign="center" p={2}>
            <Typography color="error">{error}</Typography>
            <Typography variant="body2">
              Make sure you've granted camera permissions
            </Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
            <video 
              ref={videoRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '4px'
              }}
              playsInline
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button 
          startIcon={<CameraAlt />}
          onClick={() => codeReader?.reset()}
          disabled={loading}
        >
          Reset Scanner
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BarcodeScanner;