var portfolio = {};

portfolio.init = function() {
    deferImages();
    chevronClick();
};

function deferImages() {
    var imgDefer = document.getElementsByTagName('img');
    for (var i=0; i<imgDefer.length; i++) {
    if (imgDefer[i].getAttribute('data-src')) {
        imgDefer[i].setAttribute('src', imgDefer[i].getAttribute('data-src'));
        }
    }
}

function chevronClick() {
    var bigChevron = document.getElementsByClassName('chevron-down')[0];
    bigChevron.onclick = function() {
        document.getElementById('first-project').scrollIntoView();
    }
}