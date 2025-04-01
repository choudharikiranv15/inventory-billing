// src/views/ProductView.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Typography } from '@mui/material';
import BarcodeManager from '../components/BarcodeManager';

const ProductView = () => {
  const { productId } = useParams();
  // In a real app, you'd fetch the product data here
  const product = {
    id: productId,
    barcode: '' // You would get this from your API
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Product Details
      </Typography>
      
      <BarcodeManager 
        productId={product.id} 
        initialBarcode={product.barcode} 
      />
    </Container>
  );
};

export default ProductView;