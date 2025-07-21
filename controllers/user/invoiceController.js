const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const offerService = require("../../services/offerService");

// Generate and Download Invoice
const downloadInvoice = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    console.log('Invoice download requested for order:', orderId, 'by user:', userId);

    if (!userId) {
      console.log('No user session found');
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product')
      .populate('userId');

    if (!order) {
      console.log('Order not found:', orderId, 'for user:', userId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order status allows invoice download - ONLY for shipped or delivered orders
    const allowedStatuses = ['Shipped', 'Out for Delivery', 'Delivered'];
    const hasShippedOrDeliveredItems = order.orderedItems.some(item =>
      allowedStatuses.includes(item.status)
    );

    // More restrictive: require at least one item to be shipped/delivered
    if (!hasShippedOrDeliveredItems) {
      console.log('Invoice download not allowed - no shipped/delivered items. Order status:', order.status);
      return res.status(403).json({
        success: false,
        message: 'Invoice is only available after items are shipped or delivered'
      });
    }

    console.log('Order found, generating invoice for:', order.orderId);

    // Use original order data (prices already include offers applied at order time)
    const orderedItemsWithDetails = order.orderedItems.map(item => {
      return {
        ...item.toObject(),
        finalPrice: item.price, // This already includes any offers that were applied
        itemTotal: item.price * item.quantity
      };
    });

    // Create order object with original data for PDF
    const orderForPDF = {
      ...order.toObject(),
      orderedItems: orderedItemsWithDetails
    };

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    generateInvoicePDF(doc, orderForPDF);
    
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
  const invoiceDate = order.invoiceDate ? new Date(order.invoiceDate).toLocaleDateString() : new Date().toLocaleDateString();
  doc.fontSize(10).text(`Invoice Date: ${invoiceDate}`, 50, 80);
  doc.text(`Order ID: ${order.orderId}`, 50, 95);
  
  // Customer Info
  doc.fontSize(14).text('Bill To:', 50, 130);
  const address = order.shippingAddress || order.address || {};
  doc.fontSize(10).text(address.fullName || address.name || 'N/A', 50, 150);
  doc.text((address.city || 'N/A') + ', ' + (address.state || 'N/A'), 50, 165);
  doc.text('PIN: ' + (address.pincode || address.zipCode || 'N/A'), 50, 180);
  doc.text('Phone: ' + (address.phone || 'N/A'), 50, 195);
  
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
    const productName = item.product?.productName || `Product #${index + 1}`;
    const finalPrice = item.hasOffer && item.finalPrice ? item.finalPrice : item.price;
    const itemTotal = finalPrice * item.quantity;

    doc.text(productName, 50, yPosition);
    doc.text(item.quantity.toString(), 200, yPosition);

    // Show offer price if applicable
    if (item.hasOffer && item.finalPrice < item.originalPrice) {
      doc.text(`₹${finalPrice}`, 250, yPosition);
      doc.fontSize(8).text(`(was ₹${item.originalPrice})`, 250, yPosition + 10);
      doc.fontSize(10);
      yPosition += 10;
    } else {
      doc.text(`₹${finalPrice}`, 250, yPosition);
    }

    doc.text(`₹${itemTotal}`, 300, yPosition);

    // Add offer info if available
    if (item.hasOffer && item.offerInfo) {
      yPosition += 15;
      doc.fontSize(8).text(`Offer: ${item.offerInfo.name}`, 50, yPosition);
      doc.fontSize(10);
    }

    yPosition += 20;
  });
  
  // Use original order totals and calculate correct final total
  const subtotal = order.totalPrice;
  const shippingCharge = order.shippingCharge || 0;
  const discount = order.discount || 0;

  // Calculate correct final total: subtotal + shipping - discount
  const finalTotal = subtotal + shippingCharge - discount;

  // Totals
  yPosition += 20;
  doc.text(`Subtotal: ₹${subtotal}`, 200, yPosition);
  yPosition += 15;

  if (shippingCharge > 0) {
    doc.text(`Shipping: ₹${shippingCharge}`, 200, yPosition);
    yPosition += 15;
  }

  if (discount > 0) {
    doc.text(`Coupon Discount: -₹${discount}`, 200, yPosition);
    yPosition += 15;
  }

  doc.fontSize(12).text(`Total: ₹${finalTotal}`, 200, yPosition);
  
  // Footer
  doc.fontSize(8).text('Thank you for shopping with Shoten!', 50, 700);
}

module.exports = {
  downloadInvoice
};
