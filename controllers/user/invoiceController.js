const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const offerService = require("../../services/offerService");

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

    // Calculate offers for ordered items
    const orderedItemsWithOffers = await Promise.all(order.orderedItems.map(async (item) => {
      if (!item.product) return item;

      const offerResult = await offerService.calculateBestOfferForProduct(item.product._id, userId);

      let finalPrice = item.price;
      let hasOffer = false;
      let offerInfo = null;

      if (offerResult) {
        finalPrice = offerResult.finalPrice;
        hasOffer = true;
        offerInfo = {
          type: offerResult.offer.offerType,
          name: offerResult.offer.offerName,
          discountAmount: offerResult.discount,
          discountPercentage: offerResult.discountPercentage
        };
      }

      return {
        ...item.toObject(),
        finalPrice: finalPrice,
        originalPrice: item.price,
        hasOffer: hasOffer,
        offerInfo: offerInfo
      };
    }));

    // Update order object with offer information
    const orderWithOffers = {
      ...order.toObject(),
      orderedItems: orderedItemsWithOffers
    };

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    generateInvoicePDF(doc, orderWithOffers);
    
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
  
  // Calculate totals with offers
  let subtotalWithOffers = 0;
  order.orderedItems.forEach(item => {
    const itemPrice = item.hasOffer && item.finalPrice ? item.finalPrice : item.price;
    subtotalWithOffers += itemPrice * item.quantity;
  });

  const originalSubtotal = order.totalPrice - (order.shippingCharge || 0) + (order.discount || 0);
  const offerSavings = originalSubtotal - subtotalWithOffers;

  // Totals
  yPosition += 20;
  doc.text(`Subtotal: ₹${subtotalWithOffers}`, 200, yPosition);
  yPosition += 15;

  if (offerSavings > 0) {
    doc.text(`Offer Savings: -₹${offerSavings}`, 200, yPosition);
    yPosition += 15;
  }

  if (order.discount > 0) {
    doc.text(`Coupon Discount: -₹${order.discount}`, 200, yPosition);
    yPosition += 15;
  }

  if (order.shippingCharge > 0) {
    doc.text(`Shipping: ₹${order.shippingCharge}`, 200, yPosition);
    yPosition += 15;
  }

  const finalTotal = subtotalWithOffers + (order.shippingCharge || 0) - (order.discount || 0);
  doc.fontSize(12).text(`Total: ₹${finalTotal}`, 200, yPosition);
  
  // Footer
  doc.fontSize(8).text('Thank you for shopping with Shoten!', 50, 700);
}

module.exports = {
  downloadInvoice
};
