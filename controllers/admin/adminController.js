const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");
const bcrypt = require(`bcrypt`);
const offerService = require("../../services/offerService");

const pageerror = async(req,res)=>{
  res.render("admin-error")
}

const loadLogin = (req,res)=>{
  if(req.session.admin){
    return res.redirect("/admin/dashboard")
  }
  res.render("admin-login",{message:null})
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
   
    // Find admin user
    const admin = await User.findOne({ email, isAdmin: true });
    
    if (!admin) {
      // Render admin login page with error message if no admin found
      return res.render('admin-login', { 
        message: 'Invalid email or password',
      });
    }
    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, admin.password);
    
    if (passwordMatch) {
      // Successful login
      req.session.admin = true;
      req.session.adminId = admin._id;
      return res.redirect('/admin/dashboard');
    } else {
      // Render admin login page with error message if password doesn't match
      return res.render('admin-login', { 
        message: 'Invalid email or password',
        email // Keep email in form
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    // Render admin login page with generic error
    return res.render('admin-login', { 
      message: 'An error occurred. Please try again.',
      email: req.body.email
    });
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      // Get dashboard statistics
      const totalCustomers = await User.countDocuments({ isAdmin: false });
      const totalProducts = await Product.countDocuments();
      const totalOrders = await Order.countDocuments();

      // Get total revenue (offer-adjusted)
      const orders = await Order.find({ status: { $ne: 'Cancelled' } })
        .populate('orderedItems.product');

      let totalRevenue = 0;
      for (const order of orders) {
        let orderTotal = 0;

        for (const item of order.orderedItems) {
          if (item.product) {
            const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

            let finalPrice = item.price;
            if (offerResult) {
              finalPrice = offerResult.finalPrice;
            }

            orderTotal += finalPrice * item.quantity;
          } else {
            orderTotal += item.price * item.quantity;
          }
        }

        // Add shipping and subtract discounts
        orderTotal += (order.shippingCharge || 0) - (order.discount || 0);
        totalRevenue += orderTotal;
      }

      // Get recent orders (last 5) with offer-adjusted amounts
      const recentOrdersRaw = await Order.find()
        .populate('userId', 'name email profileImage')
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .limit(5);

      // Calculate offer-adjusted amounts for recent orders
      const recentOrders = await Promise.all(recentOrdersRaw.map(async (order) => {
        let orderTotal = 0;

        for (const item of order.orderedItems) {
          if (item.product) {
            const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

            let finalPrice = item.price;
            if (offerResult) {
              finalPrice = offerResult.finalPrice;
            }

            orderTotal += finalPrice * item.quantity;
          } else {
            orderTotal += item.price * item.quantity;
          }
        }

        // Add shipping and subtract discounts
        orderTotal += (order.shippingCharge || 0) - (order.discount || 0);

        return {
          ...order.toObject(),
          totalPriceWithOffers: orderTotal
        };
      }));

      // Get latest products (last 5) with offers
      const latestProductsRaw = await Product.find({ isBlocked: false })
        .populate('category', 'name')
        .sort({ createdOn: -1 })
        .limit(5);

      // Calculate offers for latest products
      const latestProducts = await Promise.all(latestProductsRaw.map(async (product) => {
        const offerResult = await offerService.calculateBestOfferForProduct(product._id);

        let finalPrice = product.salePrice;
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
          ...product.toObject(),
          finalPrice: finalPrice,
          hasOffer: hasOffer,
          offerInfo: offerInfo
        };
      }));

      // Initialize bestSellingProducts and bestSellingCategories as empty arrays
      let bestSellingProducts = [];
      let bestSellingCategories = [];

      try {
        // Get best selling products (top 10)
        bestSellingProducts = await Order.aggregate([
          { $match: { status: { $ne: 'Cancelled' } } },
          { $unwind: '$orderedItems' },
          {
            $group: {
              _id: '$orderedItems.product',
              totalSold: { $sum: '$orderedItems.quantity' },
              totalRevenue: { 
                $sum: { 
                  $multiply: [
                    '$orderedItems.quantity',
                    '$orderedItems.price'
                  ]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'products',
              localField: '_id',
              foreignField: '_id',
              as: 'product'
            }
          },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'categories',
              localField: 'product.category',
              foreignField: '_id',
              as: 'category'
            }
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: '$product._id',
              productName: '$product.productName',
              productImage: '$product.productImage',
              salePrice: '$product.salePrice',
              category: { $ifNull: ['$category', null] },
              totalSold: 1,
              totalRevenue: 1
            }
          },
          { $sort: { totalSold: -1 } },
          { $limit: 10 }
        ]).catch(err => {
          console.error('Error in bestSellingProducts aggregation:', err);
          return [];
        });

        // Get best selling categories (top 10)
        bestSellingCategories = await Order.aggregate([
          { $match: { status: { $ne: 'Cancelled' } } },
          { $unwind: '$orderedItems' },
          {
            $lookup: {
              from: 'products',
              localField: 'orderedItems.product',
              foreignField: '_id',
              as: 'product'
            }
          },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$product.category',
              totalSold: { $sum: '$orderedItems.quantity' },
              totalRevenue: { 
                $sum: { 
                  $multiply: [
                    '$orderedItems.quantity',
                    '$orderedItems.price'
                  ]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: '_id',
              as: 'category'
            }
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: '$category._id',
              name: '$category.name',
              totalSold: 1,
              totalRevenue: 1
            }
          },
          { $sort: { totalSold: -1 } },
          { $limit: 10 }
        ]).catch(err => {
          console.error('Error in bestSellingCategories aggregation:', err);
          return [];
        });
      } catch (err) {
        console.error('Error in best selling aggregations:', err);
        // Continue rendering with empty arrays to avoid breaking the dashboard
        bestSellingProducts = [];
        bestSellingCategories = [];
      }

      // Get order statistics by status
      const orderStats = await Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalPrice" }
          }
        }
      ]);

      res.render("dashboard", {
        totalCustomers,
        totalProducts,
        totalOrders,
        totalRevenue,
        recentOrders,
        latestProducts,
        bestSellingProducts,
        bestSellingCategories,
        orderStats,
        activePage: 'dashboard'
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};

const logout = async(req,res)=>{
  try{
    req.session.destroy(err=>{
      if(err){
        console.log("error destroying session",err);
        return res.redirect("/pageerror")
      }
      res.redirect("/admin/login")
    })
  }catch(error){
    console.log(("unexpected error during logout",error));
    res.redirect("/pageerror")
  }
}

// Get chart data with filters
const getChartData = async (req, res) => {
  try {
    const {
      chartType = 'sales',
      period = '7days',
      startDate,
      endDate
    } = req.query;

    let dateFilter = {};
    const now = new Date();

    // Build date filter based on period
    switch (period) {
      case '7days':
        dateFilter.createdOn = {
          $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case '30days':
        dateFilter.createdOn = {
          $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
        break;
      case '90days':
        dateFilter.createdOn = {
          $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter.createdOn = {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
          };
        }
        break;
    }

    let chartData = {};

    switch (chartType) {
      case 'sales':
        chartData = await getSalesChartData(dateFilter, period);
        break;
      case 'orders':
        chartData = await getOrdersChartData(dateFilter, period);
        break;
      case 'categories':
        chartData = await getCategoriesChartData(dateFilter);
        break;
      case 'customers':
        chartData = await getCustomersChartData(dateFilter, period);
        break;
      default:
        chartData = await getSalesChartData(dateFilter, period);
    }

    res.json({ success: true, data: chartData });

  } catch (error) {
    console.error('Error getting chart data:', error);
    res.status(500).json({ success: false, message: 'Error loading chart data' });
  }
};

// Helper function to get sales chart data
const getSalesChartData = async (dateFilter, period) => {
  const groupBy = getGroupByFormat(period);

  const salesData = await Order.aggregate([
    {
      $match: {
        ...dateFilter,
        status: { $nin: ['Cancelled', 'Payment Failed'] },
        paymentStatus: { $ne: 'Failed' }
      }
    },
    {
      $group: {
        _id: groupBy,
        totalSales: { $sum: "$totalPrice" },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  const labels = generateLabels(period);
  const salesAmounts = [];
  const orderCounts = [];

  labels.forEach(label => {
    const dataPoint = salesData.find(item => item._id === label);
    salesAmounts.push(dataPoint ? dataPoint.totalSales : 0);
    orderCounts.push(dataPoint ? dataPoint.orderCount : 0);
  });

  return {
    labels,
    datasets: [
      {
        label: 'Sales Amount (₹)',
        data: salesAmounts,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'y'
      },
      {
        label: 'Order Count',
        data: orderCounts,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y1'
      }
    ]
  };
};

// Helper function to get orders chart data
const getOrdersChartData = async (dateFilter, period) => {
  const groupBy = getGroupByFormat(period);

  const orderData = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          date: groupBy,
          status: "$status"
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.date": 1 } }
  ]);

  const labels = generateLabels(period);
  const statuses = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const datasets = [];

  const colors = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 99, 132, 0.8)'
  ];

  statuses.forEach((status, index) => {
    const data = labels.map(label => {
      const dataPoint = orderData.find(item =>
        item._id.date === label && item._id.status === status
      );
      return dataPoint ? dataPoint.count : 0;
    });

    datasets.push({
      label: status,
      data,
      backgroundColor: colors[index],
      borderColor: colors[index].replace('0.8', '1'),
      borderWidth: 1
    });
  });

  return { labels, datasets };
};

// Helper function to get categories chart data
const getCategoriesChartData = async (dateFilter) => {
  const categoryData = await Order.aggregate([
    {
      $match: {
        ...dateFilter,
        status: { $nin: ['Cancelled', 'Payment Failed'] },
        paymentStatus: { $ne: 'Failed' }
      }
    },
    { $unwind: "$orderedItems" },
    {
      $lookup: {
        from: "products",
        localField: "orderedItems.product",
        foreignField: "_id",
        as: "productInfo"
      }
    },
    { $unwind: "$productInfo" },
    {
      $lookup: {
        from: "categories",
        localField: "productInfo.category",
        foreignField: "_id",
        as: "categoryInfo"
      }
    },
    { $unwind: "$categoryInfo" },
    {
      $group: {
        _id: "$categoryInfo.name",
        totalSales: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } },
        totalQuantity: { $sum: "$orderedItems.quantity" }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: 10 }
  ]);

  const labels = categoryData.map(item => item._id);
  const salesData = categoryData.map(item => item.totalSales);
  const quantityData = categoryData.map(item => item.totalQuantity);

  return {
    labels,
    datasets: [
      {
        label: 'Sales Amount (₹)',
        data: salesData,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
          'rgba(199, 199, 199, 0.8)',
          'rgba(83, 102, 255, 0.8)',
          'rgba(255, 99, 255, 0.8)',
          'rgba(99, 255, 132, 0.8)'
        ]
      }
    ]
  };
};

// Helper function to get customers chart data
const getCustomersChartData = async (dateFilter, period) => {
  const groupBy = getGroupByFormat(period);

  const customerData = await User.aggregate([
    { $match: { ...dateFilter, isAdmin: false } },
    {
      $group: {
        _id: groupBy,
        newCustomers: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  const labels = generateLabels(period);
  const newCustomers = [];

  labels.forEach(label => {
    const dataPoint = customerData.find(item => item._id === label);
    newCustomers.push(dataPoint ? dataPoint.newCustomers : 0);
  });

  return {
    labels,
    datasets: [
      {
        label: 'New Customers',
        data: newCustomers,
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        fill: true
      }
    ]
  };
};

// Utility function to get group by format based on period
const getGroupByFormat = (period) => {
  switch (period) {
    case '7days':
      return { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
    case '30days':
      return { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
    case '90days':
      return { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
    default:
      return { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } };
  }
};

// Utility function to generate labels based on period
const generateLabels = (period) => {
  const labels = [];
  const now = new Date();

  switch (period) {
    case '7days':
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(date.toISOString().split('T')[0]);
      }
      break;
    case '30days':
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(date.toISOString().split('T')[0]);
      }
      break;
    case '90days':
      for (let i = 89; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(date.toISOString().split('T')[0]);
      }
      break;
  }

  return labels;
};

module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getChartData
}