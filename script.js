// ===========================
// TECHNO RETRO PROFILE - JS
// Interactive Features & Animations
// ===========================

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initProjectFilters();
    initScrollAnimations();
    initTypingEffect();
    initCopyrightYear();
});

// ===========================
// COPYRIGHT YEAR
// ===========================
function initCopyrightYear() {
    const yearEl = document.getElementById('copyrightYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}

// ===========================
// THEME SWITCHER
// ===========================
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    // Load saved theme or default to vibrant
    const savedTheme = localStorage.getItem('theme') || 'vibrant';
    if (savedTheme === 'apple') {
        html.setAttribute('data-theme', 'apple');
    }

    // Toggle theme on button click
    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'apple' ? 'vibrant' : 'apple';

        if (newTheme === 'apple') {
            html.setAttribute('data-theme', 'apple');
        } else {
            html.removeAttribute('data-theme');
        }

        // Save preference
        localStorage.setItem('theme', newTheme);

    });
}

// ===========================
// NAVIGATION
// ===========================
function initNavigation() {
    const nav = document.querySelector('.nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            nav.style.background = 'rgba(10, 10, 15, 0.95)';
            nav.style.boxShadow = '0 10px 30px rgba(0, 255, 255, 0.2)';
        } else {
            nav.style.background = 'rgba(10, 10, 15, 0.8)';
            nav.style.boxShadow = 'none';
        }
    });

    // Mobile menu toggle
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            document.querySelector('.nav-links').classList.toggle('active');
        });
    }

    // Smooth scroll
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }

            // Close mobile menu after navigating
            if (navToggle) {
                navToggle.classList.remove('active');
                document.querySelector('.nav-links').classList.remove('active');
            }
        });
    });

    // Active link on scroll
    window.addEventListener('scroll', () => {
        let current = '';
        const sections = document.querySelectorAll('section');

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// ===========================
// PROJECT FILTERS
// ===========================
function initProjectFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    // Scoped to #projects only, so sections that reuse .project-card for a different grid
    // (e.g. #blog) aren't hidden by a filter button that lives in the Projects section.
    const projectCards = document.querySelectorAll('#projects .project-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            projectCards.forEach(card => {
                // Don't filter the "more projects" card
                if (card.classList.contains('more-projects')) {
                    card.style.display = 'flex';
                    return;
                }

                if (filter === 'all') {
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.5s ease';
                } else {
                    const categories = card.getAttribute('data-category');
                    if (categories && categories.includes(filter)) {
                        card.style.display = 'block';
                        card.style.animation = 'fadeIn 0.5s ease';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
        });
    });
}

// Add fadeIn animation
const fadeStyle = document.createElement('style');
fadeStyle.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(fadeStyle);

// ===========================
// SCROLL ANIMATIONS
// ===========================
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                // Clear the inline transform (rather than setting translateY(0)) once revealed,
                // so it doesn't out-specificity the card's CSS :hover lift animation afterwards.
                entry.target.style.transform = '';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Animate elements on scroll
    const animateElements = document.querySelectorAll('.project-card, .skill-category, .info-card, .highlight-item, .update-card');

    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ===========================
// TYPING EFFECT
// ===========================
function initTypingEffect() {
    const typingText = document.querySelector('.typing-text');
    if (!typingText) return;

    const texts = [
        'Building the future with AI & Code',
        'Creating innovative solutions',
        'Transforming ideas into reality',
        '10+ years of excellence'
    ];

    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    function type() {
        const currentText = texts[textIndex];

        if (isDeleting) {
            typingText.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 50;
        } else {
            typingText.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 100;
        }

        if (!isDeleting && charIndex === currentText.length) {
            isDeleting = true;
            typingSpeed = 2000; // Pause at end
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % texts.length;
            typingSpeed = 500; // Pause before next text
        }

        setTimeout(type, typingSpeed);
    }

    type();
}

// ===========================
// GLITCH EFFECT ON HOVER
// ===========================
document.querySelectorAll('.glitch').forEach(element => {
    element.addEventListener('mouseenter', () => {
        element.style.animation = 'glitchText 0.3s infinite';
    });

    element.addEventListener('mouseleave', () => {
        element.style.animation = 'glitchText 5s infinite';
    });
});

// ===========================
// STATS COUNTER ANIMATION
// ===========================
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value + '+';
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Animate stats when they come into view
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statValue = entry.target;
            const text = statValue.textContent;
            const number = parseInt(text.replace('+', ''));

            if (!statValue.dataset.animated) {
                animateValue(statValue, 0, number, 2000);
                statValue.dataset.animated = 'true';
            }
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-value').forEach(stat => {
    statsObserver.observe(stat);
});

// ===========================
// PARALLAX EFFECT
// ===========================
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.hero-profile');

    parallaxElements.forEach(element => {
        const speed = 0.5;
        element.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// ===========================
// PROJECT CARD TILT EFFECT
// ===========================
document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

// ===========================
// CONSOLE EASTER EGG
// ===========================
console.log('%c👨‍💻 ANKUR SONI', 'color: #00ffcc; font-size: 30px; font-weight: bold; text-shadow: 0 0 10px #00ffcc;');
console.log('%c🚀 Full-Stack Developer | AI Innovator', 'color: #ff6b9d; font-size: 16px; font-weight: bold;');
console.log('%c✨ Building the future, one line of code at a time', 'color: #00ffa3; font-size: 14px;');
console.log('%c📧 ankursoni948@gmail.com', 'color: #b24bf3; font-size: 12px;');
console.log('%c🔗 https://linkedin.com/in/ankursoni948', 'color: #00d4ff; font-size: 12px;');
console.log('%c🐙 https://github.com/soniAnkur', 'color: #b24bf3; font-size: 12px;');

// ===========================
// PERFORMANCE OPTIMIZATION
// ===========================

// Lazy load images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll handlers
const debouncedScroll = debounce(() => {
    // Any expensive scroll operations here
}, 100);

window.addEventListener('scroll', debouncedScroll);

// ===========================
// ACCESSIBILITY ENHANCEMENTS
// ===========================

// Keyboard navigation for project filters
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            btn.click();
        }
    });
});

// Skip to main content
const skipLink = document.createElement('a');
skipLink.href = '#about';
skipLink.textContent = 'Skip to main content';
skipLink.className = 'skip-link';
skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #00ffcc;
    color: #0d0221;
    padding: 8px 16px;
    text-decoration: none;
    z-index: 10000;
    font-weight: bold;
`;
skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
});
skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
});
document.body.insertBefore(skipLink, document.body.firstChild);

console.log('%c✅ Portfolio initialized successfully!', 'color: #00ff00; font-size: 14px; font-weight: bold;');
