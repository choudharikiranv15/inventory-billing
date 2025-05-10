import ExcelJS from 'exceljs';

export const generateExcel = async (data, headers, sheetName = 'Sheet1') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add headers
  worksheet.addRow(headers);
  
  // Add data
  data.forEach(row => {
    worksheet.addRow(Object.values(row));
  });
  
  // Style headers
  worksheet.getRow(1).font = { bold: true };
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 15;
  });
  
  return workbook;
};

export const generateSalesReport = async (sales) => {
  const headers = ['Date', 'Invoice No', 'Customer', 'Total Amount', 'Payment Status'];
  const data = sales.map(sale => ({
    date: sale.date,
    invoiceNo: sale.invoiceNo,
    customer: sale.customerName,
    totalAmount: sale.totalAmount,
    paymentStatus: sale.paymentStatus
  }));
  
  return generateExcel(data, headers, 'Sales Report');
};

export const generateInventoryReport = async (products) => {
  const headers = ['Product Name', 'SKU', 'Current Stock', 'Unit Price', 'Total Value'];
  const data = products.map(product => ({
    name: product.name,
    sku: product.sku,
    stock: product.currentStock,
    price: product.unitPrice,
    value: product.currentStock * product.unitPrice
  }));
  
  return generateExcel(data, headers, 'Inventory Report');
}; 