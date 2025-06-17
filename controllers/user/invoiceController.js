const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');

// Generate and Download Invoice
const downloadInvoice = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    
    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product')
      .populate('userId');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    generateInvoicePDF(doc, order);
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to generate invoice' });
  }
};

// Helper function to generate PDF content
function generateInvoicePDF(doc, order) {
  // Header
  doc.fontSize(20).text('SHOTEN INVOICE', 50, 50);
  doc.fontSize(10).text(`Invoice Date: ${new Date(order.invoiceDate).toLocaleDateString()}`, 50, 80);
  doc.text(`Order ID: ${order.orderId}`, 50, 95);
  
  // Customer Info
  doc.fontSize(14).text('Bill To:', 50, 130);
  doc.fontSize(10).text(order.shippingAddress.fullName, 50, 150);
  doc.text(order.shippingAddress.city + ', ' + order.shippingAddress.state, 50, 165);
  doc.text('PIN: ' + order.shippingAddress.pincode, 50, 180);
  doc.text('Phone: ' + order.shippingAddress.phone, 50, 195);
  
  // Order Details
  let yPosition = 230;
  doc.fontSize(14).text('Order Details:', 50, yPosition);
  yPosition += 25;
  
  // Table headers
  doc.fontSize(10);
  doc.text('Item', 50, yPosition);
  doc.text('Qty', 200, yPosition);
  doc.text('Price', 250, yPosition);
  doc.text('Total', 300, yPosition);
  yPosition += 20;
  
  // Draw line
  doc.moveTo(50, yPosition).lineTo(350, yPosition).stroke();
  yPosition += 10;
  
  // Order items
  order.orderedItems.forEach((item, index) => {
    doc.text(`Product #${index + 1}`, 50, yPosition);
    doc.text(item.quantity.toString(), 200, yPosition);
    doc.text(`₹${item.price}`, 250, yPosition);
    doc.text(`₹${item.price * item.quantity}`, 300, yPosition);
    yPosition += 20;
  });
  
  // Totals
  yPosition += 20;
  doc.text(`Subtotal: ₹${order.totalPrice}`, 200, yPosition);
  yPosition += 15;
  if (order.discount > 0) {
    doc.text(`Discount: -₹${order.discount}`, 200, yPosition);
    yPosition += 15;
  }
  if (order.shippingCharge > 0) {
    doc.text(`Shipping: ₹${order.shippingCharge}`, 200, yPosition);
    yPosition += 15;
  }
  doc.fontSize(12).text(`Total: ₹${order.finalAmount}`, 200, yPosition);
  
  // Footer
  doc.fontSize(8).text('Thank you for shopping with Shoten!', 50, 700);
}

module.exports = {
  downloadInvoice
};
