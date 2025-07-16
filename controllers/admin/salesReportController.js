const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Load Sales Report Dashboard
const loadSalesReport = async (req, res) => {
  try {
    // Get filter parameters
    const { 
      reportType = 'daily', 
      startDate, 
      endDate,
      customStartDate,
      customEndDate 
    } = req.query;

    // Use the centralized date filter function for consistency
    let dateFilter = getDateFilter(reportType, customStartDate, customEndDate);
    let reportTitle = getReportTitle(reportType, customStartDate, customEndDate);


    // Get sales data
    const salesData = await getSalesData(dateFilter);
    
    // Get chart data for graphs
    const chartData = await getChartData(reportType, dateFilter);

    res.render("sales-report", {
      salesData,
      chartData,
      reportTitle,
      reportType,
      customStartDate: customStartDate || '',
      customEndDate: customEndDate || '',
      activePage: 'sales-report'
    });

  } catch (error) {
    console.error('Error loading sales report:', error);
    res.redirect("/admin/pageerror");
  }
};

// Get sales data with calculations
const getSalesData = async (dateFilter) => {
  const orders = await Order.find({
    ...dateFilter,
    status: { $nin: ['Cancelled'] } // Exclude cancelled orders
  }).populate('orderedItems.product', 'productName category');

  let totalSalesCount = 0;
  let totalOrderAmount = 0;
  let totalDiscount = 0;
  let totalShipping = 0;
  let netSalesAmount = 0;
  
  const salesDetails = [];

  orders.forEach(order => {
    const orderSubtotal = order.totalPrice || 0;
    const orderShipping = order.shippingCharge || 0;
    const orderDiscount = order.discount || 0;
    const orderTotal = orderSubtotal + orderShipping - orderDiscount;

    totalSalesCount += 1;
    totalOrderAmount += orderSubtotal;
    totalDiscount += orderDiscount;
    totalShipping += orderShipping;
    netSalesAmount += orderTotal;

    salesDetails.push({
      orderId: order.orderId,
      orderDate: order.createdOn,
      customerName: order.shippingAddress?.fullName || 'N/A',
      itemsCount: order.orderedItems.length,
      subtotal: orderSubtotal,
      shipping: orderShipping,
      discount: orderDiscount,
      total: orderTotal,
      status: order.status,
      paymentMethod: order.paymentMethod,
      couponCode: order.couponCode || 'N/A'
    });
  });

  return {
    totalSalesCount,
    totalOrderAmount,
    totalDiscount,
    totalShipping,
    netSalesAmount,
    salesDetails
  };
};

// Get chart data for graphs
const getChartData = async (reportType, dateFilter) => {
  let groupBy = {};
  let labels = [];
  
  switch (reportType) {
    case 'daily':
      // Group by hour for daily report
      groupBy = {
        $dateToString: { format: "%H:00", date: "$createdOn" }
      };
      for (let i = 0; i < 24; i++) {
        labels.push(`${i.toString().padStart(2, '0')}:00`);
      }
      break;
      
    case 'weekly':
      // Group by day for weekly report
      groupBy = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdOn" }
      };
      const weekStart = new Date(dateFilter.createdOn.$gte);
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        labels.push(date.toISOString().split('T')[0]);
      }
      break;
      
    case 'monthly':
      // Group by day for monthly report
      groupBy = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdOn" }
      };
      const monthStart = new Date(dateFilter.createdOn.$gte);
      const monthEnd = new Date(dateFilter.createdOn.$lt);
      const currentDate = new Date(monthStart);
      while (currentDate < monthEnd) {
        labels.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
      
    case 'yearly':
      // Group by month for yearly report
      groupBy = {
        $dateToString: { format: "%Y-%m", date: "$createdOn" }
      };
      const year = new Date(dateFilter.createdOn.$gte).getFullYear();
      for (let i = 1; i <= 12; i++) {
        labels.push(`${year}-${i.toString().padStart(2, '0')}`);
      }
      break;
      
    default:
      // For custom, group by day
      groupBy = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdOn" }
      };
      const startDate = new Date(dateFilter.createdOn.$gte);
      const endDate = new Date(dateFilter.createdOn.$lte || dateFilter.createdOn.$lt);
      const current = new Date(startDate);
      while (current <= endDate) {
        labels.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      break;
  }

  const chartData = await Order.aggregate([
    { $match: { ...dateFilter, status: { $nin: ['Cancelled'] } } },
    {
      $group: {
        _id: groupBy,
        salesCount: { $sum: 1 },
        totalAmount: { $sum: { $subtract: [{ $add: ["$totalPrice", { $ifNull: ["$shippingCharge", 0] }] }, { $ifNull: ["$discount", 0] }] } },
        totalDiscount: { $sum: { $ifNull: ["$discount", 0] } }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // Fill in missing data points with zeros
  const salesCounts = [];
  const amounts = [];
  const discounts = [];

  labels.forEach(label => {
    const dataPoint = chartData.find(item => item._id === label);
    salesCounts.push(dataPoint ? dataPoint.salesCount : 0);
    amounts.push(dataPoint ? dataPoint.totalAmount : 0);
    discounts.push(dataPoint ? dataPoint.totalDiscount : 0);
  });

  return {
    labels,
    salesCounts,
    amounts,
    discounts
  };
};

// Download PDF Report
const downloadPDFReport = async (req, res) => {
  try {
    const { reportType, customStartDate, customEndDate } = req.query;

    // Get the same date filter logic
    let dateFilter = getDateFilter(reportType, customStartDate, customEndDate);
    const salesData = await getSalesData(dateFilter);

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf"`);

    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.fontSize(14).text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, { align: 'center' });
    doc.moveDown();

    // Add summary
    doc.fontSize(12);
    doc.text(`Total Sales Count: ${salesData.totalSalesCount}`);
    doc.text(`Total Order Amount: ₹${salesData.totalOrderAmount.toLocaleString()}`);
    doc.text(`Total Discount: ₹${salesData.totalDiscount.toLocaleString()}`);
    doc.text(`Total Shipping: ₹${salesData.totalShipping.toLocaleString()}`);
    doc.text(`Net Sales Amount: ₹${salesData.netSalesAmount.toLocaleString()}`);
    doc.moveDown();

    // Add table headers
    const tableTop = doc.y;
    doc.text('Order ID', 50, tableTop);
    doc.text('Date', 120, tableTop);
    doc.text('Customer', 200, tableTop);
    doc.text('Items', 280, tableTop);
    doc.text('Subtotal', 320, tableTop);
    doc.text('Discount', 380, tableTop);
    doc.text('Total', 440, tableTop);
    doc.text('Status', 500, tableTop);

    // Add line under headers
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let yPosition = tableTop + 25;

    // Add order details
    salesData.salesDetails.forEach((order, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(8);
      doc.text(order.orderId, 50, yPosition);
      doc.text(new Date(order.orderDate).toLocaleDateString(), 120, yPosition);
      doc.text(order.customerName.substring(0, 15), 200, yPosition);
      doc.text(order.itemsCount.toString(), 280, yPosition);
      doc.text(`₹${order.subtotal}`, 320, yPosition);
      doc.text(`₹${order.discount}`, 380, yPosition);
      doc.text(`₹${order.total}`, 440, yPosition);
      doc.text(order.status, 500, yPosition);

      yPosition += 15;
    });

    doc.end();

  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ success: false, message: 'Error generating PDF report' });
  }
};

// Download Excel Report
const downloadExcelReport = async (req, res) => {
  try {
    const { reportType, customStartDate, customEndDate } = req.query;

    // Get the same date filter logic
    let dateFilter = getDateFilter(reportType, customStartDate, customEndDate);
    const salesData = await getSalesData(dateFilter);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add summary
    worksheet.getCell('A3').value = 'Summary';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A4').value = `Total Sales Count: ${salesData.totalSalesCount}`;
    worksheet.getCell('A5').value = `Total Order Amount: ₹${salesData.totalOrderAmount.toLocaleString()}`;
    worksheet.getCell('A6').value = `Total Discount: ₹${salesData.totalDiscount.toLocaleString()}`;
    worksheet.getCell('A7').value = `Total Shipping: ₹${salesData.totalShipping.toLocaleString()}`;
    worksheet.getCell('A8').value = `Net Sales Amount: ₹${salesData.netSalesAmount.toLocaleString()}`;

    // Add headers
    const headers = ['Order ID', 'Date', 'Customer', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Status', 'Payment', 'Coupon'];
    worksheet.addRow([]);
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(10);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data
    salesData.salesDetails.forEach(order => {
      worksheet.addRow([
        order.orderId,
        new Date(order.orderDate).toLocaleDateString(),
        order.customerName,
        order.itemsCount,
        order.subtotal,
        order.discount,
        order.shipping,
        order.total,
        order.status,
        order.paymentMethod,
        order.couponCode
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${reportType}-${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).json({ success: false, message: 'Error generating Excel report' });
  }
};

// Helper function to get date filter
const getDateFilter = (reportType, customStartDate, customEndDate) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (reportType) {
    case 'daily':
      return {
        createdOn: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      };

    case 'weekly':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      return {
        createdOn: {
          $gte: weekStart,
          $lt: weekEnd
        }
      };

    case 'monthly':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      return {
        createdOn: {
          $gte: monthStart,
          $lt: monthEnd
        }
      };

    case 'yearly':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear() + 1, 0, 1);

      return {
        createdOn: {
          $gte: yearStart,
          $lt: yearEnd
        }
      };

    case 'custom':
      if (customStartDate && customEndDate) {
        const startDateObj = new Date(customStartDate);
        const endDateObj = new Date(customEndDate);
        endDateObj.setHours(23, 59, 59, 999);

        return {
          createdOn: {
            $gte: startDateObj,
            $lte: endDateObj
          }
        };
      }
      // Fall back to daily if no custom dates
      return {
        createdOn: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      };

    default:
      return {
        createdOn: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      };
  }
};

// Helper function to get report title
const getReportTitle = (reportType, customStartDate, customEndDate) => {
  switch (reportType) {
    case 'daily':
      return 'Daily Sales Report';
    case 'weekly':
      return 'Weekly Sales Report';
    case 'monthly':
      return 'Monthly Sales Report';
    case 'yearly':
      return 'Yearly Sales Report';
    case 'custom':
      if (customStartDate && customEndDate) {
        return `Custom Sales Report (${customStartDate} to ${customEndDate})`;
      }
      return 'Daily Sales Report';
    default:
      return 'Daily Sales Report';
  }
};

module.exports = {
  loadSalesReport,
  getSalesData,
  getChartData,
  downloadPDFReport,
  downloadExcelReport
};
