//鼠标点击出现爱心特效
(function(window,document) {
    var hearts = [];
 
    /**
     * 初始化动画循环事件
     */
    window.requestAnimationFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) {
                setTimeout(callback, 1000 / 60);
            }
    })();
 
    /**
     * 添加桃心样式
     */
    function addHeartCss() {
        var cssStr = ".heart{width: 10px;height: 10px;position: fixed;background: #f00;transform: rotate(45deg);-webkit-transform: rotate(45deg);-moz-transform: rotate(45deg);}.heart:after,.heart:before{content: '';width: inherit;height: inherit;background: inherit;border-radius: 50%;-webkit-border-radius: 50%;-moz-border-radius: 50%;position: absolute;}.heart:after{top: -5px;}.heart:before{left: -5px;}";
        createCss(cssStr);
    }
    
    /**
     * 绘制桃心
     */
    function drawHeart() {
        var i = 0;
        for (i; i < hearts.length; i++) {
            if (hearts[i].alpha <= 0) {
                document.body.removeChild(hearts[i].el);
                hearts.splice(i, 1);
                continue;
            }
            hearts[i].y--;
            hearts[i].scale += 0.005;
            hearts[i].alpha -= 0.01;
            hearts[i].el.style.cssText = "left:" + hearts[i].x + "px;top:" + hearts[i].y + "px;opacity:" + hearts[i].alpha + ";transform:scale(" + hearts[i].scale + "," + hearts[i].scale + ") rotate(45deg);background:" + hearts[i].color;
        }
        requestAnimationFrame(drawHeart);
    }
 
    /**
     * 注册点击事件
     */
    function attachEvent() {
        var oldOnClick = typeof window.οnclick === "function" && window.onclick;
        window.onclick = function (event) {
            oldOnClick && oldOnClick();
            createHeart(event);
        }
    }
 
    /**
     * 创建桃心
     * @param event
     */
    function createHeart(event) {
        var d = document.createElement("div");
        d.className = "heart";
        hearts.push({
            el: d,
            x: event.clientX - 5,
            y: event.clientY - 5,
            scale: 1,
            alpha: 1,
            color: randomColor()
        });
        document.body.appendChild(d);
    }
 
    /**
     * 添加CSS样式到DOM中
     * @param cssStr
     */
    function createCss(cssStr) {
        var style = document.createElement("style");
        style.innerHTML = cssStr;
        document.getElementsByTagName('head')[0].appendChild(style);
    }
 
    /**
     * 获取随机颜色
     * @returns {string}
     */
    function randomColor() {
        return "rgb(" + (~~(Math.random() * 255)) + "," + (~~(Math.random() * 255)) + "," + (~~(Math.random() * 255)) + ")";
    }
 
    /**
     * 开始监听
     */
    (function () {
        addHeartCss();
        attachEvent();
        drawHeart();
    })();
})(window,document);