import { createTpl } from "../../utils/create-tpl.js";
const tpl = `
<style>
* {
  padding: 0;
  margin: 0;
}
a,a:link,a:visited,a:hover,a:active{
  text-decoration: none;
  color:inherit;
}
.link-button-wrapper {
  padding: .16rem .66rem;
  transition: transform 0.15s cubic-bezier(0, 0.2, 0.5, 3) 0s;
  box-shadow: rgba(10, 11, 13, 0.08) 0px 2px 4px 0px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255);
  position: relative;
  min-height: .64rem;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.link-content {
  width: 100%;
  height: 100%;
}

.link-icon {
  overflow: hidden;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  left: 8px;
  border-radius: 4px;
  width: 48px;
  height: 48px;
  background-size: cover;
  background-position: center;
}

.link-text {
  width: 100%;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
  color: black;
  text-align: center;
}

@media (hover:hover){
  .link-button-wrapper:hover {
    transform: scale(1.02);
  }
}
</style>

<a class="link-button-wrapper" target="_blank">
  <div class="link-content">
    <div class="link-icon">
    </div>
    <p class="link-text">
      <slot name="link-text">未填入文本</slot>
    </p>
  </div>
</a>
`;

class LinkButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(createTpl(tpl).content);
  }

  connectedCallback() {
    const href = this.getAttribute('href');
    const icon = this.getAttribute('icon');

    const wrapper = this.shadowRoot.querySelector('.link-button-wrapper');
    const iconEl = this.shadowRoot.querySelector('.link-icon');
    
    // href是必填项
    if (!href) {
      throw new Error('href are required');
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