// Talens Suite - Cosmic Gradient Interactions
(function () {
    'use strict';

    const initScrollAnimations = () => {
        const animatedElements = document.querySelectorAll('[data-animate]');

        if (!animatedElements.length) return;

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = entry.target.getAttribute('data-animation-delay') || 0;
                    setTimeout(() => {
                        entry.target.classList.add('is-visible');
                    }, parseInt(delay, 10));
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });

        animatedElements.forEach(element => {
            observer.observe(element);
        });
    };

    const init = () => {
        console.log('🌌 Initializing Cosmic Talens Suite...');
        initScrollAnimations();
        console.log('✅ Cosmic Talens Suite loaded successfully!');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();