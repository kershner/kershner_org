let bacon = {
    perPage         : 15,
    s3BaseUrl       : '',
    s3Keys          : [],
    imageWrapper    : document.querySelector('.images-wrapper')
};

bacon.init = function() {
    bacon.populateImages();
    bacon.imageScroll();
    bacon.colors();

    setInterval(function() {
        bacon.colors();
    }, 4000);
};

bacon.imageScroll = function() {
    window.onscroll = function(ev) {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
            bacon.populateImages();
        }
    };
};

bacon.populateImages = function() {
    let nextKeys = bacon.s3Keys.splice(0,  bacon.perPage);

    if (bacon.s3Keys.length) {
        let imageContainer = document.createElement('span');
        for (let key in nextKeys) {
            let fullS3Url = `${bacon.s3BaseUrl}/${nextKeys[key]}`;
            imageContainer.insertAdjacentHTML('beforeend', `<a class="img" href='${fullS3Url}'><img src="${fullS3Url}"></a>`);
        }

        let fragment = document.createDocumentFragment();
        fragment.appendChild(imageContainer);

        bacon.imageWrapper.appendChild(fragment);
    } else {
        let footer = document.querySelector('.footer-links');
        removeClass(footer, 'hidden');
    }
};

bacon.colors = function() {
    const colorWaveElements = document.querySelectorAll('.colorwave');
    colorWaveElements.forEach(e => {
        e.style.color = randomColor();
    });

    document.body.style.backgroundColor = randomColor();
};