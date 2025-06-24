// Sales Report JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize chart
    initializeSalesChart();
    
    // Handle report type change
    document.getElementById('reportType').addEventListener('change', function() {
        const customDateFields = document.querySelectorAll('#customDateStart, #customDateEnd');
        if (this.value === 'custom') {
            customDateFields.forEach(field => field.style.display = 'block');
        } else {
            customDateFields.forEach(field => field.style.display = 'none');
        }
    });
});

// Initialize the main sales chart
function initializeSalesChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Sales Count',
                    data: chartData.salesCounts,
                    borderColor: '#727cf5',
                    backgroundColor: 'rgba(114, 124, 245, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Sales Amount (₹)',
                    data: chartData.amounts,
                    borderColor: '#0acf97',
                    backgroundColor: 'rgba(10, 207, 151, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Discount (₹)',
                    data: chartData.discounts,
                    borderColor: '#fa5c7c',
                    backgroundColor: 'rgba(250, 92, 124, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Sales Performance Over Time'
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.label.includes('₹')) {
                                label += '₹' + context.parsed.y.toLocaleString();
                            } else {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: getXAxisLabel()
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Sales Count'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Amount (₹)'
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// Get X-axis label based on report type
function getXAxisLabel() {
    switch (reportType) {
        case 'daily':
            return 'Hours';
        case 'weekly':
            return 'Days';
        case 'monthly':
            return 'Days';
        case 'yearly':
            return 'Months';
        case 'custom':
            return 'Days';
        default:
            return 'Time Period';
    }
}

// Download report function
function downloadReport(format) {
    const params = new URLSearchParams();
    params.append('reportType', reportType);
    
    if (reportType === 'custom') {
        params.append('customStartDate', customStartDate);
        params.append('customEndDate', customEndDate);
    }
    
    let url;
    if (format === 'pdf') {
        url = `/admin/sales-report/download-pdf?${params.toString()}`;
    } else if (format === 'excel') {
        url = `/admin/sales-report/download-excel?${params.toString()}`;
    }
    
    // Show loading message
    Swal.fire({
        title: 'Generating Report...',
        text: 'Please wait while we prepare your report',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Create a temporary link to download the file
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Close loading message after a short delay
    setTimeout(() => {
        Swal.close();
        Swal.fire({
            icon: 'success',
            title: 'Report Downloaded!',
            text: 'Your sales report has been downloaded successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    }, 2000);
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format currency
function formatCurrency(amount) {
    return '₹' + formatNumber(amount);
}

// Initialize mini charts for summary cards (optional enhancement)
function initializeMiniCharts() {
    // This can be enhanced with small sparkline charts for each summary card
    // Using Chart.js or other lightweight charting library
}

// Auto-refresh functionality (optional)
function setupAutoRefresh() {
    // Auto-refresh every 5 minutes for real-time data
    setInterval(() => {
        if (reportType === 'daily') {
            location.reload();
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Print report functionality
function printReport() {
    window.print();
}

// Export table data to CSV (client-side alternative)
function exportTableToCSV() {
    const table = document.querySelector('.table');
    const rows = Array.from(table.querySelectorAll('tr'));
    
    const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => `"${cell.textContent.trim()}"`).join(',');
    }).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
}

// Validate custom date range
function validateDateRange() {
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;
    
    if (reportType === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Date Range',
                text: 'Start date cannot be later than end date.'
            });
            return false;
        }
        
        // Check if date range is too large (more than 1 year)
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) {
            Swal.fire({
                icon: 'warning',
                title: 'Large Date Range',
                text: 'Date range is quite large. Report generation might take longer.',
                showCancelButton: true,
                confirmButtonText: 'Continue',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed) {
                    document.getElementById('reportFilterForm').submit();
                }
            });
            return false;
        }
    }
    
    return true;
}

// Add form validation
document.getElementById('reportFilterForm').addEventListener('submit', function(e) {
    if (!validateDateRange()) {
        e.preventDefault();
    }
});
