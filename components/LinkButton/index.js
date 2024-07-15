class LinkButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const tpl = document.querySelector('#link-button-tpl');
    this.shadowRoot.appendChild(tpl.content.cloneNode(true));
  }

  connectedCallback() {
    const href = this.getAttribute('href');
    const icon = this.getAttribute('icon');

    const wrapper = this.shadowRoot.querySelector('.link-button-wrapper');
    const iconEl = this.shadowRoot.querySelector('.link-icon');
    
    // href是必填项
    if (!href) {
      throw new Error('href is required');
    }

    if (!icon || !icon.length) {
      iconEl.style.display = 'none';
    } else {
      iconEl.style.backgroundImage = `url(${icon})`;
    }

    wrapper.href = href;
  }
}

customElements.define('link-button', LinkButton);