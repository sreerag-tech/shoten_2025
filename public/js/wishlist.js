// Wishlist Management JavaScript

// Remove item from wishlist
function removeFromWishlist(productId) {
    Swal.fire({
        title: '💔 Remove from Wishlist',
        text: 'Are you sure you want to remove this item from your wishlist?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, remove it!',
        cancelButtonText: 'Keep it',
        background: '#1f2937',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            // Show loading
            Swal.fire({
                title: 'Removing...',
                allowOutsideClick: false,
                showConfirmButton: false,
                background: '#1f2937',
                color: '#ffffff',
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            fetch('/api/wishlist/remove', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productId: productId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove the card from DOM with animation
                    const productCard = document.querySelector(`[data-product-id="${productId}"]`);
                    if (productCard) {
                        productCard.style.transform = 'scale(0)';
                        productCard.style.opacity = '0';
                        setTimeout(() => {
                            productCard.remove();
                            updateWishlistCount();
                            
                            // Check if wishlist is now empty
                            const remainingItems = document.querySelectorAll('[data-product-id]');
                            if (remainingItems.length === 0) {
                                location.reload(); // Reload to show empty state
                            }
                        }, 300);
                    }

                    Swal.fire({
                        title: '✅ Removed!',
                        text: 'Item removed from wishlist',
                        icon: 'success',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    throw new Error(data.message || 'Failed to remove item');
                }
            })
            .catch(error => {
                Swal.fire({
                    title: '❌ Error',
                    text: error.message || 'Failed to remove item from wishlist',
                    icon: 'error',
                    confirmButtonColor: '#00ffff',
                    background: '#1f2937',
                    color: '#ffffff'
                });
            });
        }
    });
}

// Move item to cart
function moveToCart(productId) {
    // Show loading
    const button = event.target;
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    fetch('/api/wishlist/move-to-cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: productId })
    })
    .then(response => response.json())
    .then(data => {
        button.disabled = false;
        button.innerHTML = originalText;

        if (data.success) {
            // Remove from wishlist UI
            const productCard = document.querySelector(`[data-product-id="${productId}"]`);
            if (productCard) {
                productCard.style.transform = 'scale(0)';
                productCard.style.opacity = '0';
                setTimeout(() => {
                    productCard.remove();
                    updateWishlistCount();
                    
                    // Check if wishlist is now empty
                    const remainingItems = document.querySelectorAll('[data-product-id]');
                    if (remainingItems.length === 0) {
                        location.reload(); // Reload to show empty state
                    }
                }, 300);
            }

            Swal.fire({
                title: '🛒 Moved to Cart!',
                text: 'Item successfully moved to cart.',
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff',
                showCancelButton: true,
                confirmButtonText: 'View Cart',
                cancelButtonText: 'Continue Shopping'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = '/cart';
                }
            });

            // Update cart count
            updateCartCount();
        } else {
            throw new Error(data.message || 'Failed to move item to cart');
        }
    })
    .catch(error => {
        button.disabled = false;
        button.innerHTML = originalText;
        
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to move item to cart',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
}

// Move all items to cart
function moveAllToCart() {
    const productCards = document.querySelectorAll('[data-product-id]');
    if (productCards.length === 0) {
        Swal.fire({
            title: '📭 Empty Wishlist',
            text: 'Your wishlist is empty',
            icon: 'info',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return;
    }

    Swal.fire({
        title: '🛒 Move All to Cart',
        text: `Move all ${productCards.length} items from wishlist to cart?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#00ffff',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, move all!',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            // Show loading
            Swal.fire({
                title: 'Moving items...',
                allowOutsideClick: false,
                showConfirmButton: false,
                background: '#1f2937',
                color: '#ffffff',
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Use the new bulk move API
            fetch('/api/wishlist/move-all-to-cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success || data.movedCount > 0) {
                    let message = data.message;
                    if (data.failedCount > 0) {
                        message += `\n\nFailed items:\n${data.failedItems.map(item => `• ${item.name}: ${item.reason}`).join('\n')}`;
                    }

                    Swal.fire({
                        title: data.failedCount > 0 ? '⚠️ Partially Completed' : '✅ Success!',
                        text: message,
                        icon: data.failedCount > 0 ? 'warning' : 'success',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff',
                        showCancelButton: true,
                        confirmButtonText: 'View Cart',
                        cancelButtonText: 'Stay Here'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = '/cart';
                        } else {
                            location.reload();
                        }
                    });

                    // Update cart count
                    updateCartCount();
                } else {
                    throw new Error(data.message || 'Failed to move items to cart');
                }
            })
            .catch(error => {
                Swal.fire({
                    title: '❌ Error',
                    text: error.message || 'Failed to move items to cart',
                    icon: 'error',
                    confirmButtonColor: '#00ffff',
                    background: '#1f2937',
                    color: '#ffffff'
                });
            });
        }
    });
}

// Clear entire wishlist
function clearWishlist() {
    Swal.fire({
        title: '🗑️ Clear Wishlist',
        text: 'Are you sure you want to remove all items from your wishlist? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, clear all!',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            // Show loading
            Swal.fire({
                title: 'Clearing wishlist...',
                allowOutsideClick: false,
                showConfirmButton: false,
                background: '#1f2937',
                color: '#ffffff',
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            fetch('/api/wishlist/clear', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        title: '✅ Wishlist Cleared!',
                        text: 'All items have been removed from your wishlist',
                        icon: 'success',
                        confirmButtonColor: '#00ffff',
                        background: '#1f2937',
                        color: '#ffffff'
                    }).then(() => {
                        location.reload();
                    });
                } else {
                    throw new Error(data.message || 'Failed to clear wishlist');
                }
            })
            .catch(error => {
                Swal.fire({
                    title: '❌ Error',
                    text: error.message || 'Failed to clear wishlist',
                    icon: 'error',
                    confirmButtonColor: '#00ffff',
                    background: '#1f2937',
                    color: '#ffffff'
                });
            });
        }
    });
}

// Update wishlist count in header
function updateWishlistCount() {
    fetch('/api/wishlist/count')
        .then(response => response.json())
        .then(data => {
            const countElement = document.querySelector('.wishlist-count');
            if (countElement) {
                countElement.textContent = data.count || 0;
            }
        })
        .catch(error => {
            console.error('Error updating wishlist count:', error);
        });
}

// Update cart count in header
function updateCartCount() {
    fetch('/cart/count')
        .then(response => response.json())
        .then(data => {
            const countElement = document.querySelector('.cart-count');
            if (countElement) {
                countElement.textContent = data.count || 0;
            }
        })
        .catch(error => {
            console.error('Error updating cart count:', error);
        });
}
