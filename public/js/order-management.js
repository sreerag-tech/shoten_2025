// Order Management JavaScript

// Cancel order function
function cancelOrder(orderId, itemId = null) {
    Swal.fire({
        title: 'Cancel Order',
        html: `
            <div class="text-left">
                <p class="mb-4">Are you sure you want to cancel this ${itemId ? 'item' : 'order'}?</p>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Reason for cancellation (Optional)
                    </label>
                    <textarea 
                        id="cancelReason" 
                        class="w-full p-3 border border-gray-300 rounded-lg resize-none"
                        rows="3"
                        placeholder="Please provide a reason for cancellation..."
                    ></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Yes, Cancel',
        cancelButtonText: 'No, Keep Order',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        preConfirm: () => {
            const reason = document.getElementById('cancelReason').value.trim();
            return { reason: reason || 'No reason provided' };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            submitCancellation(orderId, itemId, result.value.reason);
        }
    });
}

// Submit cancellation request
function submitCancellation(orderId, itemId, reason) {
    Swal.fire({
        title: 'Processing Cancellation...',
        text: 'Please wait while we process your cancellation request.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const requestData = {
        orderId: orderId,
        reason: reason
    };

    if (itemId) {
        requestData.itemId = itemId;
    }

    fetch('/cancel-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        Swal.close();
        
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Cancellation Successful',
                text: data.message,
                confirmButtonColor: '#10b981'
            }).then(() => {
                // Reload page to show updated status
                window.location.reload();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Cancellation Failed',
                text: data.message,
                confirmButtonColor: '#ef4444'
            });
        }
    })
    .catch(error => {
        Swal.close();
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.',
            confirmButtonColor: '#ef4444'
        });
    });
}

// Return order function
function returnOrder(orderId, itemId = null) {
    Swal.fire({
        title: 'Return Order',
        html: `
            <div class="text-left">
                <p class="mb-4">Please provide a reason for returning this ${itemId ? 'item' : 'order'}:</p>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Reason for return <span class="text-red-500">*</span>
                    </label>
                    <select id="returnReason" class="w-full p-3 border border-gray-300 rounded-lg mb-3">
                        <option value="">Select a reason</option>
                        <option value="Defective/Damaged product">Defective/Damaged product</option>
                        <option value="Wrong item received">Wrong item received</option>
                        <option value="Size/Color mismatch">Size/Color mismatch</option>
                        <option value="Quality not as expected">Quality not as expected</option>
                        <option value="Changed mind">Changed mind</option>
                        <option value="Other">Other</option>
                    </select>
                    <textarea 
                        id="returnDetails" 
                        class="w-full p-3 border border-gray-300 rounded-lg resize-none"
                        rows="3"
                        placeholder="Please provide additional details..."
                    ></textarea>
                </div>
                <div class="text-sm text-gray-600">
                    <p>• Return requests are processed within 24-48 hours</p>
                    <p>• Refund will be processed after item inspection</p>
                    <p>• Items should be in original condition</p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Submit Return Request',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#6b7280',
        preConfirm: () => {
            const reason = document.getElementById('returnReason').value;
            const details = document.getElementById('returnDetails').value.trim();
            
            if (!reason) {
                Swal.showValidationMessage('Please select a reason for return');
                return false;
            }
            
            const fullReason = details ? `${reason}: ${details}` : reason;
            return { reason: fullReason };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            submitReturnRequest(orderId, itemId, result.value.reason);
        }
    });
}

// Submit return request
function submitReturnRequest(orderId, itemId, reason) {
    Swal.fire({
        title: 'Submitting Return Request...',
        text: 'Please wait while we process your return request.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const requestData = {
        orderId: orderId,
        reason: reason
    };

    if (itemId) {
        requestData.itemId = itemId;
    }

    fetch('/return-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        Swal.close();
        
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Return Request Submitted',
                text: data.message,
                confirmButtonColor: '#10b981'
            }).then(() => {
                // Reload page to show updated status
                window.location.reload();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Return Request Failed',
                text: data.message,
                confirmButtonColor: '#ef4444'
            });
        }
    })
    .catch(error => {
        Swal.close();
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.',
            confirmButtonColor: '#ef4444'
        });
    });
}

// Retry payment function
function retryPayment(orderId) {
    Swal.fire({
        title: 'Retry Payment',
        text: 'Do you want to retry the payment for this order?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, retry payment',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            // Redirect to payment retry page
            window.location.href = `/retry-payment/${orderId}`;
        }
    });
}

// Track order function
function trackOrder(orderId) {
    Swal.fire({
        title: 'Order Tracking',
        html: `
            <div class="text-left">
                <p class="mb-4">Order ID: <strong>${orderId}</strong></p>
                <div class="space-y-3">
                    <div class="flex items-center">
                        <div class="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                        <span>Order Confirmed</span>
                    </div>
                    <div class="flex items-center">
                        <div class="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                        <span>Processing</span>
                    </div>
                    <div class="flex items-center">
                        <div class="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
                        <span>Shipped</span>
                    </div>
                    <div class="flex items-center">
                        <div class="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
                        <span>Out for Delivery</span>
                    </div>
                    <div class="flex items-center">
                        <div class="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
                        <span>Delivered</span>
                    </div>
                </div>
            </div>
        `,
        confirmButtonText: 'Close',
        confirmButtonColor: '#6b7280'
    });
}

// Download invoice function
function downloadInvoice(orderId) {
    Swal.fire({
        title: 'Downloading Invoice...',
        text: 'Please wait while we generate your invoice.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Create a temporary link to download the invoice
    const link = document.createElement('a');
    link.href = `/download-invoice/${orderId}`;
    link.download = `invoice-${orderId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        Swal.close();
        Swal.fire({
            icon: 'success',
            title: 'Invoice Downloaded',
            text: 'Your invoice has been downloaded successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    }, 2000);
}
