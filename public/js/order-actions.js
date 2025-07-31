// Order Actions JavaScript (Cancel, Return, etc.)

function showCancelOrderModal(orderId) {
    Swal.fire({
        title: '❌ Cancel Order',
        html: `
            <div class="text-left">
                <p class="mb-4 text-gray-300">Are you sure you want to cancel this entire order?</p>
                <label class="block text-sm font-medium mb-2">Reason for cancellation (Required):</label>
                <textarea id="cancel-reason" class="w-full p-3 border rounded bg-gray-700 text-white" rows="3"
                          placeholder="Please provide a reason for cancellation..." required></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, cancel order!',
        cancelButtonText: 'Keep order',
        background: '#1f2937',
        color: '#ffffff',
        preConfirm: () => {
            const reason = document.getElementById('cancel-reason').value.trim();
            if (!reason) {
                Swal.showValidationMessage('Please provide a reason for cancellation');
                return false;
            }
            if (reason.length < 5) {
                Swal.showValidationMessage('Reason must be at least 5 characters long');
                return false;
            }
            return { reason: reason };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            cancelOrder(orderId, result.value.reason).catch(error => {
                // If server returns error about items already cancelled, show appropriate message
                if (error.message && error.message.includes('cancelled')) {
                    Swal.fire({
                        title: '⚠️ Warning',
                        text: 'Some items in this order have already been cancelled. Please refresh the page and try again.',
                        icon: 'warning',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff'
                    });
                } else {
                    Swal.fire({
                        title: '❌ Error',
                        text: error.message || 'Failed to cancel order',
                        icon: 'error',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff'
                    });
                }
            });
        }
    });
}

function showCancelItemModal(orderId, itemIndex) {
    Swal.fire({
        title: '❌ Cancel Item',
        html: `
            <div class="text-left">
                <p class="mb-4 text-gray-300">Are you sure you want to cancel this item?</p>
                <label class="block text-sm font-medium mb-2">Reason for cancellation (Required):</label>
                <textarea id="cancel-item-reason" class="w-full p-3 border rounded bg-gray-700 text-white" rows="3"
                          placeholder="Please provide a reason for cancellation..." required></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, cancel item!',
        cancelButtonText: 'Keep item',
        background: '#1f2937',
        color: '#ffffff',
        preConfirm: () => {
            const reason = document.getElementById('cancel-item-reason').value.trim();
            if (!reason) {
                Swal.showValidationMessage('Please provide a reason for cancellation');
                return false;
            }
            if (reason.length < 5) {
                Swal.showValidationMessage('Reason must be at least 5 characters long');
                return false;
            }
            return { reason: reason };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            cancelOrderItem(orderId, itemIndex, result.value.reason).catch(error => {
                // If server returns error about item already cancelled, show appropriate message
                if (error.message && error.message.includes('cancelled')) {
                    Swal.fire({
                        title: '⚠️ Warning',
                        text: 'This item has already been cancelled. Please refresh the page and try again.',
                        icon: 'warning',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff'
                    });
                } else {
                    Swal.fire({
                        title: '❌ Error',
                        text: error.message || 'Failed to cancel item',
                        icon: 'error',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff'
                    });
                }
            });
        }
    });
}

function showReturnOrderModal(orderId) {
    Swal.fire({
        title: '🔄 Return Order',
        html: `
            <div class="text-left">
                <p class="mb-4 text-gray-300">Please provide a reason for returning this order:</p>
                <label class="block text-sm font-medium mb-2">Reason for return (Required):</label>
                <select id="return-reason" class="w-full p-3 border rounded bg-gray-700 text-white mb-3">
                    <option value="">Select a reason</option>
                    <option value="Defective Product">Defective Product</option>
                    <option value="Wrong Item Received">Wrong Item Received</option>
                    <option value="Size/Fit Issues">Size/Fit Issues</option>
                    <option value="Not as Described">Not as Described</option>
                    <option value="Quality Issues">Quality Issues</option>
                    <option value="Changed Mind">Changed Mind</option>
                    <option value="Other">Other</option>
                </select>
                <textarea id="return-details" class="w-full p-3 border rounded bg-gray-700 text-white" rows="3" 
                          placeholder="Please provide additional details..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Submit Return Request',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff',
        preConfirm: () => {
            const reason = document.getElementById('return-reason').value;
            const details = document.getElementById('return-details').value;
            
            if (!reason) {
                Swal.showValidationMessage('Please select a reason for return');
                return false;
            }
            
            return { reason: reason, details: details };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            returnOrder(orderId, result.value.reason, result.value.details);
        }
    });
}

function showReturnItemModal(orderId, itemIndex) {
    Swal.fire({
        title: '🔄 Return Item',
        html: `
            <div class="text-left">
                <p class="mb-4 text-gray-300">Please provide a reason for returning this item:</p>
                <label class="block text-sm font-medium mb-2">Reason for return (Required):</label>
                <select id="return-item-reason" class="w-full p-3 border rounded bg-gray-700 text-white mb-3">
                    <option value="">Select a reason</option>
                    <option value="Defective Product">Defective Product</option>
                    <option value="Wrong Item Received">Wrong Item Received</option>
                    <option value="Size/Fit Issues">Size/Fit Issues</option>
                    <option value="Not as Described">Not as Described</option>
                    <option value="Quality Issues">Quality Issues</option>
                    <option value="Changed Mind">Changed Mind</option>
                    <option value="Other">Other</option>
                </select>
                <textarea id="return-item-details" class="w-full p-3 border rounded bg-gray-700 text-white" rows="3" 
                          placeholder="Please provide additional details..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Submit Return Request',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff',
        preConfirm: () => {
            const reason = document.getElementById('return-item-reason').value;
            const details = document.getElementById('return-item-details').value;
            
            if (!reason) {
                Swal.showValidationMessage('Please select a reason for return');
                return false;
            }
            
            return { reason: reason, details: details };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            returnOrderItem(orderId, itemIndex, result.value.reason, result.value.details);
        }
    });
}

// API Functions
function cancelOrder(orderId, reason) {
    fetch(`/orders/${orderId}/cancel`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: '✅ Order Cancelled!',
                text: 'Your order has been cancelled successfully.',
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                location.reload();
            });
        } else {
            throw new Error(data.message || 'Failed to cancel order');
        }
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to cancel order',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

function cancelOrderItem(orderId, itemIndex, reason) {
    fetch(`/orders/${orderId}/items/${itemIndex}/cancel`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: '✅ Item Cancelled!',
                text: 'The item has been cancelled successfully.',
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                location.reload();
            });
        } else {
            throw new Error(data.message || 'Failed to cancel item');
        }
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to cancel item',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

function returnOrder(orderId, reason, details) {
    fetch(`/orders/${orderId}/return`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason, details: details })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: '✅ Return Request Submitted!',
                text: 'Your return request has been submitted successfully.',
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                location.reload();
            });
        } else {
            throw new Error(data.message || 'Failed to submit return request');
        }
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to submit return request',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

function returnOrderItem(orderId, itemIndex, reason, details) {
    fetch(`/orders/${orderId}/items/${itemIndex}/return`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason, details: details })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: '✅ Return Request Submitted!',
                text: 'Your return request for this item has been submitted successfully.',
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                location.reload();
            });
        } else {
            throw new Error(data.message || 'Failed to submit return request');
        }
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to submit return request',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

function downloadInvoice(orderId) {
    // Show loading
    Swal.fire({
        title: '📄 Generating Invoice...',
        text: 'Please wait while we prepare your invoice.',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Download invoice
    fetch(`/orders/${orderId}/invoice`, {
        method: 'GET'
    })
    .then(response => {
        if (response.ok) {
            return response.blob();
        }
        throw new Error('Failed to generate invoice');
    })
    .then(blob => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        Swal.close();
        
        Swal.fire({
            title: '✅ Invoice Downloaded!',
            text: 'Your invoice has been downloaded successfully.',
            icon: 'success',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff',
            timer: 2000,
            showConfirmButton: false
        });
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to download invoice',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}
