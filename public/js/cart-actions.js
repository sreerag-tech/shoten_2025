// Cart Actions JavaScript (Update, Remove, Clear)

// Function to remove out-of-stock item
async function removeOutOfStockItem(cartId) {
    const cartItem = document.querySelector(`[data-cart-id="${cartId}"]`);
    
    try {
        const response = await fetch('/cart/remove', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cartItemId: cartId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Remove item from DOM with animation
            cartItem.style.transition = 'all 0.3s ease';
            cartItem.style.opacity = '0';
            cartItem.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                cartItem.remove();
                updateCartTotals();
                checkEmptyCart();
                updateHeaderCartCount();
            }, 300);
            
            showToast('success', data.message);
        } else {
            showToast('error', data.message);
        }
    } catch (error) {
        console.error('Error removing out of stock item:', error);
        showToast('error', 'Failed to remove item. Please try again.');
    }
}

// Add event listener for remove out-of-stock button
document.addEventListener('DOMContentLoaded', () => {
    const removeButtons = document.querySelectorAll('.remove-out-of-stock-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const cartId = e.target.dataset.cartId;
            removeOutOfStockItem(cartId);
        });
    });
});

function updateCartQuantity(cartId, action) {
    // Show loading on the specific item
    const cartItem = document.querySelector(`[data-cart-id="${cartId}"]`);
    const quantityBtns = cartItem.querySelectorAll('.quantity-btn');
    
    // Disable buttons temporarily
    quantityBtns.forEach(btn => btn.disabled = true);
    
    fetch('/cart/update-quantity', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cartItemId: cartId, action: action })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.shouldRemove) {
                // Remove item from DOM with animation
                cartItem.style.transition = 'all 0.3s ease';
                cartItem.style.opacity = '0';
                cartItem.style.transform = 'translateX(-100%)';
                
                setTimeout(() => {
                    cartItem.remove();
                    updateCartTotals();
                    checkEmptyCart();
                }, 300);
                
                // Show success message
                showToast('success', data.message);
            } else {
                // Update quantity display
                const quantityDisplay = cartItem.querySelector('.quantity-display');
                quantityDisplay.textContent = data.newQuantity;
                
                // Update item total
                const itemTotalElement = cartItem.querySelector('.item-total');
                itemTotalElement.textContent = `₹${data.itemTotal.toLocaleString()}`;
                
                // Update button states
                updateQuantityButtonStates(cartItem, data.newQuantity);
                
                // Update cart totals
                updateCartTotals();
                
                showToast('success', data.message);
            }
            
            // Update header cart count
            updateHeaderCartCount();
        } else {
            if (data.shouldRemove) {
                // Remove invalid item
                cartItem.style.transition = 'all 0.3s ease';
                cartItem.style.opacity = '0';
                cartItem.style.transform = 'translateX(-100%)';
                
                setTimeout(() => {
                    cartItem.remove();
                    updateCartTotals();
                    checkEmptyCart();
                }, 300);
            }
            
            showToast('error', data.message);
        }
    })
    .catch(error => {
        console.error('Error updating cart quantity:', error);
        showToast('error', 'Failed to update cart. Please try again.');
    })
    .finally(() => {
        // Re-enable buttons
        quantityBtns.forEach(btn => btn.disabled = false);
    });
}

function removeFromCart(cartId) {
    const cartItem = document.querySelector(`[data-cart-id="${cartId}"]`);
    
    fetch('/cart/remove', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cartItemId: cartId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remove item from DOM with animation
            cartItem.style.transition = 'all 0.3s ease';
            cartItem.style.opacity = '0';
            cartItem.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                cartItem.remove();
                updateCartTotals();
                checkEmptyCart();
            }, 300);
            
            // Update header cart count
            updateHeaderCartCount();
            
            showToast('success', data.message);
        } else {
            showToast('error', data.message);
        }
    })
    .catch(error => {
        console.error('Error removing from cart:', error);
        showToast('error', 'Failed to remove item. Please try again.');
    });
}

function clearCart() {
    fetch('/cart/clear', {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Animate all items out
            const cartItems = document.querySelectorAll('.cart-item');
            cartItems.forEach((item, index) => {
                setTimeout(() => {
                    item.style.transition = 'all 0.3s ease';
                    item.style.opacity = '0';
                    item.style.transform = 'translateX(-100%)';
                }, index * 100);
            });
            
            // Show empty cart after animation
            setTimeout(() => {
                location.reload();
            }, cartItems.length * 100 + 300);
            
            // Update header cart count
            updateHeaderCartCount();
            
            showToast('success', data.message);
        } else {
            showToast('error', data.message);
        }
    })
    .catch(error => {
        console.error('Error clearing cart:', error);
        showToast('error', 'Failed to clear cart. Please try again.');
    });
}

function updateQuantityButtonStates(cartItem, newQuantity) {
    const incrementBtn = cartItem.querySelector('.increment-btn');
    const decrementBtn = cartItem.querySelector('.decrement-btn');
    const productId = cartItem.getAttribute('data-product-id');
    
    // Get product stock from data attribute or DOM
    const stockElement = cartItem.querySelector('.text-yellow-400, .text-green-400');
    let maxStock = 999; // Default high number
    
    if (stockElement && stockElement.textContent.includes('Only')) {
        const stockMatch = stockElement.textContent.match(/Only (\d+) left/);
        if (stockMatch) {
            maxStock = parseInt(stockMatch[1]);
        }
    }
    
    // Update increment button state
    if (newQuantity >= 10 || newQuantity >= maxStock) {
        incrementBtn.disabled = true;
        incrementBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        incrementBtn.disabled = false;
        incrementBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    
    // Decrement button is always enabled when quantity > 0
    decrementBtn.disabled = false;
    decrementBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function updateCartTotals() {
    let subtotal = 0;
    let totalItems = 0;

    document.querySelectorAll('.cart-item').forEach(item => {
        const quantity = parseInt(item.querySelector('.quantity-display').textContent);
        const itemTotalText = item.querySelector('.item-total').textContent.replace('₹', '').replace(',', '');
        const itemTotal = parseFloat(itemTotalText);

        if (!isNaN(itemTotal) && !isNaN(quantity)) {
            subtotal += itemTotal;
            totalItems += quantity;
        }
    });

    // Calculate shipping (consistent with server logic)
    const shippingThreshold = 500;
    const shippingCharge = subtotal >= shippingThreshold ? 0 : 50;
    const finalTotal = subtotal + shippingCharge;

    // Update subtotal display
    const subtotalElement = document.getElementById('cart-subtotal');
    if (subtotalElement) {
        subtotalElement.textContent = `₹${subtotal.toLocaleString()}`;
    }

    // Update total display
    const totalElement = document.getElementById('cart-total');
    if (totalElement) {
        totalElement.textContent = `₹${finalTotal.toLocaleString()}`;
    }

    // Update shipping display
    const shippingElements = document.querySelectorAll('.shipping-amount');
    shippingElements.forEach(element => {
        if (shippingCharge > 0) {
            element.textContent = `₹${shippingCharge}`;
            element.className = 'text-white';
        } else {
            element.textContent = 'FREE';
            element.className = 'text-green-400';
        }
    });

    // Update items count in summary
    const itemsCountText = document.querySelector('.text-gray-400');
    if (itemsCountText && itemsCountText.textContent.includes('Items')) {
        itemsCountText.textContent = `Items (${totalItems}):`;
    }

    // Update checkout button state
    updateCheckoutButtonState();
}

function updateCheckoutButtonState() {
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (!checkoutBtn) return;
    
    // Check for out-of-stock items
    const hasOutOfStock = Array.from(document.querySelectorAll('.cart-item')).some(item => {
        const stockStatus = item.querySelector('.text-red-400');
        return stockStatus && stockStatus.textContent.includes('Out of Stock');
    });
    
    // Check if cart is empty
    const cartItems = document.querySelectorAll('.cart-item');
    const isEmpty = cartItems.length === 0;
    
    if (hasOutOfStock || isEmpty) {
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('bg-gray-600', 'text-gray-400', 'cursor-not-allowed');
        checkoutBtn.classList.remove('bg-gradient-to-r', 'from-[#00ffff]', 'to-[#0088ff]', 'text-black', 'hover:from-[#0088ff]', 'hover:to-[#00ffff]');
        
        if (isEmpty) {
            checkoutBtn.innerHTML = '🛒 Cart is Empty';
        } else {
            checkoutBtn.innerHTML = '❌ Cannot Checkout (Out of Stock Items)';
        }
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('bg-gray-600', 'text-gray-400', 'cursor-not-allowed');
        checkoutBtn.classList.add('bg-gradient-to-r', 'from-[#00ffff]', 'to-[#0088ff]', 'text-black', 'hover:from-[#0088ff]', 'hover:to-[#00ffff]');
        checkoutBtn.innerHTML = '🛒 Proceed to Checkout';
    }
}

function checkEmptyCart() {
    const cartItems = document.querySelectorAll('.cart-item');
    
    if (cartItems.length === 0) {
        // Show empty cart state
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
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

function updateHeaderCartCount() {
    fetch('/cart/count')
        .then(response => response.json())
        .then(data => {
            const cartCountElements = document.querySelectorAll('.cart-count');
            cartCountElements.forEach(element => {
                element.textContent = data.count || 0;
                
                // Show/hide cart count badge
                if (data.count > 0) {
                    element.style.display = 'inline-block';
                } else {
                    element.style.display = 'none';
                }
            });
        })
        .catch(error => {
            console.error('Error updating cart count:', error);
        });
}
