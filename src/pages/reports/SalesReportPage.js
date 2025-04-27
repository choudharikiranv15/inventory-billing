import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';

// Recharts components for data visualization
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { 
  Download as DownloadIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

const SalesReportPage = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);

  // COLORS for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Load report data
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // In a real application, this would be an API call
        // const response = await axios.get(`/api/reports/sales?type=${reportType}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
        
        // Simulate API call with mock data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate mock data based on report type
        let mockData;
        
        switch (reportType) {
          case 'daily':
            mockData = generateDailyReportData(dateRange.startDate, dateRange.endDate);
            break;
          case 'weekly':
            mockData = generateWeeklyReportData(dateRange.startDate, dateRange.endDate);
            break;
          case 'monthly':
            mockData = generateMonthlyReportData(dateRange.startDate, dateRange.endDate);
            break;
          case 'category':
            mockData = generateCategoryReportData();
            break;
          case 'payment':
            mockData = generatePaymentMethodReportData();
            break;
          default:
            mockData = generateDailyReportData(dateRange.startDate, dateRange.endDate);
        }
        
        setReportData(mockData);
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('Failed to load report data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [reportType, dateRange]);
  
  // Generate daily report mock data
  const generateDailyReportData = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    
    let tempDate = new Date(start);
    while (tempDate <= end) {
      days.push(new Date(tempDate).toISOString().split('T')[0]);
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    const salesData = days.map(day => {
      const baseSales = Math.floor(Math.random() * 50000) + 10000;
      return {
        date: day,
        sales: baseSales,
        profit: Math.floor(baseSales * 0.3)
      };
    });
    
    // Calculate totals
    const totalSales = salesData.reduce((sum, data) => sum + data.sales, 0);
    const totalProfit = salesData.reduce((sum, data) => sum + data.profit, 0);
    const averageSales = salesData.length > 0 ? totalSales / salesData.length : 0;
    
    return {
      chartData: salesData,
      summaryData: {
        totalSales,
        totalProfit,
        averageSales,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        period: `${startDate} to ${endDate}`,
        reportType: 'Daily Sales Report'
      }
    };
  };
  
  // Generate weekly report mock data
  const generateWeeklyReportData = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const weeks = [];
    
    let tempDate = new Date(start);
    let weekCounter = 1;
    
    while (tempDate <= end) {
      const weekEnd = new Date(tempDate);
      weekEnd.setDate(tempDate.getDate() + 6);
      
      weeks.push({
        week: `Week ${weekCounter}`,
        start: new Date(tempDate).toISOString().split('T')[0],
        end: weekEnd > end ? endDate : weekEnd.toISOString().split('T')[0]
      });
      
      tempDate.setDate(tempDate.getDate() + 7);
      weekCounter++;
    }
    
    const salesData = weeks.map(week => {
      const baseSales = Math.floor(Math.random() * 200000) + 50000;
      return {
        week: week.week,
        period: `${week.start} to ${week.end}`,
        sales: baseSales,
        profit: Math.floor(baseSales * 0.3)
      };
    });
    
    // Calculate totals
    const totalSales = salesData.reduce((sum, data) => sum + data.sales, 0);
    const totalProfit = salesData.reduce((sum, data) => sum + data.profit, 0);
    const averageSales = salesData.length > 0 ? totalSales / salesData.length : 0;
    
    return {
      chartData: salesData,
      summaryData: {
        totalSales,
        totalProfit,
        averageSales,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        period: `${startDate} to ${endDate}`,
        reportType: 'Weekly Sales Report'
      }
    };
  };
  
  // Generate monthly report mock data
  const generateMonthlyReportData = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = [];
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let tempDate = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (tempDate <= end) {
      const monthEnd = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0);
      
      months.push({
        month: monthNames[tempDate.getMonth()],
        year: tempDate.getFullYear(),
        start: new Date(tempDate).toISOString().split('T')[0],
        end: monthEnd > end ? endDate : monthEnd.toISOString().split('T')[0]
      });
      
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
    
    const salesData = months.map(month => {
      const baseSales = Math.floor(Math.random() * 800000) + 200000;
      return {
        month: `${month.month} ${month.year}`,
        sales: baseSales,
        profit: Math.floor(baseSales * 0.3)
      };
    });
    
    // Calculate totals
    const totalSales = salesData.reduce((sum, data) => sum + data.sales, 0);
    const totalProfit = salesData.reduce((sum, data) => sum + data.profit, 0);
    const averageSales = salesData.length > 0 ? totalSales / salesData.length : 0;
    
    return {
      chartData: salesData,
      summaryData: {
        totalSales,
        totalProfit,
        averageSales,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        period: `${startDate} to ${endDate}`,
        reportType: 'Monthly Sales Report'
      }
    };
  };
  
  // Generate category report mock data
  const generateCategoryReportData = () => {
    const categories = [
      'Electronics',
      'Furniture',
      'Books',
      'Clothing',
      'Food Items',
      'Stationery'
    ];
    
    const salesData = categories.map(category => {
      const baseSales = Math.floor(Math.random() * 500000) + 50000;
      return {
        category,
        sales: baseSales,
        profit: Math.floor(baseSales * (0.25 + Math.random() * 0.1))
      };
    });
    
    // Calculate totals
    const totalSales = salesData.reduce((sum, data) => sum + data.sales, 0);
    const totalProfit = salesData.reduce((sum, data) => sum + data.profit, 0);
    
    // Calculate percentages for pie chart
    salesData.forEach(data => {
      data.percentage = totalSales > 0 ? (data.sales / totalSales) * 100 : 0;
    });
    
    return {
      chartData: salesData,
      summaryData: {
        totalSales,
        totalProfit,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        reportType: 'Sales by Category Report'
      }
    };
  };
  
  // Generate payment method report mock data
  const generatePaymentMethodReportData = () => {
    const paymentMethods = [
      'Cash',
      'Credit Card',
      'Debit Card',
      'UPI',
      'Net Banking'
    ];
    
    const salesData = paymentMethods.map(method => {
      const baseSales = Math.floor(Math.random() * 300000) + 100000;
      return {
        method,
        sales: baseSales
      };
    });
    
    // Calculate total
    const totalSales = salesData.reduce((sum, data) => sum + data.sales, 0);
    
    // Calculate percentages for pie chart
    salesData.forEach(data => {
      data.percentage = totalSales > 0 ? (data.sales / totalSales) * 100 : 0;
    });
    
    return {
      chartData: salesData,
      summaryData: {
        totalSales,
        reportType: 'Sales by Payment Method Report'
      }
    };
  };
  
  // Handle report type change
  const handleReportTypeChange = (event) => {
    setReportType(event.target.value);
  };
  
  // Handle date range change
  const handleDateRangeChange = (event) => {
    const { name, value } = event.target;
    setDateRange({
      ...dateRange,
      [name]: value
    });
  };
  
  // Handle refresh
  const handleRefresh = () => {
    setLoading(true);
    // Reloading happens automatically due to dependency array in useEffect
  };
  
  // Handle print
  const handlePrint = () => {
    window.print();
  };
  
  // Handle export
  const handleExport = () => {
    // In a real application, this would generate and download a CSV/Excel file
    alert('Export functionality would be implemented here');
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Render appropriate chart based on report type
  const renderChart = () => {
    if (!reportData || !reportData.chartData || reportData.chartData.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No data available for the selected time period</Typography>
        </Box>
      );
    }
    
    switch (reportType) {
      case 'daily':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={reportData.chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value) => formatCurrency(value)} 
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'weekly':
      case 'monthly':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={reportData.chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={reportType === 'weekly' ? 'week' : 'month'} 
                angle={-45} 
                textAnchor="end"
                height={70}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => formatCurrency(value)} 
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Legend />
              <Bar dataKey="sales" fill="#8884d8" name="Sales" />
              <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'category':
      case 'payment':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={reportData.chartData}
                    dataKey="sales"
                    nameKey={reportType === 'category' ? 'category' : 'method'}
                    cx="50%"
                    cy="50%"
                    outerRadius={150}
                    fill="#8884d8"
                    label={(entry) => {
                      const keyName = reportType === 'category' ? 'category' : 'method';
                      return `${entry[keyName]}: ${formatCurrency(entry.sales)}`;
                    }}
                    labelLine={true}
                  >
                    {reportData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)} 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                    wrapperStyle={{ outline: 'none' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{reportType === 'category' ? 'Category' : 'Payment Method'}</TableCell>
                      <TableCell align="right">Sales Amount</TableCell>
                      <TableCell align="right">Percentage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.chartData.map((row) => (
                      <TableRow key={reportType === 'category' ? row.category : row.method}>
                        <TableCell>{reportType === 'category' ? row.category : row.method}</TableCell>
                        <TableCell align="right">{formatCurrency(row.sales)}</TableCell>
                        <TableCell align="right">{row.percentage.toFixed(2)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        );
      default:
        return null;
    }
  };
  
  // Render summary based on report type
  const renderSummary = () => {
    if (!reportData || !reportData.summaryData) return null;
    
    const { summaryData } = reportData;
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Sales
              </Typography>
              <Typography variant="h4" color="primary">
                {formatCurrency(summaryData.totalSales)}
              </Typography>
              {summaryData.period && (
                <Typography variant="body2" color="text.secondary">
                  Period: {summaryData.period}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {(reportType !== 'payment') && (
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Total Profit
                </Typography>
                <Typography variant="h4" color="success.main">
                  {formatCurrency(summaryData.totalProfit)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Profit Margin: {summaryData.profitMargin.toFixed(2)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {(reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') && (
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Average {reportType === 'daily' ? 'Daily' : reportType === 'weekly' ? 'Weekly' : 'Monthly'} Sales
                </Typography>
                <Typography variant="h4" color="info.main">
                  {formatCurrency(summaryData.averageSales)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    );
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Sales Reports
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ mr: 1 }}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ mr: 1 }}
            disabled={loading || !reportData}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={loading || !reportData}
          >
            Export
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Report Settings
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="report-type-label">Report Type</InputLabel>
              <Select
                labelId="report-type-label"
                value={reportType}
                label="Report Type"
                onChange={handleReportTypeChange}
                disabled={loading}
              >
                <MenuItem value="daily">Daily Sales</MenuItem>
                <MenuItem value="weekly">Weekly Sales</MenuItem>
                <MenuItem value="monthly">Monthly Sales</MenuItem>
                <MenuItem value="category">Sales by Category</MenuItem>
                <MenuItem value="payment">Sales by Payment Method</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {(reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') && (
            <>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={handleDateRangeChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={handleDateRangeChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  disabled={loading}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : reportData ? (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {reportData.summaryData.reportType}
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {renderChart()}
          </Paper>
          
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {renderSummary()}
          </Paper>
        </>
      ) : (
        <Alert severity="info">No report data available. Please adjust your filters and try again.</Alert>
      )}
    </Box>
  );
};

export default SalesReportPage; 