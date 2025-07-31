// Wallet Management JavaScript

// Show Add Money Modal
function showAddMoneyModal() {
    document.getElementById('addMoneyModal').classList.remove('hidden');
    document.getElementById('addAmount').focus();
}

// Close Add Money Modal
function closeAddMoneyModal() {
    document.getElementById('addMoneyModal').classList.add('hidden');
    document.getElementById('addMoneyForm').reset();
}

// Set Quick Amount
function setAmount(amount) {
    document.getElementById('addAmount').value = amount;
}

// Initialize Razorpay
let razorpayInstance;

// Add Money Form Handler
document.getElementById('addMoneyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const amount = document.getElementById('addAmount').value;
    let loadingSwal = null;
    
    // Validate amount
    if (!amount || amount <= 0) {
        showError('❌ Invalid Amount', 'Please enter a valid amount');
        return;
    }
    
    if (amount > 50000) {
        showError('❌ Amount Too High', 'Maximum amount allowed is ₹50,000');
        return;
    }
    
    try {
        // Show loading
        loadingSwal = Swal.fire({
            title: 'Processing...',
            text: 'Creating payment request...',
            allowOutsideClick: false,
            showConfirmButton: false,
            background: '#1f2937',
            color: '#ffffff',
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Create Razorpay order
        const orderResponse = await fetch('/wallet/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: amount * 100 }) // Convert to paise
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok || !orderData.success) {
            throw new Error(orderData.message || 'Failed to create payment request');
        }

        // Initialize Razorpay checkout
        const options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'Shoten Wallet Top-up',
            description: 'Adding money to your wallet',
            order_id: orderData.order_id,
            handler: async function (response) {
                try {
                    // Hide loading if still showing
                    if (loadingSwal) {
                        loadingSwal.close();
                    }

                    // Verify payment signature
                    const verifyResponse = await fetch('/wallet/verify-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    const verifyData = await verifyResponse.json();

                    if (!verifyResponse.ok || !verifyData.success) {
                        throw new Error(verifyData.message || 'Payment verification failed');
                    }

                    // Payment successful
                    showSuccess(`₹${amount.toLocaleString()} added to your wallet`, verifyData.newBalance);

                } catch (error) {
                    // Payment failed - redirect to wallet page with error
                    window.location.href = '/wallet';
                    setTimeout(() => {
                        Swal.fire({
                            title: '❌ Payment Failed',
                            text: error.message || 'Could not add money to wallet',
                            icon: 'error',
                            confirmButtonColor: '#00ffff',
                            background: '#1f2937',
                            color: '#ffffff'
                        });
                    }, 1000); // Delay to ensure redirect completes
                }
            },
            prefill: {
                name: orderData.user.name,
                email: orderData.user.email,
                contact: orderData.user.phone
            },
            theme: {
                color: '#00ffff'
            },
            modal: {
                ondismiss: function() {
                    // User exited payment - redirect to wallet page
                    window.location.href = '/wallet';
                    setTimeout(() => {
                        Swal.fire({
                            title: '❌ Payment Cancelled',
                            text: 'Payment was cancelled',
                            icon: 'error',
                            confirmButtonColor: '#00ffff',
                            background: '#1f2937',
                            color: '#ffffff'
                        });
                    }, 1000);
                }
            }
        };

        if (typeof Razorpay === 'undefined') {
            throw new Error('Razorpay SDK not loaded');
        }

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (error) {
        // Close loading if still showing
        if (loadingSwal) {
            loadingSwal.close();
        }

        // Redirect to wallet page with error
        window.location.href = '/wallet';
        setTimeout(() => {
            Swal.fire({
                title: '❌ Error',
                text: error.message || 'Could not add money to wallet',
                icon: 'error',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            });
        }, 1000); // Delay to ensure redirect completes
    }
});

// Helper function to show success message
function showSuccess(message, newBalance) {
    Swal.fire({
        title: '✅ Payment Successful!',
        text: message,
        icon: 'success',
        confirmButtonColor: '#00ffff',
        background: '#1f2937',
        color: '#ffffff'
    }).then(() => {
        closeAddMoneyModal();
        // Update balance display immediately
        document.getElementById('walletBalance').textContent = `₹${newBalance.toLocaleString()}`;
        // Then reload to ensure all data is fresh
        setTimeout(() => location.reload(), 1000);
    });
}

// Helper function to show error message
function showError(title, message) {
    Swal.fire({
        title: title,
        text: message,
        icon: 'error',
        confirmButtonColor: '#00ffff',
        background: '#1f2937',
        color: '#ffffff'
    });
}

// Refresh Transactions
function refreshTransactions() {
    Swal.fire({
        title: 'Refreshing...',
        text: 'Loading latest transactions',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        timer: 1000,
        didOpen: () => {
            Swal.showLoading();
        }
    }).then(() => {
        location.reload();
    });
}

// Get Wallet Balance (for other pages)
function getWalletBalance() {
    return fetch('/wallet/balance')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.balance;
            }
            return 0;
        })
        .catch(error => {
            return 0;
        });
}

// Update Wallet Balance Display (for header)
function updateWalletBalance() {
    getWalletBalance().then(balance => {
        const walletElements = document.querySelectorAll('.wallet-balance');
        walletElements.forEach(element => {
            element.textContent = `₹${balance.toLocaleString()}`;
        });
    });
}

// Close modal on outside click
document.getElementById('addMoneyModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeAddMoneyModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAddMoneyModal();
    }
});

// Initialize wallet balance update on page load
document.addEventListener('DOMContentLoaded', function() {
    updateWalletBalance();
});
