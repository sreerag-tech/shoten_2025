const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");

// Load Returned Items Log Page
const loadReturnedItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Search and filter parameters
    const search = req.query.search || '';
    const status = req.query.status || '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';
    const sortBy = req.query.sortBy || 'returnDate';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build aggregation pipeline
    const pipeline = [
      // Unwind the orderedItems array
      { $unwind: '$orderedItems' },
      
      // Match only returned items
      { 
        $match: { 
          'orderedItems.status': 'Returned' 
        } 
      },

      // Populate user and product data
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.product',
          foreignField: '_id',
          as: 'product'
        }
      },

      // Unwind populated data
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },

      // Add computed fields
      {
        $addFields: {
          returnDate: '$orderedItems.updatedAt',
          refundAmount: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] },
          customerName: '$user.name',
          customerEmail: '$user.email',
          productName: '$product.productName',
          returnReason: '$orderedItems.returnReason',
          adminResponse: '$orderedItems.adminResponse'
        }
      }
    ];

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderId: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerEmail: { $regex: search, $options: 'i' } },
            { productName: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add date filter
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      pipeline.push({
        $match: { returnDate: dateFilter }
      });
    }

    // Add sorting
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortObj });

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const totalReturns = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Execute aggregation
    const returnedItems = await Order.aggregate(pipeline);

    // Calculate statistics
    const statsResult = await Order.aggregate([
      { $unwind: '$orderedItems' },
      { $match: { 'orderedItems.status': 'Returned' } },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalRefundAmount: { 
            $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } 
          },
          avgRefundAmount: { 
            $avg: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } 
          }
        }
      }
    ]);

    const stats = statsResult.length > 0 ? statsResult[0] : {
      totalReturns: 0,
      totalRefundAmount: 0,
      avgRefundAmount: 0
    };

    const totalPages = Math.ceil(totalReturns / limit);

    res.render("returned-items", {
      returnedItems: returnedItems,
      currentPage: page,
      totalPages: totalPages,
      totalReturns: totalReturns,
      stats: stats,
      search: search,
      status: status,
      dateFrom: dateFrom,
      dateTo: dateTo,
      sortBy: sortBy,
      sortOrder: sortOrder,
      activePage: 'returned-items'
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

// Export Returned Items Data (CSV)
const exportReturnedItems = async (req, res) => {
  try {
    const pipeline = [
      { $unwind: '$orderedItems' },
      { $match: { 'orderedItems.status': 'Returned' } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderId: 1,
          customerName: '$user.name',
          customerEmail: '$user.email',
          productName: '$product.productName',
          quantity: '$orderedItems.quantity',
          price: '$orderedItems.price',
          refundAmount: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] },
          returnReason: '$orderedItems.returnReason',
          adminResponse: '$orderedItems.adminResponse',
          returnDate: '$orderedItems.updatedAt',
          orderDate: '$createdOn'
        }
      },
      { $sort: { returnDate: -1 } }
    ];

    const returnedItems = await Order.aggregate(pipeline);

    // Generate CSV
    let csv = 'Order ID,Customer Name,Customer Email,Product Name,Quantity,Price,Refund Amount,Return Reason,Admin Response,Return Date,Order Date\n';
    
    returnedItems.forEach(item => {
      csv += `"${item.orderId}","${item.customerName || ''}","${item.customerEmail || ''}","${item.productName || ''}",${item.quantity},${item.price},${item.refundAmount},"${item.returnReason || ''}","${item.adminResponse || ''}","${new Date(item.returnDate).toLocaleDateString()}","${new Date(item.orderDate).toLocaleDateString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=returned-items.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to export data' });
  }
};

module.exports = {
  loadReturnedItems,
  exportReturnedItems
};
