// Checkout Actions JavaScript

function addNewAddress(addressData) {
    // Show loading
    Swal.fire({
        title: '📍 Adding Address...',
        text: 'Please wait while we add your new address.',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    fetch('/checkout/add-address', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressData)
    })
    .then(response => response.json())
    .then(data => {
        Swal.close();
        
        if (data.success) {
            Swal.fire({
                title: '✅ Address Added!',
                text: data.message,
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                // Reload page to show new address
                location.reload();
            });
        } else {
            Swal.fire({
                title: '❌ Error',
                text: data.message,
                icon: 'error',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            });
        }
    })
    .catch(error => {
        Swal.close();
        console.error('Error adding address:', error);
        Swal.fire({
            title: '❌ Error',
            text: 'Failed to add address. Please try again.',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

function setDefaultAddress(addressId) {
    fetch('/checkout/set-default-address', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addressId: addressId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('success', data.message);
            
            // Update UI
            document.querySelectorAll('.set-default-btn').forEach(btn => {
                btn.style.display = 'inline-block';
            });
            
            // Hide the clicked button and update the address card
            const clickedBtn = document.querySelector(`[data-address-id="${addressId}"]`);
            if (clickedBtn) {
                clickedBtn.style.display = 'none';
                
                // Update the address card
                const addressCard = clickedBtn.closest('.address-card');
                const nameElement = addressCard.querySelector('h3');
                if (!nameElement.textContent.includes('(Default)')) {
                    nameElement.innerHTML += ' <span class="text-[#00ffff] text-sm font-normal">(Default)</span>';
                }
                
                // Remove default from other cards
                document.querySelectorAll('.address-card').forEach(card => {
                    if (card !== addressCard) {
                        const name = card.querySelector('h3');
                        name.innerHTML = name.innerHTML.replace(/ <span class="text-\[#00ffff\] text-sm font-normal">\(Default\)<\/span>/, '');
                    }
                });
                
                // Select this address
                const radio = addressCard.querySelector('.address-radio');
                if (radio) {
                    radio.checked = true;
                    updateAddressSelection();
                }
            }
        } else {
            showToast('error', data.message);
        }
    })
    .catch(error => {
        console.error('Error setting default address:', error);
        showToast('error', 'Failed to set default address');
    });
}

function placeOrder() {
    // Validate checkout
    if (!validateCheckout()) {
        return;
    }
    
    // Get selected address and payment method
    const selectedAddress = document.querySelector('.address-radio:checked');
    const selectedPayment = document.querySelector('.payment-radio:checked');
    
    const orderData = {
        addressId: selectedAddress.value,
        paymentMethod: selectedPayment.value
    };
    
    // Show confirmation modal
    Swal.fire({
        title: '🛒 Confirm Order',
        html: `
            <div class="text-left">
                <p class="mb-4 text-gray-300">Are you sure you want to place this order?</p>
                <div class="bg-gray-700 rounded-lg p-4 mb-4">
                    <h4 class="text-white font-semibold mb-2">Order Summary:</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Payment Method:</span>
                            <span class="text-white">${selectedPayment.value === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Delivery Address:</span>
                            <span class="text-white">Selected</span>
                        </div>
                    </div>
                </div>
                <p class="text-gray-400 text-sm">
                    ${selectedPayment.value === 'COD' ? 
                        '💰 You will pay when your order is delivered.' : 
                        '💳 You will be redirected to payment gateway.'}
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#00ffff',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '✅ Place Order',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            submitOrder(orderData);
        }
    });
}

function submitOrder(orderData) {
    // Show loading
    Swal.fire({
        title: '🛒 Placing Order...',
        text: 'Please wait while we process your order.',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    fetch('/checkout/place-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
    })
    .then(response => response.json())
    .then(data => {
        Swal.close();
        
        if (data.success) {
            // Show success message and redirect
            Swal.fire({
                title: '🎉 Order Placed!',
                text: data.message,
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                // Redirect to order success page
                window.location.href = `/order-success/${data.orderId}`;
            });
        } else {
            Swal.fire({
                title: '❌ Order Failed',
                text: data.message,
                icon: 'error',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            });
        }
    })
    .catch(error => {
        Swal.close();
        console.error('Error placing order:', error);
        Swal.fire({
            title: '❌ Error',
            text: 'Failed to place order. Please try again.',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

function showToast(type, message) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: type,
        title: message
    });
}

// Auto-select first address if none selected
document.addEventListener('DOMContentLoaded', function() {
    const selectedAddress = document.querySelector('.address-radio:checked');
    if (!selectedAddress) {
        const firstAddress = document.querySelector('.address-radio');
        if (firstAddress) {
            firstAddress.checked = true;
            updateAddressSelection();
        }
    }
});
