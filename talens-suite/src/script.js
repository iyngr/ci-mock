// Professional Talens Suite - Clean Interactions
(function () {
    'use strict';

    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '20px'
    };

    // Initialize scroll animations
    const initScrollAnimations = () => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe product sections
        const productSections = document.querySelectorAll('.product-section');
        productSections.forEach(section => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';
            section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(section);
        });
    };

    // Brand icon interaction
    const initBrandInteraction = () => {
        const brandIcon = document.querySelector('.brand-icon');

        if (brandIcon) {
            brandIcon.addEventListener('click', () => {
                brandIcon.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    brandIcon.style.transform = 'scale(1)';
                }, 150);
            });
        }
    };

    // Product section interactions
    const initProductInteractions = () => {
        const productSections = document.querySelectorAll('.product-section');

        productSections.forEach(section => {
            // Smooth hover effects
            section.addEventListener('mouseenter', () => {
                section.style.transform = 'translateY(-4px)';
            });

            section.addEventListener('mouseleave', () => {
                section.style.transform = 'translateY(0)';
            });
        });
    };

    // Feature item interactions
    const initFeatureInteractions = () => {
        const featureItems = document.querySelectorAll('.feature-item');

        featureItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'scale(1.02)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.transform = 'scale(1)';
            });
        });
    };

    // Initialize everything
    const init = () => {
        console.log('🎯 Initializing Professional Talens Suite...');

        // Initialize all interactions
        initScrollAnimations();
        initBrandInteraction();
        initProductInteractions();
        initFeatureInteractions();

        console.log('✅ Professional Talens Suite loaded successfully!');
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();