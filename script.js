// ===========================
// TECHNO RETRO PROFILE - JS
// Interactive Features & Animations
// ===========================

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initParticles();
    initNavigation();
    initProjectFilters();
    initScrollAnimations();
    initTypingEffect();
});

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

        // Update particles with new theme colors
        updateParticleColors(newTheme);
    });
}

function updateParticleColors(theme) {
    const particlesContainer = document.getElementById('particles');
    particlesContainer.innerHTML = '';
    initParticles();
}

// ===========================
// PARTICLE ANIMATION
// ===========================
function initParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        createParticle(particlesContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    const size = Math.random() * 3 + 1;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;

    // Get theme-specific colors
    const html = document.documentElement;
    const isAppleTheme = html.getAttribute('data-theme') === 'apple';

    const colors = isAppleTheme
        ? ['#007AFF', '#FF2D55', '#34C759', '#5AC8FA', '#AF52DE', '#FF9500'] // Apple colors
        : ['#00d9ff', '#ff3d8f', '#00ff88', '#a855f7', '#14b8a6', '#f97316']; // Vibrant colors

    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${randomColor};
        border-radius: 50%;
        left: ${x}%;
        top: ${y}%;
        opacity: ${Math.random() * 0.5 + 0.2};
        animation: float ${duration}s ease-in-out ${delay}s infinite;
        box-shadow: 0 0 ${size * 3}px currentColor;
    `;

    container.appendChild(particle);
}

// Add CSS animation for particles
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% {
            transform: translate(0, 0) rotate(0deg);
        }
        25% {
            transform: translate(20px, -20px) rotate(90deg);
        }
        50% {
            transform: translate(-20px, 20px) rotate(180deg);
        }
        75% {
            transform: translate(-20px, -20px) rotate(270deg);
        }
    }
`;
document.head.appendChild(style);

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
    const projectCards = document.querySelectorAll('.project-card');

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
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Animate elements on scroll
    const animateElements = document.querySelectorAll('.project-card, .skill-category, .info-card, .highlight-item');

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
// CURSOR TRAIL EFFECT
// ===========================
let cursorTrail = [];
const maxTrail = 20;

document.addEventListener('mousemove', (e) => {
    // Create cursor dot with Aurora colors
    const colors = ['#00ffcc', '#b24bf3', '#ff6b9d', '#00d4ff'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.style.cssText = `
        position: fixed;
        width: 5px;
        height: 5px;
        background: ${randomColor};
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        opacity: 0.8;
        box-shadow: 0 0 10px ${randomColor};
    `;

    document.body.appendChild(dot);
    cursorTrail.push(dot);

    // Remove old dots
    if (cursorTrail.length > maxTrail) {
        const oldDot = cursorTrail.shift();
        oldDot.remove();
    }

    // Fade out dots
    cursorTrail.forEach((d, index) => {
        const opacity = (index + 1) / cursorTrail.length;
        d.style.opacity = opacity * 0.5;
        d.style.transform = `scale(${opacity})`;
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
