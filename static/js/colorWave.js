let colorWave = {
    elements        : [],
    selectors       : ['.color-wave'],
    dynamicClass    : 'wave',
    initialized     : false,
    color           : '',
    initializedAttr : 'colorwave-initialized',
    timerIncrement  : 100,
    animationSpeed  : '0.5s'
};

colorWave.init = function() {
    colorWave.elements = [];
    colorWave.selectors.forEach(selector => {
        colorWave.elements.push(...document.querySelectorAll(`${selector}`));
    });

    colorWave.colorPrep();
    colorWave.colorElements(colorWave.elements);
};

colorWave.colorPrep = function() {
    if (!colorWave.initialized) {
        // Add css transition rule for our dynamic class
        let stylesheet = document.createElement('style');
        stylesheet.innerText = `
            .${colorWave.dynamicClass} {
                transition: color ${colorWave.animationSpeed};
                transition-timing-function: cubic-bezier(0.2, -2, 0.8, 2);
            }
        `;
        document.head.appendChild(stylesheet);
        colorWave.initialized = true;
    }

    colorWave.elements.forEach(el => {
        if (!el.hasAttribute(colorWave.initializedAttr)) {
            let elementText = [...el.innerHTML.trim().split('')];
            let html = '';
            elementText.forEach(text => {
                html += `<span class="${colorWave.dynamicClass}">${text}</span>`;
            });
            el.innerHTML = html;
            el.setAttribute(colorWave.initializedAttr, '');
        }
    });
};

colorWave.colorElements = function() {
    colorWave.elements.forEach(colorElement => {
        let timerPointer = 0.0;
        let colorwaveElements = [...colorElement.querySelectorAll(`.${colorWave.dynamicClass}`)];

        colorwaveElements.forEach(colorElement => {
            colorElement.style.color = null;

            colorElement.addEventListener('transitionend', () => {
                colorElement.style.color = null;
            });

            setTimeout(function() {
                colorElement.style.color = colorWave.color;
            }, timerPointer);

            timerPointer += colorWave.timerIncrement;
        });
    });
};
