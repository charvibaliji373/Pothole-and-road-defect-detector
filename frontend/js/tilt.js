/**
 * RoadVision AI - 3D Card Perspective Tilt & Holographic Glare
 */

class CardTiltController {
  constructor(selector = '.tilt-card') {
    this.selector = selector;
    this.init();
  }

  init() {
    document.querySelectorAll(this.selector).forEach(card => {
      this.bindCard(card);
    });
  }

  bindCard(card) {
    if (card._tiltBound) return;
    card._tiltBound = true;

    // Ensure sheen child exists
    if (!card.querySelector('.tilt-sheen')) {
      const sheen = document.createElement('div');
      sheen.className = 'tilt-sheen';
      card.appendChild(sheen);
    }

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Max rotation: 12 degrees
      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;

      const mouseXPercent = (x / rect.width) * 100;
      const mouseYPercent = (y / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${mouseXPercent}%`);
      card.style.setProperty('--mouse-y', `${mouseYPercent}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  }

  refresh() {
    this.init();
  }
}

window.tiltController = new CardTiltController();
