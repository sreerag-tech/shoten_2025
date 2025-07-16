// Sales Report JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize chart
    initializeSalesChart();
    
    // Handle report type change
    const reportTypeSelect = document.getElementById('reportType');
    if (reportTypeSelect) {
        reportTypeSelect.addEventListener('change', function() {
            const customDateStart = document.getElementById('customDateStart');
            const customDateEnd = document.getElementById('customDateEnd');

            if (this.value === 'custom') {
                if (customDateStart) customDateStart.style.display = 'block';
                if (customDateEnd) customDateEnd.style.display = 'block';

                // Make custom date fields required
                const startDateInput = document.getElementById('customStartDate');
                const endDateInput = document.getElementById('customEndDate');
                if (startDateInput) startDateInput.required = true;
                if (endDateInput) endDateInput.required = true;
            } else {
                if (customDateStart) customDateStart.style.display = 'none';
                if (customDateEnd) customDateEnd.style.display = 'none';

                // Remove required attribute for non-custom reports
                const startDateInput = document.getElementById('customStartDate');
                const endDateInput = document.getElementById('customEndDate');
                if (startDateInput) startDateInput.required = false;
                if (endDateInput) endDateInput.required = false;
            }
        });

        // Trigger change event on page load to set initial state
        reportTypeSelect.dispatchEvent(new Event('change'));
    }
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
    const reportTypeSelect = document.getElementById('reportType');
    if (!reportTypeSelect) return true;

    const reportType = reportTypeSelect.value;
    const startDateInput = document.getElementById('customStartDate');
    const endDateInput = document.getElementById('customEndDate');

    if (reportType === 'custom') {
        if (!startDateInput || !endDateInput) return true;

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!startDate || !endDate) {
            Swal.fire({
                icon: 'error',
                title: 'Missing Dates',
                text: 'Please select both start and end dates for custom report.',
                confirmButtonColor: '#007bff'
            });
            return false;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();

        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Dates',
                text: 'Please select valid dates.',
                confirmButtonColor: '#007bff'
            });
            return false;
        }

        if (start > end) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Date Range',
                text: 'Start date cannot be later than end date.',
                confirmButtonColor: '#007bff'
            });
            return false;
        }

        // Check if end date is in the future
        if (end > today) {
            Swal.fire({
                icon: 'warning',
                title: 'Future Date Selected',
                text: 'End date is in the future. Report will only show data up to today.',
                confirmButtonColor: '#007bff'
            });
        }

        // Check if date range is too large (more than 1 year)
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 365) {
            Swal.fire({
                icon: 'warning',
                title: 'Large Date Range',
                text: `Date range is ${diffDays} days. Large reports may take longer to generate.`,
                showCancelButton: true,
                confirmButtonText: 'Continue',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#007bff',
                cancelButtonColor: '#6c757d'
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
const reportForm = document.getElementById('reportFilterForm');
if (reportForm) {
    reportForm.addEventListener('submit', function(e) {
        const isValid = validateDateRange();
        if (!isValid) {
            e.preventDefault();
            return false;
        }

        // Show loading message for report generation
        Swal.fire({
            title: 'Generating Report...',
            text: 'Please wait while we prepare your sales report.',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        return true;
    });
}
