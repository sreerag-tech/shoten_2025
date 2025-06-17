// Cart Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize cart management
    setupCartActions();
    createCartParticles();
    updateCartDisplay();
    
    // Show any messages
    if (typeof cartMessage !== 'undefined' && cartMessage) {
        Swal.fire({
            title: cartMessage.type === "success" ? "✅ Success!" : "❌ Error",
            text: cartMessage.text,
            icon: cartMessage.type,
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    }
});

function setupCartActions() {
    // Quantity increment/decrement buttons
    document.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.disabled) return;
            
            const cartId = this.getAttribute('data-cart-id');
            const action = this.getAttribute('data-action');
            updateCartQuantity(cartId, action);
        });
    });
    
    // Remove item buttons
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const cartId = this.getAttribute('data-cart-id');
            showRemoveItemModal(cartId);
        });
    });
    
    // Clear cart button
    document.querySelector('.clear-cart-btn')?.addEventListener('click', function() {
        showClearCartModal();
    });
    
    // Checkout button
    document.querySelector('.checkout-btn')?.addEventListener('click', function() {
        if (this.disabled) {
            Swal.fire({
                title: '❌ Cannot Checkout',
                text: 'Please remove out-of-stock items before proceeding to checkout.',
                icon: 'error',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            });
            return;
        }
        
        // Proceed to checkout
        window.location.href = '/checkout';
    });
}

function updateCartDisplay() {
    // Update cart count in header
    updateHeaderCartCount();
    
    // Check for out-of-stock items and update checkout button
    const outOfStockItems = document.querySelectorAll('.cart-item').length > 0 && 
                           Array.from(document.querySelectorAll('.cart-item')).some(item => {
                               return item.querySelector('.text-red-400') && 
                                      item.querySelector('.text-red-400').textContent.includes('Out of Stock');
                           });
    
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn && outOfStockItems) {
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('bg-gray-600', 'text-gray-400', 'cursor-not-allowed');
        checkoutBtn.classList.remove('bg-gradient-to-r', 'from-[#00ffff]', 'to-[#0088ff]', 'text-black');
        checkoutBtn.innerHTML = '❌ Cannot Checkout (Out of Stock Items)';
    }
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

function calculateCartTotals() {
    let subtotal = 0;
    let totalItems = 0;
    
    document.querySelectorAll('.cart-item').forEach(item => {
        const quantity = parseInt(item.querySelector('.quantity-display').textContent);
        const priceText = item.querySelector('.item-total').textContent.replace('₹', '').replace(',', '');
        const itemTotal = parseFloat(priceText);
        
        if (!isNaN(itemTotal)) {
            subtotal += itemTotal;
            totalItems += quantity;
        }
    });
    
    // Update display
    const subtotalElement = document.getElementById('cart-subtotal');
    const totalElement = document.getElementById('cart-total');
    
    if (subtotalElement) {
        subtotalElement.textContent = `₹${subtotal.toLocaleString()}`;
    }
    
    if (totalElement) {
        totalElement.textContent = `₹${subtotal.toLocaleString()}`;
    }
    
    // Update items count
    const itemsCountElements = document.querySelectorAll('.items-count');
    itemsCountElements.forEach(element => {
        element.textContent = totalItems;
    });
}

function showRemoveItemModal(cartId) {
    Swal.fire({
        title: '🗑️ Remove Item',
        text: 'Are you sure you want to remove this item from your cart?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, remove it!',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            removeFromCart(cartId);
        }
    });
}

function showClearCartModal() {
    Swal.fire({
        title: '🗑️ Clear Cart',
        text: 'Are you sure you want to remove all items from your cart?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, clear cart!',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            clearCart();
        }
    });
}

function createCartParticles() {
    const particlesContainer = document.getElementById('cart-particles');
    if (!particlesContainer) return;

    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (Math.random() * 4 + 8) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Add to cart function for product pages
function addToCart(productId, quantity = 1) {
    // Show loading
    Swal.fire({
        title: '🛒 Adding to Cart...',
        text: 'Please wait while we add the item to your cart.',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    fetch('/cart/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity })
    })
    .then(response => response.json())
    .then(data => {
        Swal.close();
        
        if (data.success) {
            Swal.fire({
                title: '✅ Added to Cart!',
                text: data.message,
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Update cart count
            updateHeaderCartCount();
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
        Swal.fire({
            title: '❌ Error',
            text: 'Failed to add item to cart. Please try again.',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

// Make addToCart globally available
window.addToCart = addToCart;
